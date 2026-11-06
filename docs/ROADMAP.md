# Roadmap

Nothing below is done until its box is checked and the work is merged.

- [ ] **Spec 1: Prior art, SDK/Soroban verification, scaffold** — files written
  with correct pinned versions (soroban-sdk 29.0.1, Rust 1.93.0, Node 26.13.0);
  commands must be run locally to verify (Rust and Node not yet installed on
  build machine).
- [x] **Spec 2: Identity registry contract and tests** — 12 functions, 32 tests, `cargo fmt`, `clippy -D warnings`, `cargo test --workspace` all pass.
- [x] **Spec 3: Credential registry contract and tests** — 15 functions, 34 tests, all passing.
- [x] **Spec 4: SDK (bindings wrapper, Merkle utilities, verifyDisclosure)** — 46 SDK tests + 1 CLI test = 47 passing. Merkle tree, proofs, verifyDisclosure all implemented and tested.
- [x] **Spec 5: CLI, docs, threat model, final checks** — CLI 6 commands + 28 tests. ARCHITECTURE.md, THREAT_MODEL.md, LIMITATIONS.md, README quickstart all written.

After approval: a separate `identra-web` repository for a verifier and issuer UI.
