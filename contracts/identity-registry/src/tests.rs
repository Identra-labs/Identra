use soroban_sdk::testutils::{Address as _, Events, Ledger};
use soroban_sdk::{Env, InvokeError};

use super::*;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, IdentityRegistryContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(IdentityRegistryContract, ());
    let client = IdentityRegistryContractClient::new(&env, &id);
    client.init(&admin);
    (env, admin, client)
}

fn hash(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

/// Extract the contract Error from a try_ call that is expected to fail.
/// try_ returns Result<Result<T, ConvErr>, Result<ContractError, InvokeError>>.
/// On a contract Err, the outer result is Err(Ok(ContractError)).
fn contract_err<T: core::fmt::Debug>(
    result: Result<Result<T, impl core::fmt::Debug>, Result<Error, InvokeError>>,
) -> Error {
    match result {
        Err(Ok(e)) => e,
        other => panic!("expected contract error, got {:?}", other),
    }
}

// ── init ──────────────────────────────────────────────────────────────────────

#[test]
fn init_sets_admin() {
    let (_, admin, client) = setup();
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn init_double_fails() {
    let (_, admin, client) = setup();
    let err = contract_err(client.try_init(&admin));
    assert_eq!(err, Error::AlreadyInitialized);
}

// ── create_identity ───────────────────────────────────────────────────────────

#[test]
fn create_identity_returns_id_1() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    assert_eq!(client.create_identity(&owner, &hash(&env, 1)), 1);
}

#[test]
fn create_identity_record_is_correct() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let h = hash(&env, 2);
    let id = client.create_identity(&owner, &h);
    let rec = client.get_identity(&id);
    assert_eq!(rec.owner, owner);
    assert_eq!(rec.metadata_hash, h);
    assert!(rec.active);
}

#[test]
fn create_identity_id_increments() {
    let (env, _, client) = setup();
    let id1 = client.create_identity(&Address::generate(&env), &hash(&env, 1));
    let id2 = client.create_identity(&Address::generate(&env), &hash(&env, 2));
    assert_eq!(id2, id1 + 1);
}

#[test]
fn create_identity_duplicate_fails() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    let err = contract_err(client.try_create_identity(&owner, &hash(&env, 2)));
    assert_eq!(err, Error::AlreadyHasIdentity);
}

#[test]
fn create_identity_emits_event() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 3));
    // ContractEvents is not an iterator; use .events() to get the slice
    let events = env.events().all();
    let last = events.events().last().expect("no events");
    // Verify the event was published (presence is enough for the stub test)
    let _ = last;
}

// ── identity_of ───────────────────────────────────────────────────────────────

#[test]
fn identity_of_returns_id() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let id = client.create_identity(&owner, &hash(&env, 1));
    assert_eq!(client.identity_of(&owner), id);
}

#[test]
fn identity_of_unknown_fails() {
    let (env, _, client) = setup();
    let err = contract_err(client.try_identity_of(&Address::generate(&env)));
    assert_eq!(err, Error::OwnerNotFound);
}

// ── get_identity ──────────────────────────────────────────────────────────────

#[test]
fn get_identity_unknown_id_fails() {
    let (_, _, client) = setup();
    let err = contract_err(client.try_get_identity(&999));
    assert_eq!(err, Error::IdentityNotFound);
}

// ── update_metadata ───────────────────────────────────────────────────────────

#[test]
fn update_metadata_changes_hash() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let id = client.create_identity(&owner, &hash(&env, 1));
    let new_h = hash(&env, 99);
    client.update_metadata(&owner, &new_h);
    assert_eq!(client.get_identity(&id).metadata_hash, new_h);
}

#[test]
fn update_metadata_on_inactive_fails() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    let err = contract_err(client.try_update_metadata(&owner, &hash(&env, 2)));
    assert_eq!(err, Error::NotActive);
}

#[test]
fn update_metadata_unknown_owner_fails() {
    let (env, _, client) = setup();
    let err = contract_err(client.try_update_metadata(&Address::generate(&env), &hash(&env, 1)));
    assert_eq!(err, Error::OwnerNotFound);
}

// ── deactivate ────────────────────────────────────────────────────────────────

#[test]
fn deactivate_sets_inactive() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let id = client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    assert!(!client.get_identity(&id).active);
}

