# Threat Model

## What is protected

- **Claim privacy.** Claim values and salts never appear on-chain. An on-chain observer sees only the Merkle root, schema id, issuer, subject address, and expiry. They cannot learn any claim value without the holder revealing it.
- **Selective disclosure.** A holder can prove individual claims without revealing others. The verifier learns only the claims the holder chooses to share.
- **Issuer integrity.** Only admin-approved issuers can issue credentials or register schemas. Only the issuing issuer can revoke their own credential.
- **Admin integrity.** Admin transfer is two-step; the new admin must accept before the change takes effect, preventing accidental lockout.
- **Replay resistance.** Merkle proofs are bound to a specific `claims_root` stored on-chain. Reusing a proof against a different root fails verification.
- **Revocation.** Issuers can revoke credentials on-chain. `verifyDisclosure` reports the status supplied by the caller; verifiers are responsible for fetching the current status from the contract before calling it.
- **Denial-of-service by pause.** The admin can pause the registry to block new writes in an emergency, while reads remain available.

## What is NOT protected

- **Subject address linkability.** The subject's Stellar address is stored on-chain per credential. An observer can see how many credentials a given address holds and who issued them.
- **Issuer-subject relationship.** The issuer and subject addresses are both public on-chain.
- **Claim count.** The number of leaves in the tree can sometimes be inferred from the proof length. The salt and claim structure are still hidden.
- **Issuer trust.** Identra does not enforce what claims an issuer makes. A compromised or malicious issuer can issue false credentials. Verifiers must decide which issuers they trust.
- **Off-chain data loss.** If the holder loses their claim values or salts, they cannot produce valid proofs. There is no on-chain recovery mechanism.
- **Front-running.** An attacker who sees a pending `issue` transaction before it lands could potentially front-run it, though this has limited practical impact for credential issuance.

## Assumptions

- The Stellar network and the Soroban runtime behave as specified.
- SHA-256 is collision-resistant for the threat model of this system.
- The admin key is controlled by a trusted party (e.g., a multisig).
- Holders store their claim values and salts securely off-chain.
- Verifiers independently fetch the on-chain root and status; they do not rely solely on the holder's claim.

## Replay and revocation considerations

- A Merkle proof is valid as long as the on-chain root matches. If the issuer wants to invalidate a credential, they must revoke it on-chain.
- `verifyDisclosure` always checks the current on-chain status. A revoked credential will return `status: "Revoked"` even if the proofs are mathematically valid.
- An expired credential (`status: "Expired"`) likewise causes the result to indicate expiry. The proofs still verify, but the credential is no longer valid.
- **Verifiers should reject disclosures where `status !== "Valid"` unless their policy explicitly allows expired/revoked credentials.**

## No zero-knowledge

This system uses standard Merkle proofs, not ZK proofs. Revealed claims are plaintext to the verifier. Do not use Identra where the verifier must not learn the claim value.

## Not audited

This codebase has not been professionally audited. Do not use in production or with real personal data. Testnet only.
