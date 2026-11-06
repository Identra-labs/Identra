# Merkle Specification

## Design choices

| Item | Choice | Reason |
|---|---|---|
| Hash function | SHA-256 (via Web Crypto `crypto.subtle.digest`) | Standard, available in all Node.js 20+ and browser environments without extra dependencies |
| Salt size | 32 bytes (256 bits) | Matches the hash output size; provides sufficient pre-image resistance |
| Leaf encoding | `SHA-256( salt ‖ key_utf8 ‖ ":" ‖ value_utf8 )` where `‖` is byte concatenation | Canonical; key and value are length-prefixed by the colon separator pattern |
| Leaf prefix byte | `0x00` prepended before hashing a leaf pair | Domain separation between leaf and node hashes (standard binary Merkle tree practice) |
| Node prefix byte | `0x01` prepended before hashing two children | Domain separation |
| Odd leaf count | Duplicate the last leaf | Deterministic; never changes the root based on padding strategy |
| Leaf ordering | Sorted by claim key (UTF-8 lexicographic) before tree construction | Deterministic tree regardless of insertion order; required for reproducible roots |
| Root encoding | 32-byte `Uint8Array`, hex string for display | Matches `BytesN<32>` on-chain |

## Canonical leaf hash

```
leaf_hash = SHA-256( 0x00 || salt_bytes(32) || key_bytes || ':' || value_bytes )
```

## Canonical node hash

```
node_hash = SHA-256( 0x01 || left_child_hash(32) || right_child_hash(32) )
```

## Test vectors

These vectors are computed by the SDK's own implementation and must match on every run.

### Single claim

Input: `{ age: "30" }`, salt: `0x00...00` (32 zero bytes)

```
leaf  = SHA-256( 0x00 || 00..00(32) || "age" || ":" || "30" )
root  = leaf   (single-node tree — no node hash needed)
```

### Two claims

Input: `{ age: "30", name: "Alice" }` (sorted: age, name), both salts `0x00..00`

```
leaf_age  = SHA-256( 0x00 || 00..00(32) || "age"  || ":" || "30"    )
leaf_name = SHA-256( 0x00 || 00..00(32) || "name" || ":" || "Alice" )
root      = SHA-256( 0x01 || leaf_age || leaf_name )
```

Exact hex values computed and asserted in `packages/sdk/src/merkle.test.ts`.

## Proof format

A proof for a leaf is the ordered list of sibling hashes from leaf to root, with a direction bit:

```typescript
type ProofStep = { sibling: Uint8Array; isLeft: boolean };
type MerkleProof = ProofStep[];
```

`isLeft: true` means the sibling is on the LEFT (the current node is on the right).

## verifyDisclosure inputs / outputs

```typescript
verifyDisclosure(
  credentialId: bigint,
  revealedClaims: Record<string, string>,
  salts: Record<string, Uint8Array>,      // one salt per revealed claim
  proofs: Record<string, MerkleProof>,    // one proof per revealed claim
  onChainRoot: Uint8Array,                // 32-byte root from the contract
  status: CredentialStatus,               // from contract status()
) => DisclosureResult
```

```typescript
type DisclosureResult = {
  valid: boolean;
  status: CredentialStatus;
  failedClaims: string[];   // claim keys whose proofs did not verify
};
```
