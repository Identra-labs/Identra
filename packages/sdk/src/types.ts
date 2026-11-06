/**
 * Shared types for the Identra SDK.
 * These mirror the on-chain contract types exactly.
 */

/** Status of a credential as returned by credential-registry status(). */
export type CredentialStatus = "Valid" | "Expired" | "Revoked" | "Unknown";

/** On-chain identity record from identity-registry get_identity(). */
export interface IdentityRecord {
  id: bigint;
  owner: string; // Stellar address
  metadataHash: Uint8Array; // 32-byte SHA-256
  active: boolean;
}

/** On-chain credential record from credential-registry get_credential(). */
export interface CredentialRecord {
  id: bigint;
  issuer: string; // Stellar address
  subject: string; // Stellar address
  schemaId: bigint;
  claimsRoot: Uint8Array; // 32-byte Merkle root
  expiry: bigint; // ledger timestamp (seconds)
  revoked: boolean;
}

/** A single step in a Merkle proof. */
export interface ProofStep {
  /** The sibling hash at this level. */
  sibling: Uint8Array;
  /** True if the sibling is to the LEFT (current node is right child). */
  isLeft: boolean;
}

/** Merkle proof for a single claim leaf. */
export type MerkleProof = ProofStep[];

/** Result from verifyDisclosure(). */
export interface DisclosureResult {
  /** True if all provided proofs verified against the on-chain root. */
  valid: boolean;
  /** The credential status (from the contract). */
  status: CredentialStatus;
  /** Claim keys whose proofs failed verification. Empty when valid. */
  failedClaims: string[];
}

/** A salted claim before tree construction. */
export interface SaltedClaim {
  key: string;
  value: string;
  /** 32-byte random salt. */
  salt: Uint8Array;
}

/** Output from buildTree(). */
export interface MerkleTree {
  /** The 32-byte root hash. */
  root: Uint8Array;
  /** Sorted, salted leaves used to build the tree. */
  leaves: SaltedClaim[];
  /** Intermediate level hashes [level0=leaves, level1, ..., levelN=root]. */
  levels: Uint8Array[][];
}
