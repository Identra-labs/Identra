# Soroban Notes

Verified November 2026 against official Stellar developer documentation.
All links point to https://developers.stellar.org unless noted.

---

## 1. Rust version and soroban-sdk version (pinned)

**Rust channel:** `1.81.0` (stable)
- Rationale: soroban-sdk v22 and the `wasm32v1-none` target require a recent stable toolchain. 1.81.0 is the last stable release before 1.82 and has no known regressions for Soroban. Pinned in `rust-toolchain.toml`.
- Source: https://github.com/stellar/rs-soroban-sdk/releases (v22.x line) and Protocol 22 upgrade guide https://stellar.org/blog/developers/protocol-22-upgrade-guide

**soroban-sdk:** `22.0.0`
- Rationale: Protocol 22 is live on both Testnet and Mainnet. `v22.0.0` is the stable release matching Protocol 22. `v30.0.0-rc.1` exists but is a pre-release requiring stellar-cli v30 and `wasm32v1-none` target changes not yet widely stable on Windows. Pinned at exactly `22.0.0`.
- Source: https://github.com/stellar/rs-soroban-sdk/releases ; https://github.com/stellar/soroban-examples/releases

> **NOTE:** soroban-sdk ≥ 28 requires building with `stellar contract build` (not raw `cargo build`), as documented at https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world. Version 22 does not have this restriction, but we use `stellar contract build` anyway to stay consistent.

---

## 2. Storage types and TTL extension

Source: https://developers.stellar.org/docs/learn/encyclopedia/storage/state-archival

Three storage types, all accessed via `env.storage()`:

| Type | API | TTL expires | Restored? | Size limit | Use for |
|---|---|---|---|---|---|
| `instance()` | `env.storage().instance()` | Archived | Auto-restored with contract instance | Limited | Admin, small shared config |
| `persistent()` | `env.storage().persistent()` | Archived | Auto-restored (Protocol 23+) or manual | Unlimited | User data (balances, identity records) |
| `temporary()` | `env.storage().temporary()` | **Permanently deleted** | Never | Unlimited | Time-bounded / recreatable data |

**TTL extension syntax:**
```rust
// Instance — extends all instance entries and the contract itself in one call
env.storage().instance().extend_ttl(low_threshold_ledgers, extend_to_ledgers);

// Persistent — each entry extended individually
env.storage().persistent().extend_ttl(&key, low_threshold_ledgers, extend_to_ledgers);

// Temporary — same signature as persistent
env.storage().temporary().extend_ttl(&key, low_threshold_ledgers, extend_to_ledgers);
```

Both `low_threshold_ledgers` and `extend_to_ledgers` are `u32`. The call only triggers an extension when current TTL < `low_threshold_ledgers`.

Identity and credential records must use `persistent()` so they survive archival and can be restored. The admin config lives in `instance()`.

Source: https://developers.stellar.org/docs/build/smart-contracts/example-contracts/storage

---

## 3. require_auth

Source: https://developers.stellar.org/docs/build/guides/auth

```rust
// Require the given address to have authorized this call
addr.require_auth();
```

- `Address::require_auth()` must be called before any privileged state mutation.
- It checks that the Stellar auth framework has a valid entry for the address in the current invocation context.
- Works for both wallet accounts (G…) and contract accounts (C…).
- For cross-contract calls: the *calling* contract must pass auth entries via `env.authorize_as_current_contract(…)` if the callee calls `require_auth` on an address that is not the caller itself.

Source: https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Env.html (authorize_as_current_contract)

---

## 4. Events

Source: https://developers.stellar.org/docs/learn/encyclopedia/contract-development/events

```rust
env.events().publish(
    (symbol_short!("identity"), symbol_short!("create")),  // topics: tuple
    (id, owner.clone()),                                     // data: any Val
);
```

- Topics are a tuple of up to 4 values; conventionally the first is a contract-tag symbol and the second is an action name.
- Data can be any `IntoVal<Env, Val>` type.
- Events are emitted during the host function execution and are visible in the transaction result.
- `symbol_short!` macro creates `Symbol` from strings ≤ 9 chars.

---

## 5. Custom error enums

```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized  = 1,
    NotInitialized      = 2,
    Unauthorized        = 3,
    // ...
}
```

- Annotate with `#[contracterror]`. Values must be unique `u32` literals.
- Return `Result<T, Error>` from contract functions.
- Never `panic!`, `unwrap()`, or `expect()` — return `Err(Error::Variant)` instead.
- The error enum is included in the contract spec and visible to SDK clients.

---

## 6. SHA-256 in the contract environment

