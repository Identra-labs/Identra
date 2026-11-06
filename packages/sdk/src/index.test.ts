import { describe, it, expect } from "vitest";
import {
  sdkVersion,
  sha256,
  hashLeaf,
  hashNode,
  buildTree,
  generateProof,
  verifyProof,
  bytesEqual,
  toHex,
  fromHex,
  randomSalt,
  verifyDisclosure,
} from "./index.js";
import type { SaltedClaim, MerkleProof } from "./index.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const ZERO_SALT = new Uint8Array(32);

function makeClaim(key: string, value: string, seed = 0): SaltedClaim {
  const salt = new Uint8Array(32);
  salt[0] = seed;
  return { key, value, salt };
}

// ── version ───────────────────────────────────────────────────────────────────

describe("sdkVersion", () => {
  it("returns a version string", () => {
    expect(sdkVersion()).toBe("0.1.0");
  });
});

// ── sha256 ────────────────────────────────────────────────────────────────────

describe("sha256", () => {
  it("produces 32 bytes", async () => {
    const h = await sha256(new Uint8Array([1, 2, 3]));
    expect(h.length).toBe(32);
  });

  it("is deterministic", async () => {
    const a = await sha256(new Uint8Array([42]));
    const b = await sha256(new Uint8Array([42]));
    expect(bytesEqual(a, b)).toBe(true);
  });

  it("different inputs produce different hashes", async () => {
    const a = await sha256(new Uint8Array([1]));
    const b = await sha256(new Uint8Array([2]));
    expect(bytesEqual(a, b)).toBe(false);
  });
});

// ── hashLeaf ──────────────────────────────────────────────────────────────────

describe("hashLeaf", () => {
  it("produces 32 bytes", async () => {
    const h = await hashLeaf(makeClaim("age", "30"));
    expect(h.length).toBe(32);
  });

  it("is deterministic", async () => {
    const c = makeClaim("age", "30");
    const a = await hashLeaf(c);
    const b = await hashLeaf(c);
    expect(bytesEqual(a, b)).toBe(true);
  });

  it("different keys give different hashes", async () => {
    const a = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const b = await hashLeaf({ key: "name", value: "30", salt: ZERO_SALT });
    expect(bytesEqual(a, b)).toBe(false);
  });

  it("different values give different hashes", async () => {
    const a = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const b = await hashLeaf({ key: "age", value: "31", salt: ZERO_SALT });
    expect(bytesEqual(a, b)).toBe(false);
  });

  it("different salts give different hashes", async () => {
    const salt2 = new Uint8Array(32);
    salt2[0] = 1;
    const a = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const b = await hashLeaf({ key: "age", value: "30", salt: salt2 });
    expect(bytesEqual(a, b)).toBe(false);
  });

  it("wrong salt length throws", async () => {
    await expect(
      hashLeaf({ key: "k", value: "v", salt: new Uint8Array(16) }),
    ).rejects.toThrow("salt must be 32 bytes");
  });

  it("key containing colon is handled correctly (no ambiguity with old encoding)", async () => {
    // With length-prefix encoding, "a:b"/"c" and "a"/"b:c" produce different hashes
    const a = await hashLeaf({ key: "a:b", value: "c", salt: ZERO_SALT });
    const b = await hashLeaf({ key: "a", value: "b:c", salt: ZERO_SALT });
    expect(bytesEqual(a, b)).toBe(false);
  });

  it("non-ASCII key is handled", async () => {
    const h = await hashLeaf({ key: "名前", value: "Alice", salt: ZERO_SALT });
    expect(h.length).toBe(32);
  });

  it("known vector: zero salt, age=30 (snapshot)", async () => {
    const h = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    expect(toHex(h)).toMatchSnapshot();
  });
});

// ── hashNode ──────────────────────────────────────────────────────────────────

describe("hashNode", () => {
  it("produces 32 bytes", async () => {
    const h = await hashNode(ZERO_SALT, ZERO_SALT);
    expect(h.length).toBe(32);
  });

  it("left ≠ right order matters", async () => {
    const a = new Uint8Array(32).fill(1);
    const b = new Uint8Array(32).fill(2);
    const ab = await hashNode(a, b);
    const ba = await hashNode(b, a);
    expect(bytesEqual(ab, ba)).toBe(false);
  });

  it("node hash ≠ leaf hash for same input", async () => {
    const leaf = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const node = await hashNode(leaf, leaf);
    expect(bytesEqual(leaf, node)).toBe(false);
  });
});

// ── buildTree ─────────────────────────────────────────────────────────────────

