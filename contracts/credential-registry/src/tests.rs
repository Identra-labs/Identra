use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Env, InvokeError};

use super::*;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, Address, CredentialRegistryContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let id = env.register(CredentialRegistryContract, ());
    let client = CredentialRegistryContractClient::new(&env, &id);
    client.init(&admin);
    (env, admin, client)
}

fn hash(env: &Env, seed: u8) -> BytesN<32> {
    let mut b = [0u8; 32];
    b[0] = seed;
    BytesN::from_array(env, &b)
}

/// future timestamp relative to env ledger
fn future(env: &Env, secs: u64) -> u64 {
    env.ledger().timestamp() + secs
}

fn contract_err<T: core::fmt::Debug>(
    r: Result<Result<T, impl core::fmt::Debug>, Result<Error, InvokeError>>,
) -> Error {
    match r {
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
    assert_eq!(
        contract_err(client.try_init(&admin)),
        Error::AlreadyInitialized
    );
}

// ── issuer management ─────────────────────────────────────────────────────────

#[test]
fn add_issuer_works() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    client.add_issuer(&issuer);
    // no panic = success
}

#[test]
fn add_issuer_duplicate_fails() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    client.add_issuer(&issuer);
    assert_eq!(
        contract_err(client.try_add_issuer(&issuer)),
        Error::AlreadyIssuer
    );
}

#[test]
fn remove_issuer_works() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    client.add_issuer(&issuer);
    client.remove_issuer(&issuer);
}

#[test]
fn remove_non_issuer_fails() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    assert_eq!(
        contract_err(client.try_remove_issuer(&issuer)),
        Error::NotIssuer
    );
}

#[test]
fn removed_issuer_cannot_issue() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    // add issuer, register a schema, then remove issuer
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    client.remove_issuer(&issuer);
    // issuer no longer approved — issue should fail
    assert_eq!(
        contract_err(client.try_issue(
            &issuer,
            &subject,
            &sid,
            &hash(&env, 9),
            &future(&env, 1000)
        )),
        Error::NotIssuer
    );
}

// ── schema registry ───────────────────────────────────────────────────────────

#[test]
fn register_schema_by_issuer() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    client.add_issuer(&issuer);
    let id = client.register_schema(&issuer, &1, &hash(&env, 1));
    assert_eq!(id, 1);
}

#[test]
fn register_schema_by_admin() {
    let (env, admin, client) = setup();
    let id = client.register_schema(&admin, &1, &hash(&env, 2));
    assert_eq!(id, 1);
}

#[test]
fn register_schema_by_non_issuer_fails() {
    let (env, _, client) = setup();
    let stranger = Address::generate(&env);
    assert_eq!(
        contract_err(client.try_register_schema(&stranger, &1, &hash(&env, 1))),
        Error::NotIssuer
    );
}

#[test]
fn register_schema_ids_increment() {
    let (env, admin, client) = setup();
    let id1 = client.register_schema(&admin, &1, &hash(&env, 1));
    let id2 = client.register_schema(&admin, &2, &hash(&env, 2));
    assert_eq!(id2, id1 + 1);
}

// ── issue ─────────────────────────────────────────────────────────────────────

#[test]
fn issue_returns_id() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(
        &issuer,
        &subject,
        &sid,
        &hash(&env, 10),
        &future(&env, 1000),
    );
    assert_eq!(cid, 1);
}

#[test]
fn issue_record_correct() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let root = hash(&env, 20);
    let exp = future(&env, 2000);
    let cid = client.issue(&issuer, &subject, &sid, &root, &exp);
    let rec = client.get_credential(&cid);
    assert_eq!(rec.issuer, issuer);
    assert_eq!(rec.subject, subject);
    assert_eq!(rec.claims_root, root);
    assert_eq!(rec.expiry, exp);
    assert!(!rec.revoked);
}

#[test]
fn issue_non_issuer_fails() {
    let (env, _, client) = setup();
    let stranger = Address::generate(&env);
    let subject = Address::generate(&env);
    assert_eq!(
        contract_err(client.try_issue(&stranger, &subject, &1, &hash(&env, 1), &future(&env, 100))),
        Error::NotIssuer
    );
}

#[test]
fn issue_expiry_in_past_fails() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    // expiry = now (not strictly future)
    let now = env.ledger().timestamp();
    assert_eq!(
        contract_err(client.try_issue(&issuer, &subject, &sid, &hash(&env, 1), &now)),
        Error::ExpiryInPast
    );
}

#[test]
fn issue_ids_increment() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let subject = Address::generate(&env);
    let c1 = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    let c2 = client.issue(&issuer, &subject, &sid, &hash(&env, 2), &future(&env, 2000));
    assert_eq!(c2, c1 + 1);
}

// ── revoke ────────────────────────────────────────────────────────────────────