`soroban_sdk::Crypto` (accessed via `env.crypto()`) provides SHA-256:

```rust
// Returns BytesN<32>
let hash: soroban_sdk::BytesN<32> = env.crypto().sha256(&input_bytes);
```

- Input is `soroban_sdk::Bytes`.
- Output is `BytesN<32>`.
- Available in soroban-sdk v22 without any extra features.
- Source: https://docs.rs/soroban-sdk/latest/soroban_sdk/struct.Env.html (`crypto()` method)

We use `BytesN<32>` as the canonical type for all hashes stored on-chain (metadata_hash, schema_hash, claims_root).

---

## 7. Cross-contract calls

Source: https://developers.stellar.org/docs/build/smart-contracts/example-contracts/deployer

```rust
// In contract B calling contract A:
let client = identity_registry_contract::Client::new(&env, &identity_registry_address);
let identity = client.get_identity(&id);
```

- The callee's contract spec is imported via `contractimport!` macro or by depending on the crate.
- Auth: if the callee calls `require_auth(addr)` where `addr` is neither the caller contract nor the transaction source, the calling contract must explicitly authorize via `env.authorize_as_current_contract(…)`.
- For Identra's optional cross-contract check (credential registry → identity registry): the credential registry only *reads* the identity status, so no `require_auth` propagation is needed on the identity side.
- **Test support:** in tests, both contracts are registered in the same `Env`; client calls work normally. No network RPC needed for unit tests.

---

## 8. Contract size limits

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world

- Maximum Wasm size: **128 KB** on Mainnet (a configurable network parameter).
- The `stellar contract build` command optimizes the Wasm by default.
- Release profile must include `opt-level = "z"` and `overflow-checks = true` (standard Soroban pattern).
- Each contract is compiled independently; the workspace produces two separate Wasm files.

---

## 9. Building Wasm with the Stellar CLI

```bash
# Build all contracts in the workspace
stellar contract build

# Build a specific contract
stellar contract build --package identity-registry

# Output: target/wasm32v1-none/release/<contract_name>.wasm
```

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world

- Requires `stellar-cli`. Install: `cargo install --locked stellar-cli`.
- For soroban-sdk v22, the `wasm32v1-none` target is used (renamed from `wasm32-unknown-unknown` in later toolchain versions; v22 still uses `wasm32-unknown-unknown` internally but `stellar contract build` handles this).
- `cargo test` for unit tests runs natively (not Wasm), so the `wasm32` target is not needed for `cargo test`.

---

## 10. TypeScript bindings generation

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend

```bash
npx @stellar/stellar-sdk generate \
  --contract-id C...  \
  --output-dir packages/identity-registry-bindings \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

- The generator ships inside `@stellar/stellar-sdk` (v12+).
- It reads the contract spec from the deployed Wasm on-chain and emits a TypeScript npm package.
- The generated package exports a typed `Client` class with one async method per contract function.
- For Spec 1 (scaffold), the contracts are not deployed yet; bindings are generated in Spec 4 after Spec 2 and 3 contracts are deployed to testnet, or the spec XDR can be read from the local Wasm file.
- Alternative for offline use: `stellar contract inspect --wasm <path>.wasm` emits the spec XDR; the SDK generator can consume a local Wasm file with `--wasm` instead of `--contract-id`.

---

## 11. Summary: what is confirmed vs. what is unverified

| Item | Confirmed | Notes |
|---|---|---|
| Storage types and TTL extension syntax | ✅ | From official state-archival docs |
| `require_auth` usage | ✅ | From official auth guide and SDK docs |
| Events API | ✅ | From official events encyclopedia |
| Custom error enums with `#[contracterror]` | ✅ | From SDK docs and examples |
| SHA-256 via `env.crypto().sha256()` → `BytesN<32>` | ✅ | From soroban-sdk Env docs |
| Cross-contract calls via generated client | ✅ | From deployer example |
| Contract size limit (128 KB) | ✅ | From hello-world guide |
| Build via `stellar contract build` | ✅ | From hello-world guide |
| TypeScript bindings via `@stellar/stellar-sdk generate` | ✅ | From frontend guide |
| soroban-sdk 22.0.0 stable on Protocol 22 | ✅ | From release notes and Protocol 22 guide |
| Rust 1.81.0 produces valid contracts with soroban-sdk 22 | ⚠️ | Could not run `cargo build` — Rust not installed on this machine |
| Actual Wasm compile and size | ⚠️ | Cannot verify without Rust installed |
| `cargo test` passes on this machine | ⚠️ | Cannot verify without Rust installed |
