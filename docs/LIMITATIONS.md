# Limitations

## Not a W3C DID method

Identra is not a W3C Decentralized Identifier (DID) method. Identity records in Identra are registry-local identifiers, not `did:` URIs. The `did:stellar` method is separately defined by another project (ACTA/Mavennet); Identra deliberately avoids that namespace to prevent confusion. See `docs/PRIOR_ART.md`.

## No zero-knowledge proofs

Selective disclosure uses standard binary Merkle proofs. When a holder reveals a claim, its key and value are plaintext to the verifier. There is no cryptographic way to prove a property of a claim (e.g., "age > 18") without revealing the exact value. If zero-knowledge proofs are required, a different system is needed.

## Off-chain proofs and data loss

Claims, salts, and Merkle proofs live entirely off-chain with the holder. Identra provides no storage, no wallet, and no recovery mechanism. If a holder loses their data, proofs cannot be regenerated. Issuers can re-issue credentials, but the new credential will have a different root and a different on-chain record.

## Testnet only

All contract addresses, test vectors, and the quickstart use the Stellar Testnet. This software has not been deployed to Mainnet and has not been audited. Do not use with real funds or real personal data.

## Not audited

The contracts, SDK, and CLI have not been through a professional security audit.

## The SDK does not read from the chain

`verifyDisclosure` verifies proofs against a root and status that the caller
supplies. It does not fetch anything from the Stellar network. The caller (or
the verifier application) is responsible for independently fetching
`get_credential()` and `status()` from the credential-registry contract before
calling `verifyDisclosure`.

## The CLI prints commands, does not execute them

`@identra/cli` builds and prints `stellar contract invoke` commands. It does
not execute them or sign any transaction. The user runs the printed command in
their terminal with the Stellar CLI installed.

## Known limitations

- **Init race.** `init` is a separate transaction from `deploy`. A fast attacker who sees the deployment before you can call `init` can initialise the contract with their own admin key. Deploy and init must be done in rapid succession, ideally in the same transaction batch.

- **TTL window.** Persistent storage entries are extended to approximately 25 days on each access. If no one reads or writes an entry for 25 days, it becomes archived (inaccessible until restored). Callers must ensure active entries are touched regularly or restored when needed.

- **Unbounded per-subject credential list.** The `OwnerCreds` list for a subject grows without limit. `credentials_of` caps results at 50 per call, but the underlying list is not capped. A subject issued many credentials will have a large storage entry.

- **Removing an issuer does not invalidate prior credentials.** Credentials issued before an issuer was removed remain valid on-chain. The admin cannot revoke another issuer's credentials — only the issuing issuer can revoke.

- **No holder binding.** A verifier receives claims, salts, and proofs from whoever presents them. There is no cryptographic proof that the presenter is the subject named in the credential. A valid presentation can be replayed by anyone who has seen it.

- **The CLI does not validate flag formats.** Flags like `--hash`, `--claims-root`, and `--expiry` are checked for length and hex format, but semantic validity (e.g. that an expiry is in the future, or that an address is a valid Stellar address) is not checked. Invalid inputs will be forwarded to the Stellar CLI, which will produce its own error.

## Single admin key

The registry admin is a single Stellar address. For production use, this should be a multisig contract. Identra does not currently ship a multisig admin — that is a roadmap item.
