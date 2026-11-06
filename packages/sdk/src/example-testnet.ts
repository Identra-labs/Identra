/**
 * Example: build a salted Merkle tree and verify a selective disclosure.
 *
 * This script does NOT require a live contract deployment. It demonstrates
 * the off-chain Merkle logic that an issuer and holder would run.
 *
 * To run against testnet with real contracts, replace the `MOCK_ROOT` and
 * `MOCK_STATUS` values with real data fetched from the credential-registry
 * contract using the Stellar RPC and the @stellar/stellar-sdk client.
 *
 * Named identity usage (Stellar CLI):
 *   stellar keys generate --global issuer-alice
 *   stellar keys generate --global holder-bob
 *
 * Never pass secret keys to this script. Use named identities only.
 *
 * Usage:
 *   node --loader ts-node/esm packages/sdk/src/example-testnet.ts
 */

import {
  buildTree,
  generateProof,
  verifyDisclosure,
  toHex,
  randomSalt,
} from "./index.js";
import type { SaltedClaim } from "./index.js";

async function main(): Promise<void> {
  // 1. Issuer builds the claim tree off-chain (never goes on-chain)
  const claims: SaltedClaim[] = [
    { key: "age_over_18", value: "true", salt: randomSalt() },
    { key: "country", value: "NG", salt: randomSalt() },
    { key: "name", value: "Bob", salt: randomSalt() },
  ];

  const tree = await buildTree(claims);
  // eslint-disable-next-line no-console
  console.log("Merkle root (hex):", toHex(tree.root));
  // -> Issuer stores this root on-chain via credential-registry issue()
  //    along with expiry. The claims and salts stay off-chain with the holder.

  // 2. Holder chooses to reveal only `age_over_18` and `country`
  const revealKeys = ["age_over_18", "country"];
  const revealedClaims: Record<string, string> = {};
  const salts: Record<string, Uint8Array> = {};
  const proofs: Record<string, ReturnType<typeof generateProof>> = {};

  for (const key of revealKeys) {
    const claim = claims.find((c) => c.key === key)!;
    revealedClaims[key] = claim.value;
    salts[key] = claim.salt;
    proofs[key] = generateProof(tree, key);
  }

  // 3. Verifier fetches the on-chain root and status (mocked here)
  //    In production: use @stellar/stellar-sdk to call status() and
  //    get_credential() on the credential-registry contract.
  const MOCK_ROOT = tree.root; // in production: fetched from chain
  const MOCK_STATUS = "Valid" as const; // in production: from contract

  // 4. Verify the disclosure
  const result = await verifyDisclosure(
    revealedClaims,
    salts,
    proofs,
    MOCK_ROOT,
    MOCK_STATUS,
  );

  // eslint-disable-next-line no-console
  console.log("Disclosure valid:", result.valid);
  // eslint-disable-next-line no-console
  console.log("Status:", result.status);
  // eslint-disable-next-line no-console
  console.log("Failed claims:", result.failedClaims);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
