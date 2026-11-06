# Decisions

Record choices that affect contributors, with the reason and source.

---

## Project name
"Identra" is free on npm (`npm view identra` returns 404) and not registered
as a GitHub org or crate as of November 2026.

---

## Rust toolchain version: 1.93.0 (Spec 1)

- **Pinned in:** `rust-toolchain.toml`
- **Source:** https://crates.io/crates/stellar-cli (version 30.0.1, field `rust_version: "1.93.0"`)
- **Rationale:** stellar-cli 30.0.1 is the minimum build tool required for
  soroban-sdk ≥ 28 (see below). Its minimum Rust version is 1.93.0, which is
  higher than soroban-sdk 29.0.1's own minimum (1.91.0), so 1.93.0 is the
  controlling floor.
- **Target added:** `wasm32v1-none` — required by soroban-sdk ≥ 28 for Wasm
  compilation; `stellar contract build` manages this target automatically.

## soroban-sdk version: 29.0.1 (Spec 1)

- **Pinned in:** workspace `Cargo.toml`
- **Source:** https://crates.io/crates/soroban-sdk — `max_stable_version: "29.0.1"` as of November 2026
- **Rationale:** Latest stable release. Version 30.0.0-rc.1 exists but is a
  pre-release. 29.0.1 is the highest non-pre-release version.
- **Minimum Rust:** 1.91.0 (per crates.io metadata) — superseded by stellar-cli's 1.93.0 requirement.

## stellar-cli version: 30.0.1 (Spec 1)

- **Source:** https://crates.io/crates/stellar-cli — `max_stable_version: "30.0.1"` as of November 2026
- **Rationale:** soroban-sdk ≥ 28 requires `stellar contract build` (not raw
  `cargo build`) to process the contract spec post-build. stellar-cli 30.0.1 is
  the latest stable version that ships this command.
- **Official doc confirming requirement:**
  https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world
  ("With soroban-sdk 28 or later, running cargo build --target wasm32v1-none
  --release directly fails … always build contracts with stellar contract build")
- **Install:** `cargo install --locked stellar-cli --version 30.0.1`

## Build target: wasm32v1-none (Spec 1)

- **Source:** https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world
- **Note:** `stellar contract build` adds and uses this target automatically.
  `cargo test` runs natively and does not need the Wasm target.

---

## Node.js version: 26.13.0 (Spec 1)

- **Pinned in:** `.nvmrc`
- **Source:** https://nodejs.org/dist/index.json — v26.13.0 is `lts: "Lithium"`,
  the current active LTS line as of November 2026.
- **npm bundled:** 11.20.0 (from Node.js release index)

## TypeScript version: 5.6.3 (Spec 1)

- Latest 5.x stable. Supports `exactOptionalPropertyTypes`, `noUnusedParameters`,
  and all other strict flags used in our tsconfig.

## ESLint version: 9.14.0 (Spec 1)

- Uses flat config format (`eslint.config.mjs`). Version 9 is the current major
  with flat config as default.

## Vitest version: 2.1.4 (Spec 1)

- Vitest 2.x current stable. Used with `vitest run` for single-pass CI execution
  (no watch mode).

## Package manager: npm workspaces (Spec 1)

- npm is bundled with Node; no extra install. Sufficient for this monorepo size.

---

## Merkle tree format (Spec 4)

- **Hash function:** SHA-256 via `crypto.subtle.digest` (Web Crypto API, Node.js 20+ built-in). No external hash library.
- **Salt size:** 32 bytes.
- **Leaf encoding:** `SHA-256(0x00 || salt(32) || len4(key) || key_utf8 || len4(value) || value_utf8)` — 4-byte big-endian length prefix before each field eliminates ambiguity from keys/values containing colons or multi-byte characters.
- **Node encoding:** `SHA-256(0x01 || left(32) || right(32))`.
- **Odd leaf count:** duplicate the last leaf.
- **Leaf ordering:** sorted by UTF-8 byte representation of key (lexicographic on encoded bytes).
- **Duplicate keys:** rejected with an error.
- See `docs/MERKLE_SPEC.md` for full spec and test vectors.

---

## Credential registry: who may register schemas (Spec 3)

**Decision:** admin or any approved issuer may register schemas.
**Rationale:** schemas are public blueprints describing claim structure; they contain no sensitive data. Restricting to admin-only would require an extra round-trip for every issuer onboarding. Any approved issuer is already trusted to issue credentials, so trusting them to register schemas is consistent.

## Cross-contract identity check (removed)

`set_identity_registry` and the `IdentityRegistry` storage key have been
removed from `credential-registry`. The function added complexity without a
testable implementation path (stellar-cli was unavailable to build the wasm).
If cross-contract subject verification is needed, it is a roadmap item.
