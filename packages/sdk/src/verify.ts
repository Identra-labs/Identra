/**
 * verifyDisclosure — verify a selective disclosure against a supplied root and status.
 *
 * The caller is responsible for fetching the on-chain root (from
 * credential-registry get_credential()) and status (from status()) before
 * calling this function. The SDK does not read from the chain.
 */

import { verifyProof } from "./merkle.js";
import type {
  CredentialStatus,
  DisclosureResult,
  MerkleProof,
} from "./types.js";

/**
 * Verify that each revealed claim's proof is valid against the supplied root.
 *
 * @param revealedClaims  - key/value pairs the holder chose to reveal
 * @param salts           - the 32-byte salt for each revealed claim key
 * @param proofs          - the Merkle proof for each revealed claim key
 * @param onChainRoot     - 32-byte root supplied by the caller (from the contract)
 * @param status          - credential status supplied by the caller (from the contract)
 */
export async function verifyDisclosure(
  revealedClaims: Record<string, string>,
  salts: Record<string, Uint8Array>,
  proofs: Record<string, MerkleProof>,
  onChainRoot: Uint8Array,
  status: CredentialStatus,
): Promise<DisclosureResult> {
  const failedClaims: string[] = [];
  const keys = Object.keys(revealedClaims);

  for (const key of keys) {
    const value = revealedClaims[key];
    const salt = salts[key];
    const proof = proofs[key];

    if (!salt || !proof) {
      failedClaims.push(key);
      continue;
    }

    const ok = await verifyProof({ key, value, salt }, proof, onChainRoot);
    if (!ok) {
      failedClaims.push(key);
    }
  }

  const proofsValid = failedClaims.length === 0;
  const accepted = proofsValid && keys.length > 0 && status === "Valid";

  return {
    proofsValid,
    accepted,
    status,
    failedClaims,
  };
}
