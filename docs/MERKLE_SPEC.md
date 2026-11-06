# Merkle Specification

## Design choices

| Item | Choice | Reason |
|---|---|---|
| Hash function | SHA-256 via `crypto.subtle.digest` | Standard; built into Node.js 20+ and browsers |
| Salt size | 32 bytes | Matches hash output size |
| Leaf encoding | `SHA-256( 0x00 \|\| salt(32) \|\| len4(key) \|\| key_utf8 \|\| len4(value) \|\| value_utf8 )` | Length-prefix eliminates ambiguity between keys and values that contain colons or multi-byte characters |
| Leaf prefix | `0x00` | Domain separation from node hashes |
| Node prefix | `0x01` | Domain separation from leaf hashes |
| Odd leaf count | Duplicate the last leaf | Deterministic; no padding changes the root strategy |
| Leaf ordering | Sorted by UTF-8 byte representation of key (lexicographic on encoded bytes) | Deterministic regardless of insertion order; handles non-ASCII correctly |
| Duplicate keys | Rejected with an error | Prevents ambiguous trees |
| Root encoding | 32-byte `Uint8Array`, hex string for display | Matches `BytesN<32>` on-chain |

## Canonical leaf hash

```
len4(x)   = 4-byte big-endian uint32 encoding of the byte length of x

leaf_hash = SHA-256(
  0x00
  || salt_bytes(32)
  || len4(key_utf8)  || key_utf8
  || len4(value_utf8) || value_utf8
)
```

## Canonical node hash

```
node_hash = SHA-256( 0x01 || left_child_hash(32) || right_child_hash(32) )
```

## Test vectors

Exact hex values are asserted via snapshot in `packages/sdk/src/index.test.ts`
(the "known vector: zero salt, age=30" test). Any change to the leaf encoding
will cause that snapshot to fail, making encoding drift visible immediately.

### Single claim (conceptual)

Input: `{ age: "30" }`, salt: 32 zero bytes

```
key_bytes   = UTF-8("age")   = [61 67 65]        (3 bytes)
value_bytes = UTF-8("30")    = [33 30]            (2 bytes)
leaf_input  = [00]                                 (leaf prefix)
              [00 00 ... 00]                       (32-byte zero salt)
              [00 00 00 03] [61 67 65]             (len4(3) + "age")
              [00 00 00 02] [33 30]                (len4(2) + "30")
root = SHA-256(leaf_input)
```

### Two claims (conceptual)

Input: `{ age: "30", name: "Alice" }`, both salts 32 zero bytes.
Sorted order: `age` < `name` (UTF-8 bytes).

```
leaf_age  = SHA-256( 0x00 || 00..00(32) || len4(3) || "age"   || len4(2) || "30" )
leaf_name = SHA-256( 0x00 || 00..00(32) || len4(4) || "name"  || len4(5) || "Alice" )
root      = SHA-256( 0x01 || leaf_age || leaf_name )
```

## Proof format

A proof for a leaf is the ordered list of sibling hashes from leaf to root, each with a direction bit:

```typescript
type ProofStep = { sibling: Uint8Array; isLeft: boolean };
type MerkleProof = ProofStep[];
```

`isLeft: true` means the sibling is on the LEFT (the current node is the right child).

## verifyDisclosure inputs / outputs

The caller must supply the on-chain root and status. The SDK does not read from
the Stellar network.

```typescript
verifyDisclosure(
  revealedClaims: Record<string, string>,
  salts:          Record<string, Uint8Array>,
  proofs:         Record<string, MerkleProof>,
  onChainRoot:    Uint8Array,       // 32-byte root — caller fetches from contract
  status:         CredentialStatus, // caller fetches from contract
) => Promise<DisclosureResult>
```

```typescript
type DisclosureResult = {
  proofsValid:  boolean;           // all proofs verified against the root
  accepted:     boolean;           // proofsValid && keys.length > 0 && status === "Valid"
  status:       CredentialStatus;
  failedClaims: string[];
};
```