#[test]
fn deactivate_already_inactive_fails() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    let err = contract_err(client.try_deactivate(&owner));
    assert_eq!(err, Error::NotActive);
}

#[test]
fn deactivate_unknown_owner_fails() {
    let (env, _, client) = setup();
    let err = contract_err(client.try_deactivate(&Address::generate(&env)));
    assert_eq!(err, Error::OwnerNotFound);
}

#[test]
fn deactivate_emits_event() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    let events = env.events().all();
    assert!(!events.events().is_empty());
}

// ── reactivate ────────────────────────────────────────────────────────────────

#[test]
fn reactivate_sets_active() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let id = client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    client.reactivate(&owner);
    assert!(client.get_identity(&id).active);
}

#[test]
fn reactivate_already_active_fails() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    let err = contract_err(client.try_reactivate(&owner));
    assert_eq!(err, Error::AlreadyActive);
}

// ── pause / unpause ───────────────────────────────────────────────────────────

#[test]
fn pause_blocks_create() {
    let (env, _, client) = setup();
    client.pause();
    let err = contract_err(client.try_create_identity(&Address::generate(&env), &hash(&env, 1)));
    assert_eq!(err, Error::Paused);
}

#[test]
fn pause_blocks_update() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.pause();
    let err = contract_err(client.try_update_metadata(&owner, &hash(&env, 2)));
    assert_eq!(err, Error::Paused);
}

#[test]
fn pause_blocks_deactivate() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.pause();
    let err = contract_err(client.try_deactivate(&owner));
    assert_eq!(err, Error::Paused);
}

#[test]
fn pause_blocks_reactivate() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    client.create_identity(&owner, &hash(&env, 1));
    client.deactivate(&owner);
    client.pause();
    let err = contract_err(client.try_reactivate(&owner));
    assert_eq!(err, Error::Paused);
}

#[test]
fn pause_does_not_block_reads() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let id = client.create_identity(&owner, &hash(&env, 1));
    client.pause();
    // These should not panic
    let _ = client.get_identity(&id);
    let _ = client.identity_of(&owner);
    let _ = client.get_admin();
}

#[test]
fn double_pause_fails() {
    let (_, _, client) = setup();
    client.pause();
    let err = contract_err(client.try_pause());
    assert_eq!(err, Error::Paused);
}

#[test]
fn unpause_re_enables_writes() {
    let (env, _, client) = setup();
    client.pause();
    client.unpause();
    // Should not panic
    client.create_identity(&Address::generate(&env), &hash(&env, 1));
}

#[test]
fn unpause_when_not_paused_fails() {
    let (_, _, client) = setup();
    let err = contract_err(client.try_unpause());
    assert_eq!(err, Error::NotPaused);
}

// ── admin transfer ────────────────────────────────────────────────────────────

#[test]
fn admin_transfer_two_step() {
    let (env, _old_admin, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn accept_admin_without_proposal_fails() {
    let (_, _, client) = setup();
    let err = contract_err(client.try_accept_admin());
    assert_eq!(err, Error::NoPendingTransfer);
}

#[test]
fn propose_admin_emits_event() {
    let (env, _, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    let events = env.events().all();
    assert!(!events.events().is_empty());
}

// ── auth guard ────────────────────────────────────────────────────────────────

#[test]
#[should_panic]
fn propose_admin_without_auth_panics() {
    // Fresh env with NO mock_all_auths — require_auth will panic.
    let env = Env::default();
    let admin = Address::generate(&env);
    let stranger = Address::generate(&env);
    let contract_id = env.register(IdentityRegistryContract, ());
    let client = IdentityRegistryContractClient::new(&env, &contract_id);
    // Init with mocked auth only for init
    env.mock_all_auths();
    client.init(&admin);
    // Now drop mocks; the next call should panic because stranger has no auth
    env.mock_auths(&[]);
    client.propose_admin(&stranger); // panics
}

// ── TTL / persistence ─────────────────────────────────────────────────────────

#[test]
fn identity_readable_after_ledger_advance() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let h = hash(&env, 7);
    let id = client.create_identity(&owner, &h);
    env.ledger().with_mut(|li| li.sequence_number += 1_000);
    assert_eq!(client.get_identity(&id).metadata_hash, h);
}
