/**
 * @identra/sdk
 *
 * TypeScript SDK for the Identra identity and credential toolkit on Soroban.
 *
 * Exports:
 *  - Merkle utilities: buildTree, generateProof, verifyProof, hashLeaf,
 *    hashNode, sha256, bytesEqual, toHex, fromHex, randomSalt
 *  - verifyDisclosure
 *  - All shared types
 *
 * Note: TypeScript contract bindings are generated in a separate step once
 * the contracts are deployed to testnet:
 *   npx @stellar/stellar-sdk generate --contract-id <C...> \
 *     --output-dir packages/identity-registry-bindings \
 *     --rpc-url https://soroban-testnet.stellar.org \
 *     --network-passphrase "Test SDF Network ; September 2015"
 *
 * See docs/SOROBAN_NOTES.md §10 for details.
 */

export { sdkVersion } from "./version.js";

export {
  buildTree,
  generateProof,
  verifyProof,
  hashLeaf,
  hashNode,
  sha256,
  bytesEqual,
  toHex,
  fromHex,
  randomSalt,
} from "./merkle.js";

export { verifyDisclosure } from "./verify.js";

export type {
  CredentialStatus,
  IdentityRecord,
  CredentialRecord,
  ProofStep,
  MerkleProof,
  DisclosureResult,
  SaltedClaim,
  MerkleTree,
} from "./types.js";
