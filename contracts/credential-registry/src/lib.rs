#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address,
    BytesN, Env, Symbol, Vec,
};

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Paused,
    Issuer(Address),
    Schema(u64),
    NextSchemaId,
    Credential(u64),
    NextCredId,
    OwnerCreds(Address),
}

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SchemaRecord {
    pub id: u64,
    pub issuer: Address,
    pub version: u32,
    /// SHA-256 of the off-chain schema document.
    pub schema_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CredentialRecord {
    pub id: u64,
    pub issuer: Address,
    pub subject: Address,
    pub schema_id: u64,
    /// Merkle root of the off-chain salted claim tree. No claim values here.
    pub claims_root: BytesN<32>,
    pub expiry: u64,
    pub revoked: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CredentialStatus {
    Valid,
    Expired,
    Revoked,
    Unknown,
}

// ── Error enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Paused = 3,
    NotPaused = 4,
    NotIssuer = 5,
    AlreadyIssuer = 6,
    SchemaNotFound = 7,
    CredentialNotFound = 8,
    AlreadyRevoked = 9,
    ExpiryInPast = 10,
    WrongIssuer = 11,
    NoPendingTransfer = 12,
}

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum credentials returned in one page.
pub const PAGE_CAP: u32 = 50;

const INSTANCE_TTL_LOW: u32 = 14_400;
const INSTANCE_TTL_HIGH: u32 = 100_800;
const PERSIST_TTL_LOW: u32 = 100_800;
const PERSIST_TTL_HIGH: u32 = 432_000;

// ── Events ────────────────────────────────────────────────────────────────────

#[contractevent]
pub struct RegistryEvent {
    #[topic]
    pub action: Symbol,
}

#[contractevent]
pub struct AdminProposeEvent {
    #[topic]
    pub action: Symbol,
    pub new_admin: Address,
}

#[contractevent]
pub struct AdminAcceptEvent {
    #[topic]
    pub action: Symbol,
    pub old_admin: Address,
    pub new_admin: Address,
}

#[contractevent]
pub struct IssuerEvent {
    #[topic]
    pub action: Symbol,
    pub issuer: Address,
}

#[contractevent]
pub struct SchemaEvent {
    #[topic]
    pub action: Symbol,
    pub schema_id: u64,
    pub issuer: Address,
}

#[contractevent]
pub struct CredentialIssueEvent {
    #[topic]
    pub action: Symbol,
    pub credential_id: u64,
    pub issuer: Address,
    pub subject: Address,
    pub schema_id: u64,
}

#[contractevent]
pub struct CredentialRevokeEvent {
    #[topic]
    pub action: Symbol,
    pub credential_id: u64,
    pub issuer: Address,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn require_admin(env: &Env) -> Result<Address, Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    admin.require_auth();
    Ok(admin)
}

fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Paused)
        .unwrap_or(false)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_LOW, INSTANCE_TTL_HIGH);
}

fn bump_key(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSIST_TTL_LOW, PERSIST_TTL_HIGH);
}