describe("buildTree", () => {
  it("single claim: root equals leaf hash", async () => {
    const claim = { key: "age", value: "30", salt: ZERO_SALT };
    const tree = await buildTree([claim]);
    const leaf = await hashLeaf(claim);
    expect(bytesEqual(tree.root, leaf)).toBe(true);
  });

  it("two claims: root is hash of two leaves (sorted)", async () => {
    const a = { key: "age", value: "30", salt: ZERO_SALT };
    const b = { key: "name", value: "Alice", salt: ZERO_SALT };
    const tree = await buildTree([a, b]);
    // sorted: "age" < "name" by UTF-8 bytes
    const la = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const lb = await hashLeaf({ key: "name", value: "Alice", salt: ZERO_SALT });
    const expected = await hashNode(la, lb);
    expect(bytesEqual(tree.root, expected)).toBe(true);
  });

  it("sorts leaves by UTF-8 key bytes", async () => {
    const tree1 = await buildTree([makeClaim("z", "1"), makeClaim("a", "2")]);
    const tree2 = await buildTree([makeClaim("a", "2"), makeClaim("z", "1")]);
    expect(bytesEqual(tree1.root, tree2.root)).toBe(true);
    expect(tree1.leaves[0].key).toBe("a");
  });

  it("sorts non-ASCII keys by UTF-8 bytes", async () => {
    // "\u00e9" (é, 2 bytes) < "\u4e2d" (中, 3 bytes) by byte comparison
    const tree = await buildTree([
      makeClaim("\u4e2d", "1"),
      makeClaim("\u00e9", "2"),
    ]);
    expect(tree.leaves[0].key).toBe("\u00e9");
  });

  it("odd leaf count: duplicates last leaf", async () => {
    const claims = [makeClaim("a", "1"), makeClaim("b", "2"), makeClaim("c", "3")];
    const tree = await buildTree(claims);
    expect(tree.root.length).toBe(32);
  });

  it("four claims", async () => {
    const claims = ["a", "b", "c", "d"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    expect(tree.root.length).toBe(32);
  });

  it("throws on empty claims", async () => {
    await expect(buildTree([])).rejects.toThrow("zero claims");
  });

  it("throws on duplicate keys", async () => {
    await expect(
      buildTree([makeClaim("a", "1"), makeClaim("a", "2")]),
    ).rejects.toThrow("duplicate claim key");
  });
});

// ── generateProof / verifyProof ───────────────────────────────────────────────

describe("generateProof + verifyProof", () => {
  it("verifies a proof for a two-leaf tree", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    expect(await verifyProof(a, proof, tree.root)).toBe(true);
  });

  it("verifies both leaves in a two-leaf tree", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    expect(await verifyProof(a, generateProof(tree, "age"), tree.root)).toBe(true);
    expect(await verifyProof(b, generateProof(tree, "name"), tree.root)).toBe(true);
  });

  it("verifies all leaves in a four-leaf tree", async () => {
    const claims = ["a", "b", "c", "d"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    for (const c of claims) {
      expect(await verifyProof(c, generateProof(tree, c.key), tree.root)).toBe(true);
    }
  });

  it("verifies all leaves in an odd-leaf tree", async () => {
    const claims = ["a", "b", "c"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    for (const c of claims) {
      expect(await verifyProof(c, generateProof(tree, c.key), tree.root)).toBe(true);
    }
  });

  it("tampered claim value fails", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const tampered: SaltedClaim = { key: "age", value: "99", salt: a.salt };
    expect(await verifyProof(tampered, proof, tree.root)).toBe(false);
  });

  it("wrong salt fails", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const wrongSalt = makeClaim("age", "30", 99);
    expect(await verifyProof(wrongSalt, proof, tree.root)).toBe(false);
  });

  it("wrong root fails", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    expect(await verifyProof(a, proof, new Uint8Array(32).fill(0xff))).toBe(false);
  });

  it("reordered proof steps fail", async () => {
    const claims = ["a", "b", "c", "d"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    const proof = generateProof(tree, "a");
    const reversed: MerkleProof = [...proof].reverse();
    expect(await verifyProof(claims[0], reversed, tree.root)).toBe(false);
  });

  it("single-leaf tree: empty proof verifies", async () => {
    const a = makeClaim("age", "30");
    const tree = await buildTree([a]);
    const proof = generateProof(tree, "age");
    expect(proof.length).toBe(0);
    expect(await verifyProof(a, proof, tree.root)).toBe(true);
  });

  it("throws on unknown key", async () => {
    const tree = await buildTree([makeClaim("age", "30")]);
    expect(() => generateProof(tree, "missing")).toThrow("not found");
  });

  it("key containing colon verifies correctly", async () => {
    const a = makeClaim("a:b", "val");
    const b = makeClaim("c", "other");
    const tree = await buildTree([a, b]);
    expect(await verifyProof(a, generateProof(tree, "a:b"), tree.root)).toBe(true);
  });

  it("non-ASCII key verifies correctly", async () => {
    const a = makeClaim("名前", "Alice");
    const b = makeClaim("age", "30");
    const tree = await buildTree([a, b]);
    expect(await verifyProof(a, generateProof(tree, "名前"), tree.root)).toBe(true);
  });
});

