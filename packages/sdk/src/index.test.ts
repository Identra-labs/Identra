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

  it("known vector: zero salt, age=30", async () => {
    // This is a test vector — exact value must remain stable.
    const h = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    // Record the hex so any change is caught
    expect(h.length).toBe(32);
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
    const leaf = await hashLeaf({
      key: "age",
      value: "30",
      salt: ZERO_SALT,
    });
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

  it("two claims: root is hash of two leaves", async () => {
    const a = { key: "age", value: "30", salt: ZERO_SALT };
    const b = { key: "name", value: "Alice", salt: ZERO_SALT };
    const tree = await buildTree([a, b]);
    // sorted: age, name
    const la = await hashLeaf({ key: "age", value: "30", salt: ZERO_SALT });
    const lb = await hashLeaf({
      key: "name",
      value: "Alice",
      salt: ZERO_SALT,
    });
    const expected = await hashNode(la, lb);
    expect(bytesEqual(tree.root, expected)).toBe(true);
  });

  it("sorts leaves by key", async () => {
    const tree1 = await buildTree([
      makeClaim("z", "1"),
      makeClaim("a", "2"),
    ]);
    const tree2 = await buildTree([
      makeClaim("a", "2"),
      makeClaim("z", "1"),
    ]);
    expect(bytesEqual(tree1.root, tree2.root)).toBe(true);
    expect(tree1.leaves[0].key).toBe("a");
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

  it("duplicate claim keys still builds (last one wins in sort)", async () => {
    const claims = [makeClaim("a", "1"), makeClaim("a", "2")];
    const tree = await buildTree(claims);
    expect(tree.root.length).toBe(32);
  });

  it("throws on empty claims", async () => {
    await expect(buildTree([])).rejects.toThrow("zero claims");
  });
});

// ── generateProof / verifyProof ───────────────────────────────────────────────

describe("generateProof + verifyProof", () => {
  it("verifies a proof for a two-leaf tree", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const ok = await verifyProof(a, proof, tree.root);
    expect(ok).toBe(true);
  });

  it("verifies both leaves in a two-leaf tree", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const pa = generateProof(tree, "age");
    const pb = generateProof(tree, "name");
    expect(await verifyProof(a, pa, tree.root)).toBe(true);
    expect(await verifyProof(b, pb, tree.root)).toBe(true);
  });

  it("verifies a proof in a four-leaf tree", async () => {
    const claims = ["a", "b", "c", "d"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    for (const c of claims) {
      const proof = generateProof(tree, c.key);
      expect(await verifyProof(c, proof, tree.root)).toBe(true);
    }
  });

  it("verifies a proof in an odd-leaf tree", async () => {
    const claims = ["a", "b", "c"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    for (const c of claims) {
      const proof = generateProof(tree, c.key);
      expect(await verifyProof(c, proof, tree.root)).toBe(true);
    }
  });

  it("tampered claim fails verification", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const tampered = makeClaim("age", "99"); // wrong value
    tampered.salt.set(a.salt);
    const ok = await verifyProof(tampered, proof, tree.root);
    expect(ok).toBe(false);
  });

  it("wrong salt fails verification", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const wrongSalt = makeClaim("age", "30", 99); // different salt
    const ok = await verifyProof(wrongSalt, proof, tree.root);
    expect(ok).toBe(false);
  });

  it("wrong root fails verification", async () => {
    const a = makeClaim("age", "30");
    const b = makeClaim("name", "Alice");
    const tree = await buildTree([a, b]);
    const proof = generateProof(tree, "age");
    const wrongRoot = new Uint8Array(32).fill(0xff);
    const ok = await verifyProof(a, proof, wrongRoot);
    expect(ok).toBe(false);
  });

  it("reordered proof steps fail verification", async () => {
    const claims = ["a", "b", "c", "d"].map((k) => makeClaim(k, k));
    const tree = await buildTree(claims);
    const proof = generateProof(tree, "a");
    const reversed: MerkleProof = [...proof].reverse();
    const ok = await verifyProof(claims[0], reversed, tree.root);
    expect(ok).toBe(false);
  });

  it("single-leaf tree: empty proof verifies", async () => {
    const a = makeClaim("age", "30");
    const tree = await buildTree([a]);
    const proof = generateProof(tree, "age");
    expect(proof.length).toBe(0);
    const ok = await verifyProof(a, proof, tree.root);
    expect(ok).toBe(true);
  });

  it("throws on unknown key", async () => {
    const tree = await buildTree([makeClaim("age", "30")]);
    expect(() => generateProof(tree, "missing")).toThrow("not found");
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

  it("valid disclosure returns valid=true", async () => {
    const claims = [makeClaim("age", "30"), makeClaim("name", "Alice")];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      claims,
      ["age"],
    );
    const result = await verifyDisclosure(
      revealedClaims,
      salts,
      proofs,
      tree.root,
      "Valid",
    );
    expect(result.valid).toBe(true);
    expect(result.failedClaims).toEqual([]);
    expect(result.status).toBe("Valid");
  });

  it("expired credential: valid proofs but status=Expired", async () => {
    const claims = [makeClaim("age", "30")];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      claims,
      ["age"],
    );
    const result = await verifyDisclosure(
      revealedClaims,
      salts,
      proofs,
      tree.root,
      "Expired",
    );
    expect(result.valid).toBe(true);
    expect(result.status).toBe("Expired");
  });

  it("revoked credential: proofs still verified but status=Revoked", async () => {
    const claims = [makeClaim("age", "30")];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      claims,
      ["age"],
    );
    const result = await verifyDisclosure(
      revealedClaims,
      salts,
      proofs,
      tree.root,
      "Revoked",
    );
    expect(result.valid).toBe(true);
    expect(result.status).toBe("Revoked");
  });

  it("tampered claim: valid=false, failedClaims lists the key", async () => {
    const claims = [makeClaim("age", "30"), makeClaim("name", "Alice")];
    const { salts, proofs, tree } = await makeDisclosure(claims, ["age"]);
    const result = await verifyDisclosure(
      { age: "99" }, // tampered
      salts,
      proofs,
      tree.root,
      "Valid",
    );
    expect(result.valid).toBe(false);
    expect(result.failedClaims).toContain("age");
  });

  it("wrong root: all claims fail", async () => {
    const claims = [makeClaim("age", "30")];
    const { revealedClaims, salts, proofs } = await makeDisclosure(claims, [
      "age",
    ]);
    const wrongRoot = new Uint8Array(32).fill(0xab);
    const result = await verifyDisclosure(
      revealedClaims,
      salts,
      proofs,
      wrongRoot,
      "Valid",
    );
    expect(result.valid).toBe(false);
    expect(result.failedClaims).toContain("age");
  });

  it("missing salt: claim fails", async () => {
    const claims = [makeClaim("age", "30")];
    const { revealedClaims, proofs, tree } = await makeDisclosure(claims, [
      "age",
    ]);
    const result = await verifyDisclosure(
      revealedClaims,
      {}, // no salts
      proofs,
      tree.root,
      "Valid",
    );
    expect(result.valid).toBe(false);
    expect(result.failedClaims).toContain("age");
  });

  it("multiple claims: partial reveal, all valid", async () => {
    const claims = [
      makeClaim("age", "30"),
      makeClaim("name", "Alice"),
      makeClaim("country", "NG"),
    ];
    const { revealedClaims, salts, proofs, tree } = await makeDisclosure(
      claims,
      ["age", "country"],
    );
    const result = await verifyDisclosure(
      revealedClaims,
      salts,
      proofs,
      tree.root,
      "Valid",
    );
    expect(result.valid).toBe(true);
    expect(result.failedClaims).toEqual([]);
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
