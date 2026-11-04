# Identra

Identity and credential toolkit for Soroban: an identity registry, a credential
registry, and a TypeScript SDK and CLI for issuing credentials and verifying
selectively disclosed claims.

> **Status: pre-alpha, testnet only, not audited.** Do not use with real funds
> or real personal data. This README describes the planned design; see
> [docs/ROADMAP.md](docs/ROADMAP.md) for what exists today.

## What it will do

1. **Identity registry (contract):** a wallet-linked identity record that holds
   only a metadata hash, never personal data.
2. **Credential registry (contract):** approved issuers record a credential as a
   Merkle root plus an expiry. Credentials can be revoked and their status
   queried.
3. **SDK and CLI (TypeScript):** build salted Merkle trees off-chain, let a
   holder reveal chosen claims with proofs, and verify those proofs against the
   on-chain root and the credential's status.

Claim data and salts never touch the ledger.

## What it is not

- Not a W3C DID method. Identra IDs are registry identifiers, not `did:`
  identifiers.
- No zero-knowledge proofs. Selective disclosure uses standard Merkle proofs.
- Not audited.

## Prior art

This is a crowded space. See [docs/PRIOR_ART.md](docs/PRIOR_ART.md) for what
other tools do and do not do, and how Identra differs.

## Getting started

Not runnable yet. This section is filled in when the SDK and CLI land.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
