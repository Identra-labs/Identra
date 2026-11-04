# Soroban Notes

Verified November 2026 against official Stellar developer documentation and
crates.io metadata. All links are live-checked.

---

## 1. Pinned versions

| Item | Version | Source |
|---|---|---|
| soroban-sdk | `29.0.1` | https://crates.io/crates/soroban-sdk |
| stellar-cli | `30.0.1` | https://crates.io/crates/stellar-cli |
| Rust toolchain | `1.93.0` | Minimum required by stellar-cli 30.0.1 (crates.io field `rust_version`) |
| Wasm build target | `wasm32v1-none` | https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world |
| Node.js LTS | `26.13.0` | https://nodejs.org/dist/index.json (`lts: "Lithium"`) |

**Key build constraint:** soroban-sdk ≥ 28 requires `stellar contract build`,
not raw `cargo build`. Running `cargo build --target wasm32v1-none --release`
directly will fail with an error message. `cargo test` (native, not Wasm) is
unaffected and runs without stellar-cli.

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world

---

## 2. Storage types and TTL extension

Source: https://developers.stellar.org/docs/learn/encyclopedia/storage/state-archival

Three storage types accessed via `env.storage()`:

| Type | API | On TTL = 0 | Restored? | Limit | Use for |
|---|---|---|---|---|---|
| `instance()` | `env.storage().instance()` | Archived | Auto-restored with contract | Limited | Admin, small shared config |
| `persistent()` | `env.storage().persistent()` | Archived | Auto-restored (Protocol 23+) | Unlimited | User data — identity/credential records |
| `temporary()` | `env.storage().temporary()` | **Deleted forever** | Never | Unlimited | Time-bounded / easily recreatable data |

TTL extension syntax (soroban-sdk 29.x, same as prior versions):

```rust
// Instance — one call extends all instance entries and the contract itself
env.storage().instance().extend_ttl(low_watermark_ledgers, extend_to_ledgers);

// Persistent — each key extended individually
env.storage().persistent().extend_ttl(&key, low_watermark_ledgers, extend_to_ledgers);
```

Identity and credential records use `persistent()` storage so they survive
archival and can be restored. Admin config uses `instance()`.

---

## 3. require_auth

Source: https://developers.stellar.org/docs/build/guides/auth

```rust
// Must be called before any privileged mutation
addr.require_auth();
```

- `Address::require_auth()` verifies that the Stellar auth framework has a valid
  signed entry for `addr` in the current invocation.
- Works for wallet accounts (`G…`) and contract accounts (`C…`).
- Must be the first operation in any function that mutates privileged state.

---

## 4. Events

Source: https://developers.stellar.org/docs/learn/encyclopedia/contract-development/events

```rust
env.events().publish(
    (symbol_short!("identity"), symbol_short!("create")),  // topics tuple
    (id, owner.clone()),                                    // data
);
```

- Topics: tuple up to 4 values; convention is contract-tag + action name.
- `symbol_short!` accepts strings ≤ 9 characters.
- Data: any `IntoVal<Env, Val>` value.

---

## 5. Custom error enums

```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized     = 2,
    Unauthorized       = 3,
    // ...values must be unique u32 literals
}
```

- Annotated with `#[contracterror]`.
- Return `Result<T, Error>` from contract functions — never `unwrap()`, `expect()`, or `panic!()`.
- The error enum is included in the contract spec and visible to SDK clients.

---

## 6. SHA-256 in the contract environment

```rust
// Returns BytesN<32>
let hash: soroban_sdk::BytesN<32> = env.crypto().sha256(&input_bytes);
```

- Input: `soroban_sdk::Bytes`
- Output: `BytesN<32>`
- Available in soroban-sdk 29.x with no extra features.
- Source: https://docs.rs/soroban-sdk/29.0.1/soroban_sdk/struct.Env.html (`crypto()`)

All hashes stored on-chain (`metadata_hash`, `schema_hash`, `claims_root`) are
typed as `BytesN<32>`.

