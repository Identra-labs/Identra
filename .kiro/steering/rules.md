---
inclusion: always
---

# Rules for this project

- Write all code and text originally. Do not read, copy or adapt other
  projects' source code. Reading READMEs and public interfaces for prior art is
  allowed.
- Never rely on memory for Soroban, soroban-sdk, Stellar CLI or Stellar SDK
  behavior. Verify against official docs or the pinned version's source and
  record findings with links in docs/SOROBAN_NOTES.md.
- Pin exact versions of Rust, soroban-sdk, Node and every dependency. Never use
  "latest". Record choices and reasons in docs/DECISIONS.md.
- Contracts: no unwrap() or expect(); explicit error enums; require_auth on
  every privileged function; events for every state change; extend TTL for
  entries that must persist; hard caps on every paged or looped operation.
- Never store personal data, claim values or salts on-chain. Hashes and roots
  only.
- No custom cryptography. Use standard, documented primitives only. Make no
  zero-knowledge claims.
- No secrets, keys or real personal data anywhere in the repo, logs or tests.
  The CLI must use named identities and never accept or print secret keys.
- No source file over 600 lines.
- Do not put unbuilt features in the README. Keep docs/ROADMAP.md accurate.
- Small, meaningful commits, one per logical step.
- Before saying a task is done, run the relevant format, lint, typecheck, test
  and build commands and show the real output.
- If you could not run or verify something, say so plainly. Never claim success
  you did not observe.
- Do not delete or rewrite existing README, LICENSE, CONTRIBUTING, SECURITY,
  templates or CI unless a task says to.
- Work on one spec at a time. Do not start the next one.
- Do not create a server, analytics service, frontend, mobile app or browser
  extension in this repository.
