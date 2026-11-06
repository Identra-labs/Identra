# credential-registry

Soroban smart contract for issuer-managed verifiable credentials.

Stores only the Merkle root of off-chain claims, the schema id, issuer, subject, and expiry. No claim values ever touch the ledger.

## Public functions

| Function | Purpose | Auth required | Errors | Event emitted |
|---|---|---|---|---|
| `init(admin)` | Initialise the registry. One-time. | `admin` | `AlreadyInitialized` | `RegistryEvent { action: "init" }` |
| `propose_admin(new_admin)` | Start two-step admin transfer. | current `admin` | `NotInitialized` | `AdminProposeEvent` |
| `accept_admin()` | Complete admin transfer. | pending admin | `NoPendingTransfer` | `AdminAcceptEvent` |
| `pause()` | Pause all writes. | current `admin` | `Paused` | `RegistryEvent { action: "pause" }` |
| `unpause()` | Re-enable writes. | current `admin` | `NotPaused` | `RegistryEvent { action: "unpause" }` |
| `add_issuer(issuer)` | Approve an issuer. Admin only. | `admin` | `AlreadyIssuer` | `IssuerEvent { action: "add" }` |
| `remove_issuer(issuer)` | Revoke issuer approval. Admin only. | `admin` | `NotIssuer` | `IssuerEvent { action: "remove" }` |
| `register_schema(caller, version, schema_hash)` | Register a schema. Caller must be admin or approved issuer. Returns schema id. | `caller` | `Paused`, `NotInitialized`, `NotIssuer` | `SchemaEvent { action: "schema" }` |
| `issue(issuer, subject, schema_id, claims_root, expiry)` | Issue a credential. Issuer must be approved. Expiry must be in the future. Returns credential id. | `issuer` | `Paused`, `NotIssuer`, `ExpiryInPast`, `NotInitialized` | `CredentialIssueEvent { action: "issue" }` |
| `revoke(issuer, credential_id)` | Revoke a credential. Only the issuing issuer may revoke. | `issuer` | `Paused`, `CredentialNotFound`, `WrongIssuer`, `AlreadyRevoked` | `CredentialRevokeEvent { action: "revoke" }` |
| `status(credential_id)` | Return `Valid`, `Expired`, `Revoked`, or `Unknown`. Readable when paused. | none | — | — |
| `get_credential(credential_id)` | Fetch a `CredentialRecord`. Readable when paused. | none | `CredentialNotFound` | — |
| `credentials_of(subject, cursor, limit)` | Page through credentials owned by `subject`. Hard cap: `PAGE_CAP` (50) per call. | none | — | — |
| `set_identity_registry(registry)` | Optionally link an identity registry. When set, `issue` will verify the subject has an active identity. Admin only. Requires stellar-cli to build identity-registry wasm first. | `admin` | `NotInitialized` | `RegistryEvent { action: "setidreq" }` |
| `get_admin()` | Return the current admin. | none | `NotInitialized` | — |

## Schema registration: who may register

Admin or any approved issuer. Rationale: schemas are public blueprints; restricting them to admin only would slow issuers down without a security benefit. See `docs/DECISIONS.md`.

## Error codes

| Code | Value | Meaning |
|---|---|---|
| `AlreadyInitialized` | 1 | `init` called twice |
| `NotInitialized` | 2 | Registry not initialised |
| `Paused` | 3 | Write blocked; registry paused |
| `NotPaused` | 4 | `unpause` called when not paused |
| `NotIssuer` | 5 | Caller is not an approved issuer |
| `AlreadyIssuer` | 6 | Address already an issuer |
| `SchemaNotFound` | 7 | No schema for the given id |
| `CredentialNotFound` | 8 | No credential for the given id |
| `AlreadyRevoked` | 9 | Credential already revoked |
| `ExpiryInPast` | 10 | Expiry ≤ current ledger timestamp |
| `WrongIssuer` | 11 | Revoke caller is not the credential's issuer |
| `NoPendingTransfer` | 12 | `accept_admin` with no pending proposal |
| `NotActive` | 13 | Subject identity is inactive (cross-contract check) |
| `SubjectNoIdentity` | 14 | Subject has no identity (cross-contract check) |
