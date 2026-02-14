#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use untitled::models::{
        Direction, PlayerState, PlayerStats, Vec2,
        GameSession, TileOccupant, STARTING_HP, MAX_HP, COMBAT_DAMAGE, COMBAT_XP_REWARD,
        m_PlayerState, m_PlayerStats, m_GameSession, m_TileOccupant,
    };
    use untitled::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};
    use untitled::utils::hex::{get_neighbor, is_within_bounds};
    use starknet::ContractAddress;

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: "untitled",
            resources: [
                TestResource::Model(m_PlayerState::TEST_CLASS_HASH),
                TestResource::Model(m_PlayerStats::TEST_CLASS_HASH),
                TestResource::Model(m_GameSession::TEST_CLASS_HASH),
                TestResource::Model(m_TileOccupant::TEST_CLASS_HASH),
                TestResource::Event(actions::e_Spawned::TEST_CLASS_HASH),
                TestResource::Event(actions::e_Moved::TEST_CLASS_HASH),
                TestResource::Event(actions::e_CombatResult::TEST_CLASS_HASH),
                TestResource::Event(actions::e_PlayerDied::TEST_CLASS_HASH),
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
        world
            .write_model_test(
                @PlayerStats {
                    game_id: attacker_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0,
                },
            );

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
        world
            .write_model_test(
                @PlayerStats {
                    game_id: defender_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0,
                },
            );

        // Attacker moves east into defender's tile
        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        // Read final states
        let attacker_state: PlayerState = world.read_model(attacker_id);
        let defender_state: PlayerState = world.read_model(defender_id);
        let tile_5_5: TileOccupant = world.read_model((5, 5));
        let tile_6_5: TileOccupant = world.read_model((6, 5));

        // Check stats to understand what happened
        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);
        let atk_session: GameSession = world.read_model(attacker_id);
        let def_session: GameSession = world.read_model(defender_id);

        // Combat happened — determine outcome
        let attacker_at_dest = attacker_state.position.x == 6 && attacker_state.position.y == 5;

        if attacker_at_dest {
            if !def_session.is_active {
                // Attacker won, defender died
                assert(def_stats.hp == 0, 'dead def hp should be 0');
                assert(tile_6_5.game_id == attacker_id, 'tile(6,5) wrong after kill');
                assert(tile_5_5.game_id == 0, 'old tile should be clear');
            } else {
                // Attacker won, defender survived: positions swapped
                assert(defender_state.position.x == 5 && defender_state.position.y == 5, 'defender not swapped');
                assert(tile_6_5.game_id == attacker_id, 'tile(6,5) wrong after win');
                assert(tile_5_5.game_id == defender_id, 'tile(5,5) wrong after win');
            }
        } else if !atk_session.is_active {
            // Attacker lost and died
            assert(atk_stats.hp == 0, 'dead atk hp should be 0');
            assert(tile_5_5.game_id == 0, 'dead atk tile should clear');
            assert(tile_6_5.game_id == defender_id, 'def keeps tile after kill');
        } else {
            // Attacker lost, survived: no position change
            assert(attacker_state.position.x == 5 && attacker_state.position.y == 5, 'attacker should stay');
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

    // ==================== COMBAT SYSTEM TESTS ====================

    #[test]
    fn test_hp_constants_valid() {
        // HP overflow guard: starting HP must never exceed the cap
        assert(STARTING_HP <= MAX_HP, 'STARTING_HP exceeds MAX_HP');
        assert(MAX_HP > 0, 'MAX_HP must be positive');
        assert(COMBAT_DAMAGE > 0, 'COMBAT_DAMAGE must be positive');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_initializes_stats() {
        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        actions_system.spawn();
        let game_id: u32 = 1;

        let stats: PlayerStats = world.read_model(game_id);
        assert(stats.hp == STARTING_HP, 'hp should be STARTING_HP');
        assert(stats.max_hp == MAX_HP, 'max_hp should be MAX_HP');
        assert(stats.xp == 0, 'xp should be 0');
        assert(stats.hp <= stats.max_hp, 'hp exceeds max_hp on spawn');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_stats_update() {
        // Verify winner gets +XP and loser gets -HP after combat
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
            game_id: attacker_id, player: attacker_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: attacker_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: attacker_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: attacker_id });

        // Set up defender at (6,5)
        let defender_id: u32 = 20;
        world.write_model_test(@GameSession {
            game_id: defender_id, player: defender_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: defender_id,
            position: Vec2 { x: 6, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: defender_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: defender_id });

        // Trigger combat
        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);

        let attacker_state: PlayerState = world.read_model(attacker_id);
        let attacker_won = attacker_state.position.x == 6 && attacker_state.position.y == 5;

        if attacker_won {
            // Attacker won: +XP, full HP; Defender lost: -HP, 0 XP
            assert(atk_stats.xp == COMBAT_XP_REWARD, 'winner xp wrong');
            assert(atk_stats.hp == STARTING_HP, 'winner hp should be full');
            assert(def_stats.xp == 0, 'loser xp should be 0');
            assert(def_stats.hp == STARTING_HP - COMBAT_DAMAGE, 'loser hp wrong');
        } else {
            // Defender won: +XP, full HP; Attacker lost: -HP, 0 XP
            assert(def_stats.xp == COMBAT_XP_REWARD, 'winner xp wrong');
            assert(def_stats.hp == STARTING_HP, 'winner hp should be full');
            assert(atk_stats.xp == 0, 'loser xp should be 0');
            assert(atk_stats.hp == STARTING_HP - COMBAT_DAMAGE, 'loser hp wrong');
        }

        // HP overflow check: winner HP must not exceed max
        assert(atk_stats.hp <= atk_stats.max_hp, 'atk hp exceeds max');
        assert(def_stats.hp <= def_stats.max_hp, 'def hp exceeds max');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_causes_death() {
        // Set both players to low HP so whoever loses will die
        let attacker_addr: ContractAddress = 1.try_into().unwrap();
        let defender_addr: ContractAddress = 2.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let low_hp: u32 = 5; // Below COMBAT_DAMAGE, guarantees death on loss

        // Set up attacker at (5,5) with low HP
        let attacker_id: u32 = 10;
        world.write_model_test(@GameSession {
            game_id: attacker_id, player: attacker_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: attacker_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: attacker_id, hp: low_hp, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: attacker_id });

        // Set up defender at (6,5) with low HP
        let defender_id: u32 = 20;
        world.write_model_test(@GameSession {
            game_id: defender_id, player: defender_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: defender_id,
            position: Vec2 { x: 6, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: defender_id, hp: low_hp, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: defender_id });

        // Trigger combat
        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        // Determine outcome
        let atk_state: PlayerState = world.read_model(attacker_id);
        let attacker_won = atk_state.position.x == 6 && atk_state.position.y == 5;

        if attacker_won {
            // Defender died
            let def_session: GameSession = world.read_model(defender_id);
            assert(!def_session.is_active, 'dead session should deactivate');

            let def_stats: PlayerStats = world.read_model(defender_id);
            assert(def_stats.hp == 0, 'dead player hp should be 0');

            let def_state: PlayerState = world.read_model(defender_id);
            assert(!def_state.can_move, 'dead player cannot move');

            // Attacker claimed destination
            let dest_tile: TileOccupant = world.read_model((6, 5));
            assert(dest_tile.game_id == attacker_id, 'attacker should claim tile');

            // Old tile cleared
            let old_tile: TileOccupant = world.read_model((5, 5));
            assert(old_tile.game_id == 0, 'old tile should be clear');
        } else {
            // Attacker died
            let atk_session: GameSession = world.read_model(attacker_id);
            assert(!atk_session.is_active, 'dead session should deactivate');

            let atk_stats: PlayerStats = world.read_model(attacker_id);
            assert(atk_stats.hp == 0, 'dead player hp should be 0');

            assert(!atk_state.can_move, 'dead player cannot move');

            // Attacker's old tile cleared
            let old_tile: TileOccupant = world.read_model((5, 5));
            assert(old_tile.game_id == 0, 'dead tile should be clear');

            // Defender stays at destination
            let dest_tile: TileOccupant = world.read_model((6, 5));
            assert(dest_tile.game_id == defender_id, 'defender should keep tile');
        }
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_exact_hp_death() {
        // Player with HP exactly equal to COMBAT_DAMAGE should die (hp=10, damage=10 → 0)
        let attacker_addr: ContractAddress = 1.try_into().unwrap();
        let defender_addr: ContractAddress = 2.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Both at exactly COMBAT_DAMAGE HP
        let attacker_id: u32 = 10;
        world.write_model_test(@GameSession {
            game_id: attacker_id, player: attacker_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: attacker_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: attacker_id, hp: COMBAT_DAMAGE, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: attacker_id });

        let defender_id: u32 = 20;
        world.write_model_test(@GameSession {
            game_id: defender_id, player: defender_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: defender_id,
            position: Vec2 { x: 6, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: defender_id, hp: COMBAT_DAMAGE, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: defender_id });

        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        // Whoever lost should be dead (hp was exactly COMBAT_DAMAGE, so hp <= COMBAT_DAMAGE → dies)
        let atk_state: PlayerState = world.read_model(attacker_id);
        let attacker_won = atk_state.position.x == 6 && atk_state.position.y == 5;

        if attacker_won {
            let def_stats: PlayerStats = world.read_model(defender_id);
            assert(def_stats.hp == 0, 'exact hp should cause death');
            let def_session: GameSession = world.read_model(defender_id);
            assert(!def_session.is_active, 'should be inactive');
        } else {
            let atk_stats: PlayerStats = world.read_model(attacker_id);
            assert(atk_stats.hp == 0, 'exact hp should cause death');
            let atk_session: GameSession = world.read_model(attacker_id);
            assert(!atk_session.is_active, 'should be inactive');
        }
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('game not active', 'ENTRYPOINT_FAILED'))]
    fn test_dead_player_cannot_move() {
        let caller: ContractAddress = 0.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        // Set up a dead player (is_active = false)
        let dead_id: u32 = 42;
        world.write_model_test(@GameSession {
            game_id: dead_id, player: caller, is_active: false,
        });
        world.write_model_test(@PlayerState {
            game_id: dead_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: false,
        });
        world.write_model_test(@PlayerStats {
            game_id: dead_id, hp: 0, max_hp: MAX_HP, xp: 0,
        });

        // Should panic: dead player can't move
        actions_system.move(dead_id, Direction::East);
    }

    #[test]
    #[available_gas(30000000)]
    fn test_game_state_includes_stats() {
        let caller: ContractAddress = 1.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        starknet::testing::set_contract_address(caller);
        actions_system.spawn();
        let game_id: u32 = 1;

        let game_state = actions_system.get_game_state(game_id);

        assert(game_state.hp == STARTING_HP, 'gs hp wrong');
        assert(game_state.max_hp == MAX_HP, 'gs max_hp wrong');
        assert(game_state.xp == 0, 'gs xp wrong');
        assert(game_state.hp <= game_state.max_hp, 'gs hp exceeds max');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_winner_hp_not_inflated() {
        // Verify combat winner's HP stays unchanged (no accidental HP increase / overflow)
        let attacker_addr: ContractAddress = 1.try_into().unwrap();
        let defender_addr: ContractAddress = 2.try_into().unwrap();

        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions_system = IActionsDispatcher { contract_address };

        let attacker_id: u32 = 10;
        world.write_model_test(@GameSession {
            game_id: attacker_id, player: attacker_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: attacker_id,
            position: Vec2 { x: 5, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: attacker_id, hp: MAX_HP, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 5, y: 5, game_id: attacker_id });

        let defender_id: u32 = 20;
        world.write_model_test(@GameSession {
            game_id: defender_id, player: defender_addr, is_active: true,
        });
        world.write_model_test(@PlayerState {
            game_id: defender_id,
            position: Vec2 { x: 6, y: 5 },
            last_direction: Option::None,
            can_move: true,
        });
        world.write_model_test(@PlayerStats {
            game_id: defender_id, hp: MAX_HP, max_hp: MAX_HP, xp: 0,
        });
        world.write_model_test(@TileOccupant { x: 6, y: 5, game_id: defender_id });

        starknet::testing::set_contract_address(attacker_addr);
        actions_system.move(attacker_id, Direction::East);

        // Both players' HP must be <= max_hp (no overflow)
        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);

        assert(atk_stats.hp <= MAX_HP, 'atk hp overflow');
        assert(def_stats.hp <= MAX_HP, 'def hp overflow');

        // Winner's HP should be exactly MAX_HP (unchanged)
        let atk_state: PlayerState = world.read_model(attacker_id);
        let attacker_won = atk_state.position.x == 6 && atk_state.position.y == 5;

        if attacker_won {
            assert(atk_stats.hp == MAX_HP, 'winner hp changed');
        } else {
            assert(def_stats.hp == MAX_HP, 'winner hp changed');
        }
    }

}
