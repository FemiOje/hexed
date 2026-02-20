use dojo::world::{WorldStorageTrait, world};
use dojo_cairo_test::{
    ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
    spawn_test_world,
};
use hexed::models::{m_GameCounter, m_GameSession, m_HighestScore, m_PlayerState, m_PlayerStats, m_TileOccupant};
use hexed::systems::game::contracts::{IGameSystemsDispatcher, game_systems};
use starknet::ContractAddress;

// ------------------------------------------ //
// ------------ Test Constants -------------- //
// ------------------------------------------ //

pub fn PLAYER_ADDR() -> ContractAddress {
    0.try_into().unwrap()
}

pub fn ATTACKER_ADDR() -> ContractAddress {
    1.try_into().unwrap()
}

pub fn DEFENDER_ADDR() -> ContractAddress {
    2.try_into().unwrap()
}

// ------------------------------------------ //
// ------------ World Setup ---------------- //
// ------------------------------------------ //

pub fn namespace_def() -> NamespaceDef {
    NamespaceDef {
        namespace: "hexed",
        resources: [
            TestResource::Model(m_PlayerState::TEST_CLASS_HASH),
            TestResource::Model(m_PlayerStats::TEST_CLASS_HASH),
            TestResource::Model(m_GameSession::TEST_CLASS_HASH),
            TestResource::Model(m_TileOccupant::TEST_CLASS_HASH),
            TestResource::Model(m_GameCounter::TEST_CLASS_HASH),
            TestResource::Model(m_HighestScore::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_Spawned::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_Moved::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_CombatResult::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_PlayerDied::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_NeighborsRevealed::TEST_CLASS_HASH),
            TestResource::Event(game_systems::e_EncounterOccurred::TEST_CLASS_HASH),
            TestResource::Contract(game_systems::TEST_CLASS_HASH),
        ]
            .span(),
    }
}

pub fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(@"hexed", @"game_systems")
            .with_writer_of([dojo::utils::bytearray_hash(@"hexed")].span())
    ]
        .span()
}

/// Deploys a test world with all models, events, and contracts registered.
/// Returns (WorldStorage, IGameSystemsDispatcher) ready for testing.
pub fn deploy_world() -> (dojo::world::WorldStorage, IGameSystemsDispatcher) {
    let ndef = namespace_def();
    let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
    world.sync_perms_and_inits(contract_defs());

    let (contract_address, _) = world.dns(@"game_systems").unwrap();
    let game = IGameSystemsDispatcher { contract_address };

    (world, game)
}
