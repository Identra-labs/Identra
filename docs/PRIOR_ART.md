# Prior Art

Verified November 2026 against each project's public README and contract interface listing.

| Project | URL | What it does (per its README) | What it does NOT do | Last commit (approx) | Verified |
|---|---|---|---|---|---|
| ACTA contracts-acta / did-stellar | https://github.com/ACTA-Team/contracts-acta | `did-stellar-registry`: on-chain registry for the `did:stellar` DID method; stores full `DidRecord` per DID; live on mainnet. `vc-vault`: single-tenant credential vault per holder deployed by a factory; stores full VC data on-chain; supports issue, batch-issue, revoke, push/receive, verify, list. Charges 1 USDC per credential on mainnet. | Does NOT use a Merkle root for selective disclosure; VC content is stored in the vault, not as a single root. Off-chain salted proofs are not part of the design. Selective disclosure is not documented. | 2026 (mainnet-v1.0.0, vc-vault v0.4.0) | yes |
| ACTA acta-credentials SDK | https://github.com/ACTA-Team/acta-credentials | React/TypeScript SDK v1.1.0 wrapping the ACTA vault contracts; handles issue, store, verify, revoke, and automatic `did:stellar` issuer onboarding. Non-custodial wallet signing. | No Merkle tree; no selective disclosure utilities; not a standalone credential SDK independent of ACTA vaults. | 2026 | yes |
| TrustLink (Haroldwonder) | https://github.com/Haroldwonder/TrustLink | Soroban attestation contract + TypeScript SDK; authorized issuers create, import, manage and revoke attestations about wallet addresses; cross-chain bridge support; configurable fees; pagination; events; TypeScript SDK included. Testnet, pre-audit. | Attestations are about wallet addresses, not structured credentials with selective disclosure. No Merkle root or off-chain proof generation. | 2025–2026 | yes |
| Lafiya-contract (Lafiya-xyz) | https://github.com/Lafiya-xyz/Lafiya-contract | Two Soroban contracts: `attester-registry` (admin-managed allowlist of health workers) and `attestation-registry` (records that an allowlisted attester verified a record commitment, storing only a hash). Focused on health-record verification in Nigeria. | Hash-only on-chain footprint is similar to Identra, but there is no Merkle selective disclosure layer; the hash is a full-record commitment, not a claim tree root. No credential schema registry. No SDK for proof generation/verification. | 2025–2026 | yes |
| stellar-identity-credentials-sdk (Kevin737866) | https://github.com/Kevin737866/stellar-identity-credentials-sdk | Comprehensive SDK claiming W3C DID (`did:stellar`), VC 2.0, on-chain reputation scoring, zero-knowledge proofs, and compliance integration across 5 Soroban contracts. Interactive CLI and React components. | The ZK and selective-disclosure claims are not independently verified; the project appears to be largely aspirational/AI-generated scaffolding. Claimed features (ZK proofs, VC 2.0, reputation) add significant complexity not present in Identra's simpler scope. | 2025 | yes (README only) |
| Soroban-Identity (various) | No single canonical repo found under that exact name | Several independent Soroban projects register wallet-linked handles or identity records on-chain | None of the located projects combine an identity registry + credential registry + Merkle selective disclosure SDK in a single cohesive toolkit | 2024–2025 | partial |
| attest.so / Attest Protocol (daccred) | https://github.com/daccred/attestprotocol | Enterprise attestation protocol on Stellar (and other chains); Soroban contracts for authority management, schema registry, attestation lifecycle; TypeScript SDK and CLI; stores full claim data in attestations. SCF Award recipient. | Does NOT use Merkle roots or off-chain salted proofs. Claims are stored in attestation records, not as a tree root. Selective disclosure is not supported. | 2026 | yes |
| StellarID (stellarid.org) | https://stellarid.org | Encrypted on-chain identity for any Stellar address; uses a user-specified encryption key; identity data stored on-chain encrypted; widget-based integration; built by and for the Afreum ecosystem. | Data (even if encrypted) is stored on-chain; no credential issuance, no Merkle proofs, no schema registry, no revocation. Not a credential toolkit. | unknown | yes |

## Prior Art Conclusion

**The "Merkle root only on-chain, salted proofs off-chain" hypothesis is confirmed.**

No project reviewed stores only a Merkle root per credential on-chain, generates salted leaf proofs off-chain, and verifies them in a standalone TypeScript SDK that also exposes credential status. The closest designs (Lafiya, TrustLink) store opaque hashes or full attestations but do not build a claim-tree layer. ACTA stores full VC content in per-holder vault contracts. Attest Protocol stores full claim data in attestation records.

Identra's differentiating combination:
1. A wallet-linked identity record (metadata hash only, no DID method).
2. A credential registry that stores only a Merkle root of claims + schema + expiry — no claim values on-chain.
3. An issuer allowlist and schema registry on-chain.
4. A TypeScript SDK that builds and verifies salted Merkle proofs entirely off-chain, then checks the on-chain root and status.
5. Simple CLI using named Stellar identities, no secret-key handling.

This combination is not duplicated by any of the above projects. Proceed with Spec 2.
