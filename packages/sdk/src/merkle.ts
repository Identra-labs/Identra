/**
 * Merkle tree utilities for Identra selective disclosure.
 *
 * Design:
 *  - Hash function: SHA-256 via Web Crypto (crypto.subtle)
 *  - Leaf:  SHA-256( 0x00 || salt(32) || key_utf8 || ':' || value_utf8 )
 *  - Node:  SHA-256( 0x01 || left(32) || right(32) )
 *  - Odd leaf count: duplicate the last leaf
 *  - Leaves sorted by key (UTF-8 lexicographic) before construction
 *
 * See docs/MERKLE_SPEC.md for the full specification and test vectors.
 */

import type { MerkleProof, MerkleTree, SaltedClaim } from "./types.js";

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);
const enc = new TextEncoder();

/** Compute SHA-256 of the concatenation of all provided byte arrays. */
export async function sha256(...parts: Uint8Array[]): Promise<Uint8Array> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    buf.set(p, offset);
    offset += p.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

/**
 * Hash a single claim leaf.
 * leaf_hash = SHA-256( 0x00 || salt(32) || key_utf8 || ':' || value_utf8 )
 */
export async function hashLeaf(claim: SaltedClaim): Promise<Uint8Array> {
  if (claim.salt.length !== 32) {
    throw new Error(`salt must be 32 bytes, got ${claim.salt.length}`);
  }
  return sha256(
    LEAF_PREFIX,
    claim.salt,
    enc.encode(claim.key),
    enc.encode(":"),
    enc.encode(claim.value),
  );
}

/**
 * Hash two child nodes into a parent.
 * node_hash = SHA-256( 0x01 || left(32) || right(32) )
 */
export async function hashNode(
  left: Uint8Array,
  right: Uint8Array,
): Promise<Uint8Array> {
  return sha256(NODE_PREFIX, left, right);
}

/**
 * Build a Merkle tree from a set of salted claims.
 * Claims are sorted by key before construction.
 * Odd number of leaves: the last leaf is duplicated.
 */
export async function buildTree(claims: SaltedClaim[]): Promise<MerkleTree> {
  if (claims.length === 0) {
    throw new Error("cannot build a Merkle tree with zero claims");
  }

  // Sort by key for deterministic ordering
  const sorted = [...claims].sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );

  // Compute leaf hashes
  const leafHashes = await Promise.all(sorted.map(hashLeaf));

  // Build levels bottom-up
  const levels: Uint8Array[][] = [leafHashes];
  let current = leafHashes;

  while (current.length > 1) {
    // Duplicate last leaf if odd count
    const padded =
      current.length % 2 === 1
        ? [...current, current[current.length - 1]]
        : current;
    const next: Uint8Array[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      next.push(await hashNode(padded[i], padded[i + 1]));
    }
    levels.push(next);
    current = next;
  }

  return {
    root: current[0],
    leaves: sorted,
    levels,
  };
}

/**
 * Generate a Merkle proof for a single claim key.
 * Returns the list of proof steps from leaf to root.
 */
export function generateProof(tree: MerkleTree, key: string): MerkleProof {
  const leafIndex = tree.leaves.findIndex((c) => c.key === key);
  if (leafIndex < 0) {
    throw new Error(`claim key "${key}" not found in tree`);
  }

  const proof: MerkleProof = [];
  let index = leafIndex;

  for (let level = 0; level < tree.levels.length - 1; level++) {
    const levelNodes = tree.levels[level];
    // Pad to even if necessary
    const padded =
      levelNodes.length % 2 === 1
        ? [...levelNodes, levelNodes[levelNodes.length - 1]]
        : levelNodes;

    const isRightChild = index % 2 === 1;
    const siblingIndex = isRightChild ? index - 1 : index + 1;

    proof.push({
      sibling: padded[siblingIndex],
      isLeft: isRightChild, // sibling is left when current is right
    });

    index = Math.floor(index / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof for a single revealed claim.
 * Returns true if the proof is valid against the given root.
 */
export async function verifyProof(
  claim: SaltedClaim,
  proof: MerkleProof,
  root: Uint8Array,
): Promise<boolean> {
  let current = await hashLeaf(claim);

  for (const step of proof) {
    current = step.isLeft
      ? await hashNode(step.sibling, current)
      : await hashNode(current, step.sibling);
  }

  return bytesEqual(current, root);
}

/** Constant-time byte array comparison. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Encode a Uint8Array as a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode a lowercase hex string to Uint8Array. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string must have even length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Generate a cryptographically random 32-byte salt. */
export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
