#![no_std]

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct CredentialRegistryContract;

#[contractimpl]
impl CredentialRegistryContract {
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
        let contract_id = env.register_contract(None, CredentialRegistryContract);
        let client = CredentialRegistryContractClient::new(&env, &contract_id);
        assert!(client.ping());
    }
}
