#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address,
    BytesN, Env, Symbol,
};

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Paused,
    Identity(u64),       // id → IdentityRecord
    OwnerIndex(Address), // owner → id
    NextId,
}

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdentityRecord {
    pub id: u64,
    pub owner: Address,
    /// SHA-256 hash of off-chain metadata. Personal data never stored here.
    pub metadata_hash: BytesN<32>,
    pub active: bool,
}

// ── Error enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    Paused = 4,
    NotPaused = 5,
    AlreadyHasIdentity = 6,
    IdentityNotFound = 7,
    OwnerNotFound = 8,
    NotActive = 9,
    AlreadyActive = 10,
    NoPendingTransfer = 11,
}

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
pub struct IdentityCreateEvent {
    #[topic]
    pub action: Symbol,
    pub id: u64,
    pub owner: Address,
    pub metadata_hash: BytesN<32>,
}

#[contractevent]
pub struct IdentityUpdateEvent {
    #[topic]
    pub action: Symbol,
    pub id: u64,
    pub owner: Address,
    pub new_hash: BytesN<32>,
}

#[contractevent]
pub struct IdentityStateEvent {
    #[topic]
    pub action: Symbol,
    pub id: u64,
    pub owner: Address,
}

// ── TTL constants (ledgers) ───────────────────────────────────────────────────

/// Refresh instance TTL when below ~1 day (6 s/ledger).
const INSTANCE_TTL_LOW: u32 = 14_400;
/// Extend instance TTL to ~7 days.
const INSTANCE_TTL_HIGH: u32 = 100_800;
/// Refresh persistent entries when below ~7 days.
const PERSIST_TTL_LOW: u32 = 100_800;
/// Extend persistent entries to ~30 days.
const PERSIST_TTL_HIGH: u32 = 432_000;

// ── Private helpers ───────────────────────────────────────────────────────────

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

fn bump_identity(env: &Env, id: u64) {
    env.storage().persistent().extend_ttl(
        &DataKey::Identity(id),
        PERSIST_TTL_LOW,
        PERSIST_TTL_HIGH,
    );
}

fn bump_owner(env: &Env, owner: &Address) {
    env.storage().persistent().extend_ttl(
        &DataKey::OwnerIndex(owner.clone()),
        PERSIST_TTL_LOW,
        PERSIST_TTL_HIGH,
    );
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct IdentityRegistryContract;

#[contractimpl]
impl IdentityRegistryContract {
    /// Initialise the registry. Can only be called once.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextId, &1u64);
        bump_instance(&env);
        RegistryEvent {
            action: symbol_short!("init"),
        }
        .publish(&env);
        Ok(())
    }

    /// Propose a new admin (two-step transfer, step 1). Admin only.
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

    /// Accept a pending admin transfer (step 2). Pending admin only.
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

    /// Pause all writes. Admin only.
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

    /// Unpause. Admin only.
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

    /// Create an identity for `owner`. One active identity per address.
    /// Returns the new identity id.
    pub fn create_identity(
        env: Env,
        owner: Address,
        metadata_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        owner.require_auth();
        if env
            .storage()
            .persistent()
            .has(&DataKey::OwnerIndex(owner.clone()))
        {
            return Err(Error::AlreadyHasIdentity);
        }
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextId)
            .ok_or(Error::NotInitialized)?;
        let record = IdentityRecord {
            id,
            owner: owner.clone(),
            metadata_hash: metadata_hash.clone(),
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Identity(id), &record);
        env.storage()
            .persistent()
            .set(&DataKey::OwnerIndex(owner.clone()), &id);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        bump_instance(&env);
        bump_identity(&env, id);
        bump_owner(&env, &owner);
        IdentityCreateEvent {
            action: symbol_short!("create"),
            id,
            owner,
            metadata_hash,
        }
        .publish(&env);
        Ok(id)
    }

    /// Update the metadata hash for an active identity. Owner only.
    pub fn update_metadata(env: Env, owner: Address, new_hash: BytesN<32>) -> Result<(), Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        owner.require_auth();
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .ok_or(Error::OwnerNotFound)?;
        let mut record: IdentityRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(id))
            .ok_or(Error::IdentityNotFound)?;
        if !record.active {
            return Err(Error::NotActive);
        }
        record.metadata_hash = new_hash.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Identity(id), &record);
        bump_identity(&env, id);
        bump_owner(&env, &owner);
        bump_instance(&env);
        IdentityUpdateEvent {
            action: symbol_short!("update"),
            id,
            owner,
            new_hash,
        }
        .publish(&env);
        Ok(())
    }

    /// Deactivate an identity. Owner only.
    pub fn deactivate(env: Env, owner: Address) -> Result<(), Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        owner.require_auth();
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .ok_or(Error::OwnerNotFound)?;
        let mut record: IdentityRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(id))
            .ok_or(Error::IdentityNotFound)?;
        if !record.active {
            return Err(Error::NotActive);
        }
        record.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Identity(id), &record);
        bump_identity(&env, id);
        bump_owner(&env, &owner);
        bump_instance(&env);
        IdentityStateEvent {
            action: symbol_short!("deact"),
            id,
            owner,
        }
        .publish(&env);
        Ok(())
    }

    /// Reactivate a deactivated identity. Owner only.
    pub fn reactivate(env: Env, owner: Address) -> Result<(), Error> {
        if is_paused(&env) {
            return Err(Error::Paused);
        }
        owner.require_auth();
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .ok_or(Error::OwnerNotFound)?;
        let mut record: IdentityRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(id))
            .ok_or(Error::IdentityNotFound)?;
        if record.active {
            return Err(Error::AlreadyActive);
        }
        record.active = true;
        env.storage()
            .persistent()
            .set(&DataKey::Identity(id), &record);
        bump_identity(&env, id);
        bump_owner(&env, &owner);
        bump_instance(&env);
        IdentityStateEvent {
            action: symbol_short!("react"),
            id,
            owner,
        }
        .publish(&env);
        Ok(())
    }

    /// Fetch an identity record by id. Readable while paused.
    pub fn get_identity(env: Env, id: u64) -> Result<IdentityRecord, Error> {
        let record: IdentityRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Identity(id))
            .ok_or(Error::IdentityNotFound)?;
        bump_identity(&env, id);
        Ok(record)
    }

    /// Look up the identity id owned by `owner`. Readable while paused.
    pub fn identity_of(env: Env, owner: Address) -> Result<u64, Error> {
        let id: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerIndex(owner.clone()))
            .ok_or(Error::OwnerNotFound)?;
        bump_owner(&env, &owner);
        Ok(id)
    }

    /// Return the current admin address.
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod tests;
