---
inclusion: always
---

# Project context

Identra is a Soroban identity and credential toolkit.

Layout (monorepo):
- contracts/identity-registry: wallet-linked identity record (metadata hash
  only)
- contracts/credential-registry: issuers, schemas, credentials stored as a
  Merkle root plus expiry, revocation, status
- packages/sdk: TypeScript wrapper over generated bindings, Merkle utilities,
  verifyDisclosure
- packages/cli: minimal CLI (create-identity, add-issuer, register-schema,
  issue, revoke, verify)
- docs/

Selective disclosure design: the issuer builds a salted Merkle tree of claims
off-chain and records only the root and expiry on-chain. The holder reveals
chosen claims with salts and proofs. The verifier checks the proofs against the
on-chain root and the credential's status.

Not a W3C DID method (do not use the did:stellar prefix; another project already
defines it). No zero-knowledge proofs. Testnet only. Not audited.

This is a crowded space. See docs/PRIOR_ART.md for how Identra differs.