// ── verifyDisclosure ──────────────────────────────────────────────────────────

describe("verifyDisclosure", () => {
  async function makeDisclosure(
    claims: SaltedClaim[],
    revealKeys: string[],
    status: "Valid" | "Expired" | "Revoked" | "Unknown" = "Valid",
  ) {
    const tree = await buildTree(claims);
    const revealedClaims: Record<string, string> = {};
    const salts: Record<string, Uint8Array> = {};
    const proofs: Record<string, MerkleProof> = {};
    for (const k of revealKeys) {
      const c = claims.find((x) => x.key === k)!;
      revealedClaims[k] = c.value;
      salts[k] = c.salt;
      proofs[k] = generateProof(tree, k);
    }
    return { tree, revealedClaims, salts, proofs, status };
  }

  it("valid disclosure: proofsValid=true, accepted=true", async () => {
    const claims = [makeClaim("age", "30"), makeClaim("name", "Alice")];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(claims, ["age"]);
    const r = await verifyDisclosure(revealedClaims, salts, proofs, tree.root, "Valid");
    expect(r.proofsValid).toBe(true);
    expect(r.accepted).toBe(true);
    expect(r.failedClaims).toEqual([]);
    expect(r.status).toBe("Valid");
  });

  it("expired credential: proofsValid=true, accepted=false", async () => {
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      [makeClaim("age", "30")], ["age"], "Expired",
    );
    const r = await verifyDisclosure(revealedClaims, salts, proofs, tree.root, "Expired");
    expect(r.proofsValid).toBe(true);
    expect(r.accepted).toBe(false);
    expect(r.status).toBe("Expired");
  });

  it("revoked credential: proofsValid=true, accepted=false", async () => {
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      [makeClaim("age", "30")], ["age"],
    );
    const r = await verifyDisclosure(revealedClaims, salts, proofs, tree.root, "Revoked");
    expect(r.proofsValid).toBe(true);
    expect(r.accepted).toBe(false);
  });

  it("zero claims revealed: accepted=false even if status Valid", async () => {
    const tree = await buildTree([makeClaim("age", "30")]);
    const r = await verifyDisclosure({}, {}, {}, tree.root, "Valid");
    expect(r.proofsValid).toBe(true);
    expect(r.accepted).toBe(false);
  });

  it("tampered claim: proofsValid=false, accepted=false, failedClaims lists key", async () => {
    const claims = [makeClaim("age", "30"), makeClaim("name", "Alice")];
    const { salts, proofs, tree } = await makeDisclosure(claims, ["age"]);
    const r = await verifyDisclosure({ age: "99" }, salts, proofs, tree.root, "Valid");
    expect(r.proofsValid).toBe(false);
    expect(r.accepted).toBe(false);
    expect(r.failedClaims).toContain("age");
  });

  it("wrong root: proofsValid=false", async () => {
    const { revealedClaims, salts, proofs } = await makeDisclosure(
      [makeClaim("age", "30")], ["age"],
    );
    const r = await verifyDisclosure(
      revealedClaims, salts, proofs, new Uint8Array(32).fill(0xab), "Valid",
    );
    expect(r.proofsValid).toBe(false);
    expect(r.accepted).toBe(false);
  });

  it("missing salt: claim fails", async () => {
    const { revealedClaims, proofs, tree } = await makeDisclosure(
      [makeClaim("age", "30")], ["age"],
    );
    const r = await verifyDisclosure(revealedClaims, {}, proofs, tree.root, "Valid");
    expect(r.proofsValid).toBe(false);
    expect(r.failedClaims).toContain("age");
  });

  it("multiple claims: partial reveal, all valid → accepted=true", async () => {
    const claims = [
      makeClaim("age", "30"), makeClaim("country", "NG"), makeClaim("name", "Alice"),
    ];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      claims, ["age", "country"],
    );
    const r = await verifyDisclosure(revealedClaims, salts, proofs, tree.root, "Valid");
    expect(r.proofsValid).toBe(true);
    expect(r.accepted).toBe(true);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

describe("bytesEqual", () => {
  it("equal arrays return true", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
  });
  it("different arrays return false", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
  it("different lengths return false", () => {
    expect(bytesEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe("toHex / fromHex", () => {
  it("round-trips", () => {
    const b = new Uint8Array([0x00, 0xab, 0xff]);
    expect(bytesEqual(fromHex(toHex(b)), b)).toBe(true);
  });
  it("toHex produces expected string", () => {
    expect(toHex(new Uint8Array([0, 255]))).toBe("00ff");
  });
  it("fromHex throws on odd-length string", () => {
    expect(() => fromHex("abc")).toThrow("even length");
  });
});

describe("randomSalt", () => {
  it("returns 32 bytes", () => {
    expect(randomSalt().length).toBe(32);
  });
  it("two calls produce different values", () => {
    expect(bytesEqual(randomSalt(), randomSalt())).toBe(false);
  });
});
