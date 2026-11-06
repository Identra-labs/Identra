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

The contracts, SDK, and CLI have not been through a professional security audit. Known limitations include:
- The cross-contract identity check in `credential-registry` is wired but the body requires a pre-built Wasm and stellar-cli (see `docs/DECISIONS.md`).
- No formal verification of the Merkle implementation.

## Page cap

`credentials_of` returns at most `PAGE_CAP` (50) credentials per call. There is no global index of all credentials in the registry — only a per-subject list.

## Issuer trust

Identra enforces *who* can issue (admin-approved issuers) but not *what* they can claim. Verifiers must independently decide which issuers they trust for which claim types.

## Single admin key

The registry admin is a single Stellar address. For production use, this should be a multisig contract. Identra does not currently ship a multisig admin — that is a roadmap item.
