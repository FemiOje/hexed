#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use untitled::models::{
        Direction, PlayerState, Vec2,
        GameSession, TileOccupant,
        m_PlayerState, m_GameSession, m_TileOccupant,
    };
    use untitled::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};
    use untitled::utils::hex::{get_neighbor, is_within_bounds};
    use starknet::ContractAddress;

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: "untitled",
            resources: [
                TestResource::Model(m_PlayerState::TEST_CLASS_HASH),
                TestResource::Model(m_GameSession::TEST_CLASS_HASH),
                TestResource::Model(m_TileOccupant::TEST_CLASS_HASH),
                TestResource::Event(actions::e_Spawned::TEST_CLASS_HASH),
                TestResource::Event(actions::e_Moved::TEST_CLASS_HASH),
                TestResource::Event(actions::e_CombatResult::TEST_CLASS_HASH),
                TestResource::Contract(actions::TEST_CLASS_HASH),
            ]
                .span(),
        };

        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"untitled", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"untitled")].span())
        ]
            .span()
    }

    #[test]
    fn test_world_test_set() {
        // Initialize test environment
        let test_game_id: u32 = 999;
        let ndef = namespace_def();

        // Register the resources.
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());

        // Ensures permissions and initializations are synced.
        world.sync_perms_and_inits(contract_defs());

        // Test initial player state (read non-existent model returns zero)
        let mut state: PlayerState = world.read_model(test_game_id);
        assert(state.position.x == 0 && state.position.y == 0, 'initial position wrong');

        // Test write_model_test
        state.position.x = 122;
        state.position.y = 88;

        world.write_model_test(@state);

        let mut state: PlayerState = world.read_model(test_game_id);
        assert(state.position.y == 88, 'write_value_from_id failed');

        // Test model deletion
        world.erase_model(@state);
        let state: PlayerState = world.read_model(test_game_id);
        assert(state.position.x == 0 && state.position.y == 0, 'erase_model failed');
    }

    // Test hex movement utility functions
    #[test]
    fn test_hex_movement_east() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::East);
        assert(next.x == 6, 'East q failed');
        assert(next.y == 5, 'East r failed');
    }

    #[test]
    fn test_hex_movement_northeast() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::NorthEast);
        assert(next.x == 6, 'NE q failed');
        assert(next.y == 4, 'NE r failed');
    }

    #[test]
    fn test_hex_movement_northwest() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::NorthWest);
        assert(next.x == 5, 'NW q failed');
        assert(next.y == 4, 'NW r failed');
    }

    #[test]
    fn test_hex_movement_west() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::West);
        assert(next.x == 4, 'West q failed');
        assert(next.y == 5, 'West r failed');
    }

    #[test]
    fn test_hex_movement_southwest() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::SouthWest);
        assert(next.x == 4, 'SW q failed');
        assert(next.y == 6, 'SW r failed');
    }

    #[test]
    fn test_hex_movement_southeast() {
        let pos = Vec2 { x: 5, y: 5 };
        let next = get_neighbor(pos, Direction::SouthEast);
        assert(next.x == 5, 'SE q failed');
        assert(next.y == 6, 'SE r failed');
    }

    #[test]
    fn test_boundary_validation() {
        assert(is_within_bounds(Vec2 { x: 0, y: 0 }), 'Origin failed');
        assert(is_within_bounds(Vec2 { x: 9, y: 9 }), 'Max corner failed');
        assert(!is_within_bounds(Vec2 { x: 10, y: 5 }), 'Out q failed');
        assert(!is_within_bounds(Vec2 { x: 5, y: 10 }), 'Out r failed');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        actions_system.spawn();

        // Game ID should be uuid() + 1, which is 1 for first spawn
        let game_id: u32 = 1;

        // Verify GameSession created
        let session: GameSession = world.read_model(game_id);
        assert(session.player == caller, 'Session player wrong');
        assert(session.is_active, 'Session should be active');

        // Verify PlayerState initialized correctly
        let state: PlayerState = world.read_model(game_id);
        assert(is_within_bounds(state.position), 'Spawn out of bounds');
        assert(state.position.x < 10, 'X coord out of range');
        assert(state.position.y < 10, 'Y coord out of range');
        assert(state.can_move, 'Cannot move');
        assert(state.last_direction.is_none(), 'Last direction should be None');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_randomness() {
        // Test that spawn positions can vary based on player address
        // Note: In a deterministic test environment with same block,
        // different player addresses should produce different positions
        let caller1: ContractAddress = 1.try_into().unwrap();
        let caller2: ContractAddress = 2.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Spawn first player
        starknet::testing::set_contract_address(caller1);
        actions_system.spawn();
        let game_id1: u32 = 1;
        let state1: PlayerState = world.read_model(game_id1);

        // Spawn second player
        starknet::testing::set_contract_address(caller2);
        actions_system.spawn();
        let game_id2: u32 = 2;
        let state2: PlayerState = world.read_model(game_id2);

        // Both positions should be valid
        assert(is_within_bounds(state1.position), 'Player 1 out of bounds');
        assert(is_within_bounds(state2.position), 'Player 2 out of bounds');

        // Positions should differ (due to different player addresses in seed)
        let same_position = state1.position.x == state2.position.x && state1.position.y == state2.position.y;
        assert(!same_position, 'Positions should differ');

        // Verify each player has a distinct game session
        let session1: GameSession = world.read_model(game_id1);
        assert(session1.player == caller1, 'Session1 player wrong');

        let session2: GameSession = world.read_model(game_id2);
        assert(session2.player == caller2, 'Session2 player wrong');

        assert(game_id1 != game_id2, 'Game IDs should differ');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_east() {
        // let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        actions_system.spawn();
        let game_id: u32 = 1;

        let initial_state: PlayerState = world.read_model(game_id);

        actions_system.move(game_id, Direction::East);

        let new_state: PlayerState = world.read_model(game_id);
        let east_dir_felt: felt252 = Direction::East.into();

        assert(new_state.last_direction.unwrap().into() == east_dir_felt, 'last direction is wrong');
        assert(new_state.position.x == initial_state.position.x + 1, 'position q is wrong');
        assert(new_state.position.y == initial_state.position.y, 'position r is wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_northeast() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Create test game session and state
        let test_game_id: u32 = 999;
        let session = GameSession {
            game_id: test_game_id,
            player: caller,
            is_active: true,
        };
        world.write_model_test(@session);

        let initial_state = PlayerState {
            game_id: test_game_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        };
        world.write_model_test(@initial_state);

        actions_system.move(test_game_id, Direction::NorthEast);

        let new_state: PlayerState = world.read_model(test_game_id);
        assert(new_state.position.x == 6, 'position q is wrong');
        assert(new_state.position.y == 4, 'position r is wrong');
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_out_of_bounds() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let test_game_id: u32 = 999;
        let session = GameSession {
            game_id: test_game_id,
            player: caller,
            is_active: true,
        };
        world.write_model_test(@session);

        let edge_state = PlayerState {
            game_id: test_game_id,
            position: Vec2 { x: 9, y: 5 },
            last_direction: Option::None,
            can_move: true,
        };
        world.write_model_test(@edge_state);

        actions_system.move(test_game_id, Direction::East);
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_west_from_origin() {
        // Test the bug fix: moving west from x=0 should be rejected gracefully
        // Previously with u32, this would cause underflow
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let test_game_id: u32 = 999;
        let session = GameSession {
            game_id: test_game_id,
            player: caller,
            is_active: true,
        };
        world.write_model_test(@session);

        let origin_state = PlayerState {
            game_id: test_game_id,
            position: Vec2 { x: 0, y: 5 },
            last_direction: Option::None,
            can_move: true,
        };
        world.write_model_test(@origin_state);

        // This should fail gracefully with "Move is out of bounds"
        // With the old u32 implementation, this caused underflow
        actions_system.move(test_game_id, Direction::West);
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_north_from_origin() {
        // Test the bug fix: moving north from y=0 should be rejected gracefully
        // Previously with u32, this would cause underflow
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let test_game_id: u32 = 999;
        let session = GameSession {
            game_id: test_game_id,
            player: caller,
            is_active: true,
        };
        world.write_model_test(@session);

        let origin_state = PlayerState {
            game_id: test_game_id,
            position: Vec2 { x: 5, y: 0 },
            last_direction: Option::None,
            can_move: true,
        };
        world.write_model_test(@origin_state);

        // This should fail gracefully with "Move is out of bounds"
        // With the old u32 implementation, this caused underflow
        actions_system.move(test_game_id, Direction::NorthWest);
    }

    #[test]
    #[available_gas(30000000)]
    fn test_get_game_state() {
        let caller: ContractAddress = 1.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        starknet::testing::set_contract_address(caller);
        actions_system.spawn();

        let game_id: u32 = 1;

        // Read state to compare against
        let state: PlayerState = world.read_model(game_id);

        // Call view function
        let game_state = actions_system.get_game_state(game_id);

        assert(game_state.game_id == game_id, 'game_id wrong');
        assert(game_state.player == caller, 'player wrong');
        assert(game_state.position.x == state.position.x, 'position x wrong');
        assert(game_state.position.y == state.position.y, 'position y wrong');
        assert(game_state.can_move, 'can_move wrong');
        assert(game_state.is_active, 'is_active wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_writes_tile_occupant() {
        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        actions_system.spawn();
        let game_id: u32 = 1;

        let state: PlayerState = world.read_model(game_id);
        let tile: TileOccupant = world.read_model((state.position.x, state.position.y));
        assert(tile.game_id == game_id, 'tile should have game_id');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_updates_tile_occupants() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set up player at (5,5) with TileOccupant
        let test_game_id: u32 = 999;
        let session = GameSession {
            game_id: test_game_id,
            player: caller,
            is_active: true,
        };
        world.write_model_test(@session);

        let initial_state = PlayerState {
            game_id: test_game_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        };
        world.write_model_test(@initial_state);
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: test_game_id });

        // Move east to (6,5) — empty tile
        actions_system.move(test_game_id, Direction::East);

        // Old tile should be cleared
        let old_tile: TileOccupant = world.read_model((5, 5));
        assert(old_tile.game_id == 0, 'old tile not cleared');

        // New tile should be occupied
        let new_tile: TileOccupant = world.read_model((6, 5));
        assert(new_tile.game_id == test_game_id, 'new tile not set');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_on_occupied_tile() {
        let attacker_addr: ContractAddress = 1.try_into().unwrap();
        let defender_addr: ContractAddress = 2.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set up attacker at (5,5)
        let attacker_id: u32 = 10;
        world.write_model_test(@GameSession {
            game_id: attacker_id,
            player: attacker_addr,
            is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: attacker_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: attacker_id });

        // Set up defender at (6,5) — east of attacker
        let defender_id: u32 = 20;
        world.write_model_test(@GameSession {
            game_id: defender_id,
            player: defender_addr,
            is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: defender_id,
            position: Vec2 { x: 6, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: defender_id });

        // Attacker moves east into defender's tile
        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        // Read final states
        let attacker_state: PlayerState = world.read_model(attacker_id);
        let defender_state: PlayerState = world.read_model(defender_id);
        let tile_5_5: TileOccupant = world.read_model((5, 5));
        let tile_6_5: TileOccupant = world.read_model((6, 5));

        // Combat happened — either swap (attacker won) or no change (attacker lost)
        let attacker_at_dest = attacker_state.position.x == 6 && attacker_state.position.y == 5;
        let attacker_stayed = attacker_state.position.x == 5 && attacker_state.position.y == 5;

        if attacker_at_dest {
            // Attacker won: positions swapped
            assert(defender_state.position.x == 5 && defender_state.position.y == 5, 'defender not swapped');
            assert(tile_6_5.game_id == attacker_id, 'tile(6,5) wrong after win');
            assert(tile_5_5.game_id == defender_id, 'tile(5,5) wrong after win');
        } else {
            // Attacker lost: no changes
            assert(attacker_stayed, 'attacker should stay');
            assert(defender_state.position.x == 6 && defender_state.position.y == 5, 'defender should stay');
            assert(tile_5_5.game_id == attacker_id, 'tile(5,5) wrong after loss');
            assert(tile_6_5.game_id == defender_id, 'tile(6,5) wrong after loss');
        }
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_to_inactive_defender_tile() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set up active player at (5,5)
        let player_id: u32 = 10;
        world.write_model_test(@GameSession {
            game_id: player_id,
            player: caller,
            is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: player_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: player_id });

        // Stale TileOccupant from an inactive game at (6,5)
        let stale_id: u32 = 99;
        world.write_model_test(@GameSession {
            game_id: stale_id,
            player: 0xdead.try_into().unwrap(),
            is_active: false,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: stale_id });

        // Should move normally (no combat) since defender is inactive
        actions_system.move(player_id, Direction::East);

        let state: PlayerState = world.read_model(player_id);
        assert(state.position.x == 6 && state.position.y == 5, 'should move to dest');

        let old_tile: TileOccupant = world.read_model((5, 5));
        assert(old_tile.game_id == 0, 'old tile not cleared');

        let new_tile: TileOccupant = world.read_model((6, 5));
        assert(new_tile.game_id == player_id, 'new tile not claimed');
    }

}