---

## 7. Cross-contract calls

Source: https://developers.stellar.org/docs/build/smart-contracts/example-contracts/deployer

```rust
// Import the callee's contract spec (in Cargo.toml as a dependency or via contractimport!)
let client = identity_registry::Client::new(&env, &registry_address);
let identity = client.get_identity(&id);
```

- Callee spec imported via `contractimport!` macro or by adding the crate as a
  dependency.
- For read-only cross-contract calls (credential registry → identity registry)
  no auth propagation is needed — the callee just reads state.
- In tests: both contracts are registered in the same `Env`; client calls work
  normally without network RPC.

---

## 8. Contract size limit

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world

- Maximum Wasm size: **128 KB** on mainnet (a network-configurable value).
- `stellar contract build` optimises the Wasm by default — no separate step needed.
- Workspace `Cargo.toml` release profile uses `opt-level = "z"`, `lto = true`,
  `codegen-units = 1` for minimal size.

---

## 9. Building Wasm

```bash
# Build all contracts (outputs target/wasm32v1-none/release/<name>.wasm)
stellar contract build

# Build one contract
stellar contract build --package identity-registry

# Run unit tests (native, does not require wasm target or stellar-cli)
cargo test --workspace
```

Install stellar-cli: `cargo install --locked stellar-cli --version 30.0.1`

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world

---

## 10. TypeScript bindings generation

Source: https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world-frontend

```bash
# Requires a deployed contract ID; run after Spec 2/3 contracts are on testnet
npx @stellar/stellar-sdk generate \
  --contract-id C...  \
  --output-dir packages/identity-registry-bindings \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Alternatively, read the spec from a local wasm file (no deployment needed)
npx @stellar/stellar-sdk generate \
  --wasm target/wasm32v1-none/release/identity_registry.wasm \
  --output-dir packages/identity-registry-bindings
```

The generated package exports a typed `Client` class with one async method per
contract function. It is generated in Spec 4 after both contracts compile.

---

## 11. Test registration API (soroban-sdk 29.x)

The v22-era `env.register_contract(None, ContractType)` is removed.
Use `env.register(ContractType, ())` in tests:

```rust
#[test]
fn example() {
    let env = Env::default();
    let id = env.register(MyContract, ());  // second arg = constructor args, () if none
    let client = MyContractClient::new(&env, &id);
    assert_eq!(client.some_fn(), expected);
}
```

Source: https://docs.rs/soroban-sdk/29.0.1/soroban_sdk/struct.Env.html
(method `register` — "Register a contract with the Env for testing")

---

## 12. Summary — confirmed vs. unverified

| Item | Status | Notes |
|---|---|---|
| soroban-sdk 29.0.1 is current stable | ✅ | crates.io API, `max_stable_version` field |
| stellar-cli 30.0.1 is current stable | ✅ | crates.io API, `max_stable_version` field |
| Rust minimum 1.93.0 (from stellar-cli) | ✅ | crates.io `rust_version` field on stellar-cli 30.0.1 |
| Build target wasm32v1-none | ✅ | Official hello-world guide |
| soroban-sdk ≥ 28 needs stellar contract build | ✅ | Official hello-world guide |
| Storage types and TTL extension syntax | ✅ | Official state-archival encyclopedia |
| require_auth usage | ✅ | Official auth guide |
| Events API | ✅ | Official events encyclopedia |
| SHA-256 via env.crypto().sha256() | ✅ | docs.rs soroban-sdk 29.0.1 Env struct |
| env.register(T, ()) test API (v29) | ✅ | docs.rs soroban-sdk 29.0.1 Env struct |
| Node.js 26.13.0 is current LTS | ✅ | nodejs.org/dist/index.json |
| cargo test passes on this machine | ⚠️ | Rust not yet installed — must be verified by you |
| npm commands pass on this machine | ⚠️ | Node not yet installed — must be verified by you |