#[test]
fn revoke_works() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    client.revoke(&issuer, &cid);
    assert!(client.get_credential(&cid).revoked);
}

#[test]
fn revoke_wrong_issuer_fails() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let other = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    client.add_issuer(&other);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    assert_eq!(
        contract_err(client.try_revoke(&other, &cid)),
        Error::WrongIssuer
    );
}

#[test]
fn revoke_twice_fails() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    client.revoke(&issuer, &cid);
    assert_eq!(
        contract_err(client.try_revoke(&issuer, &cid)),
        Error::AlreadyRevoked
    );
}

#[test]
fn revoke_unknown_cred_fails() {
    let (env, _, client) = setup();
    let addr = Address::generate(&env);
    assert_eq!(
        contract_err(client.try_revoke(&addr, &999)),
        Error::CredentialNotFound
    );
}

// ── status ────────────────────────────────────────────────────────────────────

#[test]
fn status_valid() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 9999));
    assert_eq!(client.status(&cid), CredentialStatus::Valid);
}

#[test]
fn status_revoked() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 9999));
    client.revoke(&issuer, &cid);
    assert_eq!(client.status(&cid), CredentialStatus::Revoked);
}

#[test]
fn status_expired() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let exp = future(&env, 100);
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &exp);
    // advance ledger past expiry
    env.ledger().with_mut(|li| li.timestamp += 200);
    assert_eq!(client.status(&cid), CredentialStatus::Expired);
}

#[test]
fn status_unknown() {
    let (_, _, client) = setup();
    assert_eq!(client.status(&9999), CredentialStatus::Unknown);
}

// ── credentials_of paging ─────────────────────────────────────────────────────

#[test]
fn credentials_of_returns_records() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    client.issue(&issuer, &subject, &sid, &hash(&env, 2), &future(&env, 2000));
    let page = client.credentials_of(&subject, &0, &10);
    assert_eq!(page.len(), 2);
}

#[test]
fn credentials_of_page_cap_enforced() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    // empty subject — should return empty without panicking
    let page = client.credentials_of(&subject, &0, &(PAGE_CAP + 10));
    assert_eq!(page.len(), 0);
    // issue one and request over PAGE_CAP — should still return <= PAGE_CAP
    client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    let page2 = client.credentials_of(&subject, &0, &(PAGE_CAP + 10));
    assert!(page2.len() <= PAGE_CAP);
}

#[test]
fn credentials_of_cursor_paging() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    for i in 0u8..5 {
        client.issue(
            &issuer,
            &subject,
            &sid,
            &hash(&env, i),
            &future(&env, 1000 + i as u64),
        );
    }
    let page1 = client.credentials_of(&subject, &0, &2);
    let page2 = client.credentials_of(&subject, &2, &2);
    let page3 = client.credentials_of(&subject, &4, &2);
    assert_eq!(page1.len(), 2);
    assert_eq!(page2.len(), 2);
    assert_eq!(page3.len(), 1);
}

#[test]
fn credentials_of_empty_subject() {
    let (env, _, client) = setup();
    let nobody = Address::generate(&env);
    assert_eq!(client.credentials_of(&nobody, &0, &10).len(), 0);
}

// ── pause ─────────────────────────────────────────────────────────────────────

#[test]
fn pause_blocks_issue() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    client.pause();
    assert_eq!(
        contract_err(client.try_issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 100))),
        Error::Paused
    );
}

#[test]
fn pause_blocks_revoke() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let cid = client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
    client.pause();
    assert_eq!(
        contract_err(client.try_revoke(&issuer, &cid)),
        Error::Paused
    );
}

#[test]
fn unpause_re_enables_writes() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    client.pause();
    client.unpause();
    client.issue(&issuer, &subject, &sid, &hash(&env, 1), &future(&env, 1000));
}

// ── admin transfer ────────────────────────────────────────────────────────────

#[test]
fn admin_transfer_two_step() {
    let (env, _, client) = setup();
    let new_admin = Address::generate(&env);
    client.propose_admin(&new_admin);
    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn accept_admin_no_proposal_fails() {
    let (_, _, client) = setup();
    assert_eq!(
        contract_err(client.try_accept_admin()),
        Error::NoPendingTransfer
    );
}

// ── TTL / persistence ─────────────────────────────────────────────────────────

#[test]
fn credential_readable_after_ledger_advance() {
    let (env, _, client) = setup();
    let issuer = Address::generate(&env);
    let subject = Address::generate(&env);
    client.add_issuer(&issuer);
    let sid = client.register_schema(&issuer, &1, &hash(&env, 1));
    let root = hash(&env, 42);
    let cid = client.issue(&issuer, &subject, &sid, &root, &future(&env, 99999));
    env.ledger().with_mut(|li| li.sequence_number += 1_000);
    assert_eq!(client.get_credential(&cid).claims_root, root);
}
