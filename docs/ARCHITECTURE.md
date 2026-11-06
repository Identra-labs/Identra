# Architecture

## Overview

Identra is a monorepo with two Soroban smart contracts and a TypeScript SDK + CLI.

```mermaid
flowchart TD
    subgraph Ledger["Stellar Testnet (on-chain)"]
        IR["identity-registry\n(Soroban contract)\nstores: metadata_hash only"]
        CR["credential-registry\n(Soroban contract)\nstores: claims_root + expiry"]
    end

    subgraph SDK["@identra/sdk (off-chain TypeScript)"]
        M["Merkle utilities\nbuildTree · generateProof\nverifyProof"]
        VD["verifyDisclosure()"]
    end

    subgraph CLI["@identra/cli (off-chain TypeScript)"]
        C["Commands\ncreate-identity · add-issuer\nregister-schema · issue\nrevoke · verify"]
    end

    Issuer -->|"1. build salted claim tree\n(off-chain)"| M
    M -->|"2. Merkle root → claims_root"| CR
    Holder -->|"3. hold claims + salts\n(off-chain)"| M
    Holder -->|"4. reveal chosen claims\n+ proofs to verifier"| VD
    VD -->|"5. caller supplies root + status\n(fetched from chain separately)"| VD
    VD -->|"6. DisclosureResult"| Verifier

    Admin -->|"stellar keys generate"| C
    C -->|"stellar contract invoke"| IR
    C -->|"stellar contract invoke"| CR
```

## Data flow

### Issuing a credential

1. Issuer builds a salted Merkle tree of claims off-chain using `buildTree()`.
2. Issuer records only the Merkle root, schema id, subject, and expiry on-chain via `credential-registry issue()`.
3. Claim values and salts stay off-chain — held by the subject/holder.

### Verifying a selective disclosure

1. Holder selects which claims to reveal and passes their values, salts, and Merkle proofs to the verifier.
2. The verifier independently fetches the on-chain root (`get_credential()`) and status (`status()`) from the credential-registry.
3. The verifier calls `verifyDisclosure()` from the SDK with the revealed data, the fetched root, and the fetched status.
4. The SDK verifies each proof off-chain and returns a `DisclosureResult` with `proofsValid`, `accepted`, and `status`. The SDK does not read from the chain.

## Component responsibilities

| Component | Responsibility |
|---|---|
| `identity-registry` | Wallet-linked identity records (metadata hash only). Admin, pause, two-step admin transfer. |
| `credential-registry` | Issuer allowlist, schema registry, credential issuance (root + expiry), revocation, status queries, paged listing. |
| `@identra/sdk` | Merkle tree construction, proof generation, proof verification, `verifyDisclosure`. Verifies proofs against a root and status supplied by the caller. Does not read from the chain. |
| `@identra/cli` | Prints `stellar contract invoke` commands for each registry operation. Does not execute them. Uses named Stellar identities. No secret key handling. |

## Storage layout

### identity-registry

| Key | Type | Storage | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | Current admin |
| `PendingAdmin` | `Address` | Instance | Proposed admin (two-step) |
| `Paused` | `bool` | Instance | Pause flag |
| `NextId` | `u64` | Instance | Next identity id |
| `Identity(id)` | `IdentityRecord` | Persistent | Full identity record |
| `OwnerIndex(addr)` | `u64` | Persistent | Owner address → identity id |

### credential-registry

| Key | Type | Storage | Description |
|---|---|---|---|
| `Admin` | `Address` | Instance | Current admin |
| `Paused` | `bool` | Instance | Pause flag |
| `NextSchemaId` | `u64` | Instance | Next schema id |
| `NextCredId` | `u64` | Instance | Next credential id |
| `Issuer(addr)` | `bool` | Persistent | Approved issuer flag |
| `Schema(id)` | `SchemaRecord` | Persistent | Schema record |
| `Credential(id)` | `CredentialRecord` | Persistent | Credential record |
| `OwnerCreds(addr)` | `Vec<u64>` | Persistent | Subject → credential id list |
| `IdentityRegistry` | `Address` | Instance | Optional identity registry link |
