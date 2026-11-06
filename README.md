# Identra

Identity and credential toolkit for Soroban: an identity registry, a credential
registry, and a TypeScript SDK and CLI for issuing credentials and verifying
selectively disclosed claims.

> **Status: pre-alpha, testnet only, not audited.** Do not use with real funds
> or real personal data.

## What it does

1. **Identity registry (contract):** a wallet-linked identity record that holds
   only a metadata hash, never personal data.
2. **Credential registry (contract):** approved issuers record a credential as
   a Merkle root plus an expiry. Credentials can be revoked and their status
   queried.
3. **SDK (`@identra/sdk`):** build salted Merkle trees off-chain, let a holder
   reveal chosen claims with proofs, and verify those proofs against a root and
   status that the caller supplies (fetched independently from the chain).
4. **CLI (`@identra/cli`):** prints `stellar contract invoke` commands for each
   registry operation. Does not execute them. Uses named Stellar identities;
   never handles secret keys.

Claim data and salts never touch the ledger.

## What it is not

- Not a W3C DID method. Identra IDs are registry identifiers, not `did:` URIs.
- No zero-knowledge proofs. Selective disclosure uses standard Merkle proofs.
- Not audited. Testnet only.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the full list.

## Prior art

This is a crowded space. See [docs/PRIOR_ART.md](docs/PRIOR_ART.md) for what
other tools do and how Identra differs.

## Getting started (testnet quickstart)

> **Pre-requisites:** Rust 1.93.0 via rustup, Node.js 26.13.0, stellar-cli 30.0.1.
> This quickstart has not been run end-to-end on testnet or on Windows.
> All steps follow the official Stellar documentation. Report any issue.

### 1. Install tools

```bash
# Rust (if not already installed)
curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.93.0
rustup target add wasm32v1-none

# stellar-cli
cargo install --locked stellar-cli --version 30.0.1

# Node.js: download v26.13.0 from https://nodejs.org
# Then install npm dependencies:
npm install
```

### 2. Configure testnet network

```bash
stellar network add --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

### 3. Create named identities

```bash
stellar keys generate --global admin
stellar keys generate --global issuer1
stellar keys generate --global holder1

# Fund each on testnet (Friendbot)
stellar keys fund admin --network testnet
stellar keys fund issuer1 --network testnet
stellar keys fund holder1 --network testnet
```

### 4. Build and deploy the contracts

```bash
stellar contract build

# Deploy identity-registry
stellar contract deploy \
  --wasm target/wasm32v1-none/release/identity_registry.wasm \
  --source admin --network testnet \
  > /tmp/identity_registry_id.txt

# Deploy credential-registry
stellar contract deploy \
  --wasm target/wasm32v1-none/release/credential_registry.wasm \
  --source admin --network testnet \
  > /tmp/credential_registry_id.txt

export IDENTITY_ID=$(cat /tmp/identity_registry_id.txt)
export CRED_ID=$(cat /tmp/credential_registry_id.txt)
```

### 5. Initialise the registries

```bash
stellar contract invoke --id $IDENTITY_ID \
  --source admin --network testnet \
  -- init --admin $(stellar keys address admin)

stellar contract invoke --id $CRED_ID \
  --source admin --network testnet \
  -- init --admin $(stellar keys address admin)
```

### 6. Register an identity and an issuer

```bash
# holder1 registers an identity (metadata_hash = SHA-256 of your off-chain doc)
HASH=$(node -e "const c=require('crypto');console.log(c.createHash('sha256').update('my-metadata').digest('hex'))")

stellar contract invoke --id $IDENTITY_ID \
  --source holder1 --network testnet \
  -- create_identity \
  --owner $(stellar keys address holder1) \
  --metadata_hash $HASH

# Admin approves issuer1
stellar contract invoke --id $CRED_ID \
  --source admin --network testnet \
  -- add_issuer --issuer $(stellar keys address issuer1)
```

### 7. Register a schema and issue a credential

```bash
SCHEMA_HASH=$(node -e "const c=require('crypto');console.log(c.createHash('sha256').update('schema-v1').digest('hex'))")

stellar contract invoke --id $CRED_ID \
  --source issuer1 --network testnet \
  -- register_schema \
  --caller $(stellar keys address issuer1) \
  --version 1 --schema_hash $SCHEMA_HASH

# Build a salted Merkle tree and get the root (using the SDK)
node -e "
const {buildTree,toHex,randomSalt} = require('./packages/sdk/dist/index.js');
const claims = [
  {key:'age_over_18',value:'true',salt:randomSalt()},
  {key:'country',value:'NG',salt:randomSalt()}
];
buildTree(claims).then(t => {
  console.log('ROOT:' + toHex(t.root));
  // Save claims+salts securely off-chain for the holder
});
"

# Issue the credential (replace ROOT and EXPIRY)
EXPIRY=$(date -d '+1 year' +%s 2>/dev/null || date -v+1y +%s)
stellar contract invoke --id $CRED_ID \
  --source issuer1 --network testnet \
  -- issue \
  --issuer $(stellar keys address issuer1) \
  --subject $(stellar keys address holder1) \
  --schema_id 1 \
  --claims_root <ROOT_HEX> \
  --expiry $EXPIRY
```

### 8. Verify a selective disclosure

```bash
node packages/sdk/src/example-testnet.ts
```

## Project structure

```
contracts/
  identity-registry/   Soroban contract — identity records
  credential-registry/ Soroban contract — credentials + schemas
packages/
  sdk/                 TypeScript Merkle utilities + verifyDisclosure
  cli/                 CLI wrappers for contract calls
docs/
  ARCHITECTURE.md      Component diagram and storage layout
  DECISIONS.md         Version pins and design rationale
  LIMITATIONS.md       What Identra does NOT do
  MERKLE_SPEC.md       Merkle hash spec and test vectors
  PRIOR_ART.md         Comparison with existing projects
  ROADMAP.md           What is built, what is planned
  SOROBAN_NOTES.md     Verified Soroban API notes with doc links
  THREAT_MODEL.md      What is and is not protected
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
