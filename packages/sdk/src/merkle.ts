/**
 * Merkle tree utilities for Identra selective disclosure.
 *
 * Design:
 *  - Hash function: SHA-256 via Web Crypto (crypto.subtle)
 *  - Leaf:  SHA-256( 0x00 || salt(32) || len4(key) || key_utf8 || len4(value) || value_utf8 )
 *           where len4 is a 4-byte big-endian uint32 byte-length prefix
 *  - Node:  SHA-256( 0x01 || left(32) || right(32) )
 *  - Leaves sorted by key UTF-8 bytes (lexicographic on the encoded bytes)
 *  - Odd leaf count: duplicate the last leaf
 *  - Duplicate keys are rejected
 *
 * See docs/MERKLE_SPEC.md for the full specification and test vectors.
 */

import type { MerkleProof, MerkleTree, SaltedClaim } from "./types.js";

const LEAF_PREFIX = new Uint8Array([0x00]);
const NODE_PREFIX = new Uint8Array([0x01]);
const enc = new TextEncoder();

/** Write a uint32 as 4 big-endian bytes. */
function len4(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

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
 * leaf_hash = SHA-256( 0x00 || salt(32) || len4(key) || key_utf8 || len4(value) || value_utf8 )
 */
export async function hashLeaf(claim: SaltedClaim): Promise<Uint8Array> {
  if (claim.salt.length !== 32) {
    throw new Error(`salt must be 32 bytes, got ${claim.salt.length}`);
  }
  const keyBytes = enc.encode(claim.key);
  const valBytes = enc.encode(claim.value);
  return sha256(
    LEAF_PREFIX,
    claim.salt,
    len4(keyBytes.length),
    keyBytes,
    len4(valBytes.length),
    valBytes,
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

/** Compare two Uint8Arrays lexicographically by byte value. */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Build a Merkle tree from a set of salted claims.
 * Keys are sorted by their UTF-8 byte representation (lexicographic on bytes).
 * Duplicate keys are rejected.
 * Odd number of leaves: the last leaf is duplicated.
 */
export async function buildTree(claims: SaltedClaim[]): Promise<MerkleTree> {
  if (claims.length === 0) {
    throw new Error("cannot build a Merkle tree with zero claims");
  }

  // Sort by UTF-8 bytes of key
  const sorted = [...claims].sort((a, b) =>
    compareBytes(enc.encode(a.key), enc.encode(b.key)),
  );

  // Reject duplicate keys
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].key === sorted[i - 1].key) {
      throw new Error(`duplicate claim key: "${sorted[i].key}"`);
    }
  }

  // Compute leaf hashes
  const leafHashes = await Promise.all(sorted.map(hashLeaf));

  // Build levels bottom-up
  const levels: Uint8Array[][] = [leafHashes];
  let current = leafHashes;

  while (current.length > 1) {
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
    const padded =
      levelNodes.length % 2 === 1
        ? [...levelNodes, levelNodes[levelNodes.length - 1]]
        : levelNodes;

    const isRightChild = index % 2 === 1;
    const siblingIndex = isRightChild ? index - 1 : index + 1;

    proof.push({
      sibling: padded[siblingIndex],
      isLeft: isRightChild,
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
