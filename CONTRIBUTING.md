# Contributing

Thanks for helping out. This project accepts funded contributions through
Drips Wave, and plain contributions at any time.

## Picking up work
- Each issue lists scope, acceptance criteria, files to touch, dependencies and
  a complexity tier (Trivial, Medium, High).
- For Wave issues, apply through the Drips Wave app and wait to be assigned.
  For other issues, comment that you are taking it.
- Link your pull request with `Closes #<number>`.
- If you get stuck, say so on the issue so it can be reassigned.

## Local setup
Rust and Node versions are pinned in `rust-toolchain.toml` and `.nvmrc` once
the setup milestone lands. Before opening a PR run:

```
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run lint && npm run typecheck && npm test
```

## Standards
- Contracts: no `unwrap()` or `expect()`; typed errors; auth on every
  privileged function; no personal data on-chain.
- No custom cryptography. Use standard, documented primitives only.
- No secrets, keys or real personal data in the repo or in tests.
- Add tests for behavior you change. Keep PRs focused on one issue.
- Do not guess Soroban or SDK behavior. Check the pinned version's docs or
  source and say what you verified in the PR.

## Security
Report vulnerabilities privately; see SECURITY.md. Do not open public issues
for them.
