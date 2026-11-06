/**
 * verifyDisclosure — check a selective disclosure against the on-chain root.
 */

import { verifyProof } from "./merkle.js";
import type {
  CredentialStatus,
  DisclosureResult,
  MerkleProof,
} from "./types.js";

/**
 * Verify that each revealed claim's proof is valid against the on-chain root,
 * and report the credential's status.
 *
 * @param revealedClaims  - key/value pairs the holder chose to reveal
 * @param salts           - the 32-byte salt for each revealed claim key
 * @param proofs          - the Merkle proof for each revealed claim key
 * @param onChainRoot     - 32-byte root stored on-chain by the issuer
 * @param status          - current credential status from contract status()
 */
export async function verifyDisclosure(
  revealedClaims: Record<string, string>,
  salts: Record<string, Uint8Array>,
  proofs: Record<string, MerkleProof>,
  onChainRoot: Uint8Array,
  status: CredentialStatus,
): Promise<DisclosureResult> {
  const failedClaims: string[] = [];

  for (const key of Object.keys(revealedClaims)) {
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

  return {
    valid: failedClaims.length === 0,
    status,
    failedClaims,
  };
}
