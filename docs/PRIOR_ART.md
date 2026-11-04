# Prior Art

Researched November 2026. For each project I opened its GitHub README and
public contract interface listing (no implementation source was read or copied).
The page URL actually fetched is noted in the "Verified by opening" column.

| Project | URL | What it does (from its README) | What it does NOT do | Last commit | Verified by opening |
|---|---|---|---|---|---|
| ACTA-Team/contracts-acta and ACTA's did-stellar | https://github.com/ACTA-Team/contracts-acta | Two Soroban contracts live on mainnet. `did-stellar-registry` stores a full `DidRecord` per DID on-chain and implements the `did:stellar` method. `vc-vault` deploys a single-tenant vault contract per holder via a factory; stores full VC data inside the vault; supports issue, batch-issue, revoke, push/receive, verify, and list. Charges 1 USDC per credential issued on mainnet. TypeScript SDK (`acta-credentials`) wraps these contracts for React apps. | Does **not** use a Merkle root for selective disclosure. VC content is stored whole inside vault contracts, not as a single hash or root. No off-chain salted-proof generation. Selective disclosure is not documented. Uses `did:stellar` — a method Identra deliberately avoids. | 2026-08-11 (SHA 282fe47) | https://github.com/ACTA-Team/contracts-acta (README + contract function table) |
| Soroban-Eas/soroban-sas | No public repository found at that exact org/name at time of research | — | — | not found | Searched GitHub; no matching repo located |
| Haroldwonder/TrustLink | https://github.com/Haroldwonder/TrustLink | Soroban attestation contract and TypeScript SDK. Authorised issuers create, import, manage, and revoke attestations about wallet addresses. Supports expiry, pagination, cross-chain bridge import, configurable fees, and events. Pre-audit. | Attestations are flat records tied to wallet addresses, not structured credentials with selective disclosure. No Merkle root or off-chain proof generation. No claim schema registry. | 2026-10-27 (SHA c5b9b49) | https://github.com/Haroldwonder/TrustLink (README) |
| Lafiya-xyz/Lafiya-contract | https://github.com/Lafiya-xyz/Lafiya-contract | Two Soroban contracts for a health-record system in Nigeria: `attester-registry` (admin allowlist of licensed health workers) and `attestation-registry` (records that an allowlisted attester verified a health record commitment — stores only an opaque hash, never health data). USDC micro-payment rails for community health workers. | The hash-only on-chain footprint is superficially similar to Identra, but the hash is a full-record commitment, not a Merkle root of individual claims. No selective-disclosure layer, no proof-generation SDK, no credential schema registry. | 2026-10-27 (SHA edebeac) | https://github.com/Lafiya-xyz/Lafiya-contract (README) |
| Kevin737866/stellar-identity-credentials-sdk | https://github.com/Kevin737866/stellar-identity-credentials-sdk | Claims W3C DID (`did:stellar`), VC 2.0, on-chain reputation scoring, zero-knowledge proofs, compliance integration, and 5 Soroban contracts. Interactive CLI and React components. | ZK and selective-disclosure claims are not independently verified; the project shows signs of AI-generated scaffolding with aspirational feature descriptions. Claims `did:stellar` identity (not Identra's design). Complexity far exceeds Identra's scope. | 2026-10-20 (SHA 88217a9) | https://github.com/Kevin737866/stellar-identity-credentials-sdk (README only — implementation not read) |
| Soroban-Identity project | No single canonical repository found under that name | Several independent Soroban projects register wallet-linked handles or identity records on-chain under various names | None of the located projects combine an identity registry + credential registry + Merkle selective disclosure SDK in one cohesive toolkit | not found | Searched GitHub; no canonical "Soroban-Identity" repo located |
| attest.so (daccred/attestprotocol) | https://github.com/daccred/attestprotocol | Enterprise attestation protocol on Stellar (and Solana). Soroban contracts for authority registration, schema registry, and attestation lifecycle. TypeScript SDK and CLI. Stores attestation claims as structured on-chain records. SCF Award recipient. Protocol v2 live on testnet and mainnet. | Does **not** store a Merkle root per credential. Claims are stored in attestation records on-chain. Selective disclosure is not supported. No off-chain proof-generation utilities. | 2026-09-11 (SHA c0c4529) | https://github.com/daccred/attestprotocol (README + architecture section) |
| StellarID | https://stellarid.org | Encrypted on-chain identity for any Stellar address. Identity data (e-mail, phone, address, etc.) stored on-chain encrypted with a user-specified key. Widget-based integration; used by the Afreum ecosystem. | Stores data on-chain even if encrypted. No credential issuance, no Merkle proofs, no schema registry, no structured revocation. Not a credential toolkit — purely an identity-data storage layer. | unknown (no GitHub repo linked from homepage) | https://stellarid.org (homepage) |

## Prior Art Conclusion

**The "Merkle root only on-chain, salted proofs off-chain" hypothesis is confirmed.**

No project found stores only a Merkle root of claims per credential on-chain,
generates salted leaf proofs entirely off-chain, and verifies those proofs in a
standalone TypeScript SDK that also exposes on-chain credential status.

Closest comparisons and why they differ:
- **Lafiya** — stores a single opaque hash (full-record commitment), not a claim
  tree root. No proof-generation layer.
- **TrustLink** — flat attestations about wallet addresses, no claim structure.
- **ACTA** — full VC data stored inside per-holder vault contracts on-chain.
- **Attest Protocol** — full claim data in on-chain attestation records.
- **stellar-identity-credentials-sdk** — claims selective disclosure via ZK proofs
  but those claims are unverified and use `did:stellar`.

Identra's differentiating combination:
1. Wallet-linked identity record storing only a metadata hash — no DID method,
   no personal data on-chain.
2. Credential registry storing only a Merkle root of claims + schema ID + expiry
   — no claim values on-chain.
3. On-chain issuer allowlist and schema registry.
4. TypeScript SDK that builds salted Merkle trees, generates per-claim proofs,
   and verifies them against the on-chain root and credential status — all
   off-chain.
5. Simple CLI using named Stellar identities — no secret-key handling anywhere.

This exact combination is not present in any of the eight projects reviewed.