fn is_issuer(env: &Env, addr: &Address) -> bool {
    env.storage()
        .persistent()
        .get::<DataKey, bool>(&DataKey::Issuer(addr.clone()))
        .unwrap_or(false)
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CredentialRegistryContract;

#[contractimpl]
impl CredentialRegistryContract {
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextSchemaId, &1u64);
        env.storage().instance().set(&DataKey::NextCredId, &1u64);
        bump_instance(&env);
        RegistryEvent {
            action: symbol_short!("init"),
        }
        .publish(&env);
        Ok(())
    }

    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        require_admin(&env)?;
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        bump_instance(&env);
        AdminProposeEvent {
            action: symbol_short!("propose"),
            new_admin,
        }
        .publish(&env);
        Ok(())
    }

    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .ok_or(Error::NoPendingTransfer)?;
        pending.require_auth();
        let old: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        bump_instance(&env);
        AdminAcceptEvent {
            action: symbol_short!("accept"),
            old_admin: old,
            new_admin: pending,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pause(env: Env) -> Result<(), Error> {
        require_admin(&env)?;
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        env.storage().instance().set(&DataKey::Paused, &true);
        bump_instance(&env);
        RegistryEvent {
            action: symbol_short!("pause"),
        }
        .publish(&env);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        require_admin(&env)?;
        if !is_paused(&env) {
            return Err(Error::NotPaused);
        }
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance(&env);
        RegistryEvent {
            action: symbol_short!("unpause"),
        }
        .publish(&env);
        Ok(())
    }

    pub fn add_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        require_admin(&env)?;
        if is_issuer(&env, &issuer) {
            return Err(Error::AlreadyIssuer);
        }
        env.storage()
            .persistent()
            .set(&DataKey::Issuer(issuer.clone()), &true);
        bump_key(&env, &DataKey::Issuer(issuer.clone()));
        bump_instance(&env);
        IssuerEvent {
            action: symbol_short!("add"),
            issuer,
        }
        .publish(&env);
        Ok(())
    }

    pub fn remove_issuer(env: Env, issuer: Address) -> Result<(), Error> {
        require_admin(&env)?;
        if !is_issuer(&env, &issuer) {
            return Err(Error::NotIssuer);
        }
        env.storage()
            .persistent()
            .remove(&DataKey::Issuer(issuer.clone()));
        bump_instance(&env);
        IssuerEvent {
            action: symbol_short!("remove"),
            issuer,
        }
        .publish(&env);
        Ok(())
    }

    /// Register a schema. Caller must be an approved issuer or the admin.
    pub fn register_schema(
        env: Env,
        caller: Address,
        version: u32,
        schema_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        caller.require_auth();
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if caller != admin && !is_issuer(&env, &caller) {
            return Err(Error::NotIssuer);
        }
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextSchemaId)
            .ok_or(Error::NotInitialized)?;
        let rec = SchemaRecord {
            id,
            issuer: caller.clone(),
            version,
            schema_hash,
        };
        env.storage().persistent().set(&DataKey::Schema(id), &rec);
        env.storage()
            .instance()
            .set(&DataKey::NextSchemaId, &(id + 1));
        bump_key(&env, &DataKey::Schema(id));
        bump_instance(&env);
        SchemaEvent {
            action: symbol_short!("schema"),
            schema_id: id,
            issuer: caller,
        }
        .publish(&env);
        Ok(id)
    }

    /// Issue a credential. Issuer must be approved. Schema must exist.
    /// Expiry must be strictly in the future.
    pub fn issue(
        env: Env,
        issuer: Address,
        subject: Address,
        schema_id: u64,
        claims_root: BytesN<32>,
        expiry: u64,
    ) -> Result<u64, Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        issuer.require_auth();
        if !is_issuer(&env, &issuer) {
            return Err(Error::NotIssuer);
        }
        if !env.storage().persistent().has(&DataKey::Schema(schema_id)) {
            return Err(Error::SchemaNotFound);
        }
        let now = env.ledger().timestamp();
        if expiry <= now {
            return Err(Error::ExpiryInPast);
        }
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextCredId)
            .ok_or(Error::NotInitialized)?;
        let rec = CredentialRecord {
            id,
            issuer: issuer.clone(),
            subject: subject.clone(),
            schema_id,
            claims_root,
            expiry,
            revoked: false,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Credential(id), &rec);
        let key = DataKey::OwnerCreds(subject.clone());
        let mut ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(id);
        env.storage().persistent().set(&key, &ids);
        env.storage()
            .instance()
            .set(&DataKey::NextCredId, &(id + 1));
        bump_key(&env, &DataKey::Credential(id));
        bump_key(&env, &DataKey::OwnerCreds(subject.clone()));
        bump_instance(&env);
        CredentialIssueEvent {
            action: symbol_short!("issue"),
            credential_id: id,
            issuer,
            subject,
            schema_id,
        }
        .publish(&env);
        Ok(id)
    }

    /// Revoke a credential. Only the issuing issuer may revoke.
    pub fn revoke(env: Env, issuer: Address, credential_id: u64) -> Result<(), Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        issuer.require_auth();
        let mut rec: CredentialRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Credential(credential_id))
            .ok_or(Error::CredentialNotFound)?;
        if rec.issuer != issuer {
            return Err(Error::WrongIssuer);
        }
        if rec.revoked {
            return Err(Error::AlreadyRevoked);
        }
        rec.revoked = true;
        env.storage()
            .persistent()
            .set(&DataKey::Credential(credential_id), &rec);
        bump_key(&env, &DataKey::Credential(credential_id));
        bump_instance(&env);
        CredentialRevokeEvent {
            action: symbol_short!("revoke"),
            credential_id,
            issuer,
        }
        .publish(&env);
        Ok(())
    }

    pub fn status(env: Env, credential_id: u64) -> CredentialStatus {
        let rec: CredentialRecord = match env
            .storage()
            .persistent()
            .get(&DataKey::Credential(credential_id))
        {
            Some(r) => r,
            None => return CredentialStatus::Unknown,
        };
        bump_key(&env, &DataKey::Credential(credential_id));
        if rec.revoked {
            return CredentialStatus::Revoked;
        }
        if env.ledger().timestamp() > rec.expiry {
            return CredentialStatus::Expired;
        }
        CredentialStatus::Valid
    }

    pub fn get_credential(env: Env, credential_id: u64) -> Result<CredentialRecord, Error> {
        let rec: CredentialRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Credential(credential_id))
            .ok_or(Error::CredentialNotFound)?;
        bump_key(&env, &DataKey::Credential(credential_id));
        Ok(rec)
    }

    /// Page through credentials owned by `subject`. Hard cap: PAGE_CAP per call.
    pub fn credentials_of(
        env: Env,
        subject: Address,
        cursor: u32,
        limit: u32,
    ) -> Vec<CredentialRecord> {
        let limit = limit.min(PAGE_CAP);
        let key = DataKey::OwnerCreds(subject.clone());
        let ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(&env));
        if env.storage().persistent().has(&key) {
            bump_key(&env, &DataKey::OwnerCreds(subject));
        }
        let mut result = Vec::new(&env);
        let total = ids.len();
        let start = cursor.min(total);
        let end = (start + limit).min(total);
        for i in start..end {
            let cid = ids.get(i).unwrap();
            if let Some(rec) = env
                .storage()
                .persistent()
                .get::<DataKey, CredentialRecord>(&DataKey::Credential(cid))
            {
                result.push_back(rec);
            }
        }
        result
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod tests;
