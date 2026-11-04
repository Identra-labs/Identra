#![no_std]

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct IdentityRegistryContract;

#[contractimpl]
impl IdentityRegistryContract {
    /// Stub — returns true so the crate compiles and one passing test exists.
    pub fn ping(_env: Env) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn ping_returns_true() {
        let env = Env::default();
        let contract_id = env.register_contract(None, IdentityRegistryContract);
        let client = IdentityRegistryContractClient::new(&env, &contract_id);
        assert!(client.ping());
    }
}
