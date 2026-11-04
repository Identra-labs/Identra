# Decisions

Record choices that affect contributors, with the reason.

---

## Project name
"Identra" is free on npm (`npm view identra` returns 404) and not registered as a GitHub org or repo by anyone else as of November 2026.

---

## Rust toolchain version: 1.81.0 (Spec 1)
- Pinned in `rust-toolchain.toml`.
- soroban-sdk v22.0.0 requires a recent stable Rust toolchain. 1.81.0 is stable, has no known regressions for Soroban Wasm compilation, and is available on all major CI runners.
- Recorded in: `docs/SOROBAN_NOTES.md §1`.

## soroban-sdk version: 22.0.0 (Spec 1)
- Protocol 22 is live on Testnet and Mainnet.
- v22.0.0 is the stable, non-pre-release version targeting Protocol 22.
- v30.0.0-rc.1 exists but is a pre-release and changes the build target to `wasm32v1-none`, which is not stable on Windows toolchains. Pinned at exactly `22.0.0`.
- Recorded in: `docs/SOROBAN_NOTES.md §1`.

---

## Node.js version: 20.18.0 (Spec 1)
- Node 20 is the current LTS line.
- 20.18.0 is the last patch of the 20.18 series, stable and available via nvm/setup-node.
- Pinned in `.nvmrc`.

## TypeScript version: 5.6.3 (Spec 1)
- Latest 5.x stable as of November 2026. `exactOptionalPropertyTypes` and `noUnusedParameters` are supported from 5.x.

## ESLint version: 9.14.0 (Spec 1)
- Uses the flat config format (eslint.config.mjs). Version 9 is the current major line with flat config as default.

## Vitest version: 2.1.4 (Spec 1)
- Vitest 2.x is the current stable major; 2.1.4 is the last patch as of November 2026.
- Used for all TypeScript unit tests. Does not require watch mode (`vitest run` for CI).

## Package manager: npm workspaces (Spec 1)
- npm is installed with Node; no additional install step. yarn and pnpm were considered but npm workspaces are sufficient for this monorepo size and avoid extra tooling.

---

## Merkle tree format (Spec 4 — pending)
- Hash function, salt size, leaf encoding, and test vectors to be decided and recorded in Spec 4.
- See `docs/MERKLE_SPEC.md` (created in Spec 4).

---

## Credential registry: who may register schemas (Spec 3 — pending)
- To be decided in Spec 3. Candidates: (a) admin only, (b) any approved issuer, (c) admin or any approved issuer.
