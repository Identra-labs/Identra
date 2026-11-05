# identity-registry

Soroban smart contract for wallet-linked identity records.

Stores only a SHA-256 metadata hash per identity. Personal data never touches
the ledger.

## Public functions

| Function | Purpose | Auth required | Errors | Event emitted |
|---|---|---|---|---|
| `init(admin)` | Initialise the registry. One-time call. | `admin` | `AlreadyInitialized` | `RegistryEvent { action: "init" }` |
| `propose_admin(new_admin)` | Start a two-step admin transfer. | current `admin` | `NotInitialized` | `AdminProposeEvent { action: "propose", new_admin }` |
| `accept_admin()` | Complete a two-step admin transfer. | pending admin | `NoPendingTransfer`, `NotInitialized` | `AdminAcceptEvent { action: "accept", old_admin, new_admin }` |
| `pause()` | Pause all writes (reads still work). | current `admin` | `NotInitialized`, `Paused` | `RegistryEvent { action: "pause" }` |
| `unpause()` | Re-enable writes. | current `admin` | `NotInitialized`, `NotPaused` | `RegistryEvent { action: "unpause" }` |
| `create_identity(owner, metadata_hash)` | Create an identity; one per address. Returns `id`. | `owner` | `Paused`, `NotInitialized`, `AlreadyHasIdentity` | `IdentityCreateEvent { action: "create", id, owner, metadata_hash }` |
| `update_metadata(owner, new_hash)` | Replace the metadata hash on an active identity. | `owner` | `Paused`, `OwnerNotFound`, `IdentityNotFound`, `NotActive` | `IdentityUpdateEvent { action: "update", id, owner, new_hash }` |
| `deactivate(owner)` | Deactivate an active identity. | `owner` | `Paused`, `OwnerNotFound`, `IdentityNotFound`, `NotActive` | `IdentityStateEvent { action: "deact", id, owner }` |
| `reactivate(owner)` | Reactivate a deactivated identity. | `owner` | `Paused`, `OwnerNotFound`, `IdentityNotFound`, `AlreadyActive` | `IdentityStateEvent { action: "react", id, owner }` |
| `get_identity(id)` | Fetch an `IdentityRecord` by id. Readable when paused. | none | `IdentityNotFound` | — |
| `identity_of(owner)` | Fetch the identity id for an owner address. Readable when paused. | none | `OwnerNotFound` | — |
| `get_admin()` | Return the current admin address. | none | `NotInitialized` | — |

## Error codes

| Code | Value | Meaning |
|---|---|---|
| `AlreadyInitialized` | 1 | `init` called more than once |
| `NotInitialized` | 2 | Registry not yet initialised |
| `Unauthorized` | 3 | Reserved for future use |
| `Paused` | 4 | Registry is paused; write blocked |
| `NotPaused` | 5 | `unpause` called when not paused |
| `AlreadyHasIdentity` | 6 | Owner already has an identity |
| `IdentityNotFound` | 7 | No identity for the given id |
| `OwnerNotFound` | 8 | No identity for the given owner address |
| `NotActive` | 9 | Identity is not active |
| `AlreadyActive` | 10 | Identity is already active |
| `NoPendingTransfer` | 11 | `accept_admin` called with no pending proposal |

## Storage

- `instance`: `Admin`, `PendingAdmin`, `Paused`, `NextId` — shared contract state, TTL extended on every write (~7-day target).
- `persistent`: `Identity(id)`, `OwnerIndex(owner)` — per-identity records, TTL extended on every read or write (~30-day target).

## Notes

- Only hashes are stored. No names, emails, or other personal data.
- Pausing blocks all write functions but not reads — callers can always resolve an identity.
- Admin transfer is two-step to prevent accidental lockout.
