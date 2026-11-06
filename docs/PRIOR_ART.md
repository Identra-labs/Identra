# Prior Art

Researched November 2026. For each project I opened its GitHub README and
public contract interface listing (no implementation source was read or copied).
The page URL actually fetched is noted in the "Verified by opening" column.

| Project | URL | What it does (from its README) | What it does NOT do | Last commit | Verified by opening |
|---|---|---|---|---|---|
| ACTA-Team/contracts-acta and ACTA's did-stellar | https://github.com/ACTA-Team/contracts-acta | Two Soroban contracts live on mainnet. `did-stellar-registry` stores a full `DidRecord` per DID on-chain and implements the `did:stellar` method. `vc-vault` deploys a single-tenant vault contract per holder via a factory; stores full VC data inside the vault; supports issue, batch-issue, revoke, push/receive, verify, and list. Charges 1 USDC per credential issued on mainnet. TypeScript SDK (`acta-credentials`) wraps these contracts for React apps. | Does **not** use a Merkle root for selective disclosure. VC content is stored whole inside vault contracts, not as a single hash or root. No off-chain salted-proof generation. Uses `did:stellar` — a method Identra deliberately avoids. | 2026-08-11 (SHA 282fe47) | https://github.com/ACTA-Team/contracts-acta (README + contract function table) |
| Soroban-Eas/soroban-sas | Not found | The repository `Soroban-Eas/soroban-sas` returned HTTP 404. No public repo exists at that URL. | — | not found | https://github.com/Soroban-Eas/soroban-sas (404) |
| Haroldwonder/TrustLink | https://github.com/Haroldwonder/TrustLink | Soroban attestation contract and TypeScript SDK. Authorised issuers create, import, manage, and revoke attestations about wallet addresses. Supports expiry, pagination, cross-chain bridge import, configurable fees, and events. Pre-audit. | Attestations are flat records tied to wallet addresses, not structured credentials with selective disclosure. No Merkle root or off-chain proof generation. No claim schema registry. | 2026-10-27 (SHA c5b9b49) | https://github.com/Haroldwonder/TrustLink (README) |
| Lafiya-xyz/Lafiya-contract | https://github.com/Lafiya-xyz/Lafiya-contract | Two Soroban contracts for a health-record system in Nigeria: `attester-registry` (admin allowlist of licensed health workers) and `attestation-registry` (records that an allowlisted attester verified a health record commitment — stores only an opaque hash, never health data). USDC micro-payment rails for community health workers. | The hash-only on-chain footprint is superficially similar to Identra, but the hash is a full-record commitment, not a Merkle root of individual claims. No selective-disclosure layer, no proof-generation SDK, no credential schema registry. | 2026-10-27 (SHA edebeac) | https://github.com/Lafiya-xyz/Lafiya-contract (README) |
| Kevin737866/stellar-identity-credentials-sdk | https://github.com/Kevin737866/stellar-identity-credentials-sdk | Claims W3C DID (`did:stellar`), VC 2.0, on-chain reputation scoring, zero-knowledge proofs, compliance integration, and 5 Soroban contracts. Interactive CLI and React components. | ZK and selective-disclosure claims were not independently verified by reading contract source. Claims `did:stellar` identity. Complexity far exceeds Identra's scope. | 2026-10-20 (SHA 88217a9) | https://github.com/Kevin737866/stellar-identity-credentials-sdk (README only — implementation not read) |
| Soroban-Identity (El-Chapo-Npm/Soroban-Identity and owohdora-stack/Soroban-Identity) | https://github.com/El-Chapo-Npm/Soroban-Identity and https://github.com/owohdora-stack/Soroban-Identity | Two forks of the same project (owohdora-stack is the earlier fork, El-Chapo-Npm is more recently active). Three Soroban contracts: `identity-registry` (W3C-aligned DID documents linked to Stellar wallets, using `did:stellar:` method), `credential-manager` (issue, revoke, verify credentials; stores full credential data including claims on-chain), and `reputation` (on-chain activity scoring, anti-sybil). Full-stack: TypeScript SDK, React + Freighter frontend. The credential-manager stores the full credential payload (issuer, subject, type, claims, signature) on-chain per `issue_credential`. | Does **not** use a Merkle root for off-chain selective disclosure. Claims are stored whole on-chain. Proofs and roots are not part of the design as described in the README. Uses `did:stellar:` method. Includes a server, analytics indexer, and CDN infrastructure outside Identra's scope. | El-Chapo-Npm: 2026-10-22 (SHA 467c19f); owohdora-stack: 2026-04-24 (SHA ee56984) | https://github.com/El-Chapo-Npm/Soroban-Identity (README + contract function table); https://github.com/owohdora-stack/Soroban-Identity (README) |
| attest.so (daccred/attestprotocol) | https://github.com/daccred/attestprotocol | Enterprise attestation protocol on Stellar (and Solana). Soroban contracts for authority registration, schema registry, and attestation lifecycle. TypeScript SDK and CLI. Stores attestation claims as structured on-chain records. SCF Award recipient. Protocol v2 live on testnet and mainnet. | Does **not** store a Merkle root per credential. Claims are stored in attestation records on-chain. Selective disclosure is not supported. No off-chain proof-generation utilities. | 2026-09-11 (SHA c0c4529) | https://github.com/daccred/attestprotocol (README + architecture section) |
| StellarID | https://stellarid.org | Encrypted on-chain identity for any Stellar address. Identity data (e-mail, phone, address, etc.) stored on-chain encrypted with a user-specified key. Widget-based integration; used by the Afreum ecosystem. | Stores data on-chain even if encrypted. No credential issuance, no Merkle proofs, no schema registry, no structured revocation. Not a credential toolkit — purely an identity-data storage layer. | unknown (no GitHub repo linked from homepage) | https://stellarid.org (homepage) |

## Prior Art Conclusion

The closest overlap with Identra is **Soroban-Identity** (El-Chapo-Npm /
owohdora-stack), which describes selective disclosure of identity data and
credential verification on Soroban. However, based on the README and contract
interface table, Soroban-Identity stores full credential payloads on-chain and
verifies them via an on-chain `verify_credential` function; it does not use an
off-chain Merkle root or off-chain proof generation.

Identra differs from all reviewed projects by:
1. Storing only a **Merkle root** of claims on-chain per credential — no claim
   values ever touch the ledger.
2. Generating salted Merkle proofs **off-chain** in the TypeScript SDK.
3. Verifying those proofs **off-chain** against the on-chain root and a
   caller-supplied status, with no on-chain proof verification step.
4. Not implementing a DID method.

No reviewed project uses this specific combination. Proceed with Spec 2–5.
