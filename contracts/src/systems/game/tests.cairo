#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    // use dojo::world::WorldStorageTrait;
    use untitled::models::{
        COMBAT_DAMAGE, COMBAT_XP_REWARD, Direction, EXPLORE_XP_REWARD, GameSession, MAX_HP,
        PlayerState, PlayerStats, STARTING_HP, TileOccupant, Vec2,
    };
    use untitled::systems::game::contracts::{ // IGameSystemsDispatcher,
        IGameSystemsDispatcherTrait,
    };
    use untitled::utils::hex::is_within_bounds;
    use untitled::utils::setup::{ATTACKER_ADDR, DEFENDER_ADDR, PLAYER_ADDR, deploy_world};
    // use starknet::ContractAddress;

    // ------------------------------------------ //
    // ------------ World Setup Tests ---------- //
    // ------------------------------------------ //

    #[test]
    fn test_world_test_set() {
        let test_game_id: u32 = 999;
        let (mut world, _) = deploy_world();

        let mut state: PlayerState = world.read_model(test_game_id);
        assert(state.position.x == 0 && state.position.y == 0, 'initial position wrong');

        state.position.x = 122;
        state.position.y = 88;
        world.write_model_test(@state);

        let mut state: PlayerState = world.read_model(test_game_id);
        assert(state.position.y == 88, 'write_value_from_id failed');

        world.erase_model(@state);
        let state: PlayerState = world.read_model(test_game_id);
        assert(state.position.x == 0 && state.position.y == 0, 'erase_model failed');
    }

    // ------------------------------------------ //
    // ------------ Spawn Tests ---------------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(30000000)]
    fn test_spawn() {
        let caller = PLAYER_ADDR();
        let (world, game) = deploy_world();

        game.spawn();
        let game_id: u32 = 1;

        let session: GameSession = world.read_model(game_id);
        assert(session.player == caller, 'Session player wrong');
        assert(session.is_active, 'Session should be active');

        let state: PlayerState = world.read_model(game_id);
        assert(is_within_bounds(state.position), 'Spawn out of bounds');
        assert(state.can_move, 'Cannot move');
        assert(state.last_direction.is_none(), 'Last direction should be None');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_randomness() {
        let caller1 = ATTACKER_ADDR();
        let caller2 = DEFENDER_ADDR();
        let (world, game) = deploy_world();

        starknet::testing::set_contract_address(caller1);
        game.spawn();
        let state1: PlayerState = world.read_model(1_u32);

        starknet::testing::set_contract_address(caller2);
        game.spawn();
        let state2: PlayerState = world.read_model(2_u32);

        assert(is_within_bounds(state1.position), 'Player 1 out of bounds');
        assert(is_within_bounds(state2.position), 'Player 2 out of bounds');

        let same_position = state1.position.x == state2.position.x
            && state1.position.y == state2.position.y;
        assert(!same_position, 'Positions should differ');

        let session1: GameSession = world.read_model(1_u32);
        assert(session1.player == caller1, 'Session1 player wrong');

        let session2: GameSession = world.read_model(2_u32);
        assert(session2.player == caller2, 'Session2 player wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_writes_tile_occupant() {
        let (world, game) = deploy_world();

        game.spawn();
        let game_id: u32 = 1;

        let state: PlayerState = world.read_model(game_id);
        let tile: TileOccupant = world.read_model((state.position.x, state.position.y));
        assert(tile.game_id == game_id, 'tile should have game_id');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_spawn_initializes_stats() {
        let (world, game) = deploy_world();

        game.spawn();
        let game_id: u32 = 1;

        let stats: PlayerStats = world.read_model(game_id);
        assert(stats.hp == STARTING_HP, 'hp should be STARTING_HP');
        assert(stats.max_hp == MAX_HP, 'max_hp should be MAX_HP');
        assert(stats.xp == 0, 'xp should be 0');
        assert(stats.hp <= stats.max_hp, 'hp exceeds max_hp on spawn');
    }

    // ------------------------------------------ //
    // ------------ Movement Tests ------------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(30000000)]
    fn test_move_east() {
        let (world, game) = deploy_world();

        game.spawn();
        let game_id: u32 = 1;
        let initial_state: PlayerState = world.read_model(game_id);

        game.move(game_id, Direction::East);

        let new_state: PlayerState = world.read_model(game_id);
        let east_dir_felt: felt252 = Direction::East.into();

        assert(
            new_state.last_direction.unwrap().into() == east_dir_felt, 'last direction is wrong',
        );
        assert(new_state.position.x == initial_state.position.x + 1, 'position q is wrong');
        assert(new_state.position.y == initial_state.position.y, 'position r is wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_northeast() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );

        game.move(test_game_id, Direction::NorthEast);

        let new_state: PlayerState = world.read_model(test_game_id);
        assert(new_state.position.x == 1, 'position q is wrong');
        assert(new_state.position.y == -1, 'position r is wrong');
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_out_of_bounds() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 10, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );

        game.move(test_game_id, Direction::East);
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_west_from_edge() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: -10, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );

        game.move(test_game_id, Direction::West);
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('Move is out of bounds', 'ENTRYPOINT_FAILED'))]
    fn test_move_north_from_edge() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: -10 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );

        game.move(test_game_id, Direction::NorthWest);
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_updates_tile_occupants() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: test_game_id });

        game.move(test_game_id, Direction::East);

        let old_tile: TileOccupant = world.read_model((0, 0));
        assert(old_tile.game_id == 0, 'old tile not cleared');

        let new_tile: TileOccupant = world.read_model((1, 0));
        assert(new_tile.game_id == test_game_id, 'new tile not set');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_move_to_inactive_defender_tile() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let player_id: u32 = 10;
        world
            .write_model_test(@GameSession { game_id: player_id, player: caller, is_active: true });
        world
            .write_model_test(
                @PlayerState {
                    game_id: player_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: player_id });

        let stale_id: u32 = 99;
        world
            .write_model_test(
                @GameSession {
                    game_id: stale_id, player: 0xdead.try_into().unwrap(), is_active: false,
                },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: stale_id });

        game.move(player_id, Direction::East);

        let state: PlayerState = world.read_model(player_id);
        assert(state.position.x == 1 && state.position.y == 0, 'should move to dest');

        let old_tile: TileOccupant = world.read_model((0, 0));
        assert(old_tile.game_id == 0, 'old tile not cleared');

        let new_tile: TileOccupant = world.read_model((1, 0));
        assert(new_tile.game_id == player_id, 'new tile not claimed');
    }

    // ------------------------------------------ //
    // ------------ View Function Tests -------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(30000000)]
    fn test_get_game_state() {
        let caller = ATTACKER_ADDR();
        let (world, game) = deploy_world();

        starknet::testing::set_contract_address(caller);
        game.spawn();
        let game_id: u32 = 1;

        let state: PlayerState = world.read_model(game_id);
        let game_state = game.get_game_state(game_id);

        assert(game_state.game_id == game_id, 'game_id wrong');
        assert(game_state.player == caller, 'player wrong');
        assert(game_state.position.x == state.position.x, 'position x wrong');
        assert(game_state.position.y == state.position.y, 'position y wrong');
        assert(game_state.can_move, 'can_move wrong');
        assert(game_state.is_active, 'is_active wrong');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_game_state_includes_stats() {
        let caller = ATTACKER_ADDR();
        let (_, game) = deploy_world();

        starknet::testing::set_contract_address(caller);
        game.spawn();

        let game_state = game.get_game_state(1);

        assert(game_state.hp == STARTING_HP, 'gs hp wrong');
        assert(game_state.max_hp == MAX_HP, 'gs max_hp wrong');
        assert(game_state.xp == 0, 'gs xp wrong');
        assert(game_state.hp <= game_state.max_hp, 'gs hp exceeds max');
    }

    // ------------------------------------------ //
    // ------------ Combat Tests --------------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(60000000)]
    fn test_combat_on_occupied_tile() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );

        // Both players have xp: 0, so attacker wins (equal XP penalises defender).
        // STARTING_HP (100) > COMBAT_DAMAGE (10), so defender survives and positions swap.
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let attacker_state: PlayerState = world.read_model(attacker_id);
        let defender_state: PlayerState = world.read_model(defender_id);
        let tile_0_0: TileOccupant = world.read_model((0, 0));
        let tile_1_0: TileOccupant = world.read_model((1, 0));
        let def_stats: PlayerStats = world.read_model(defender_id);
        let def_session: GameSession = world.read_model(defender_id);

        // Attacker wins and moves to defender's tile
        assert(attacker_state.position.x == 1 && attacker_state.position.y == 0, 'atk should move');
        // Defender survives with reduced HP, swapped to attacker's old position
        assert(def_session.is_active, 'defender should still be active');
        assert(def_stats.hp == STARTING_HP - COMBAT_DAMAGE, 'def hp wrong after combat');
        assert(
            defender_state.position.x == 0 && defender_state.position.y == 0,
            'defender not swapped',
        );
        assert(tile_1_0.game_id == attacker_id, 'tile(1,0) wrong after win');
        assert(tile_0_0.game_id == defender_id, 'tile(0,0) wrong after win');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_stats_update() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Both xp: 0, so attacker wins (equal XP penalises defender).
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);

        // Attacker wins: gets XP, keeps full HP
        assert(atk_stats.xp == COMBAT_XP_REWARD, 'winner xp wrong');
        assert(atk_stats.hp == STARTING_HP, 'winner hp should be full');
        // Defender loses: no XP, takes damage
        assert(def_stats.xp == 0, 'loser xp should be 0');
        assert(def_stats.hp == STARTING_HP - COMBAT_DAMAGE, 'loser hp wrong');

        assert(atk_stats.hp <= atk_stats.max_hp, 'atk hp exceeds max');
        assert(def_stats.hp <= def_stats.max_hp, 'def hp exceeds max');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_causes_death() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let low_hp: u32 = 5;

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: low_hp, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: low_hp, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Both xp: 0 with low HP → attacker wins, defender dies.
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let def_session: GameSession = world.read_model(defender_id);
        assert(!def_session.is_active, 'dead session should deactivate');
        let def_stats: PlayerStats = world.read_model(defender_id);
        assert(def_stats.hp == 0, 'dead player hp should be 0');
        let def_state: PlayerState = world.read_model(defender_id);
        assert(!def_state.can_move, 'dead player cannot move');
        let dest_tile: TileOccupant = world.read_model((1, 0));
        assert(dest_tile.game_id == attacker_id, 'attacker should claim tile');
        let old_tile: TileOccupant = world.read_model((0, 0));
        assert(old_tile.game_id == 0, 'old tile should be clear');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_exact_hp_death() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: COMBAT_DAMAGE, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: COMBAT_DAMAGE, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Both xp: 0 → attacker wins. HP == COMBAT_DAMAGE → exact death.
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let def_stats: PlayerStats = world.read_model(defender_id);
        assert(def_stats.hp == 0, 'exact hp should cause death');
        let def_session: GameSession = world.read_model(defender_id);
        assert(!def_session.is_active, 'should be inactive');
    }

    #[test]
    #[available_gas(30000000)]
    #[should_panic(expected: ('game not active', 'ENTRYPOINT_FAILED'))]
    fn test_dead_player_cannot_move() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let dead_id: u32 = 42;
        world.write_model_test(@GameSession { game_id: dead_id, player: caller, is_active: false });
        world
            .write_model_test(
                @PlayerState {
                    game_id: dead_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: false,
                },
            );
        world.write_model_test(@PlayerStats { game_id: dead_id, hp: 0, max_hp: MAX_HP, xp: 0 });

        game.move(dead_id, Direction::East);
    }

    #[test]
    #[available_gas(60000000)]
    fn test_winner_hp_not_inflated() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: MAX_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: MAX_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Both xp: 0 → attacker wins. Both at MAX_HP so defender survives.
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);

        assert(atk_stats.hp <= MAX_HP, 'atk hp overflow');
        assert(def_stats.hp <= MAX_HP, 'def hp overflow');

        // Attacker wins, HP unchanged
        assert(atk_stats.hp == MAX_HP, 'winner hp changed');
        // Defender survives with reduced HP
        assert(def_stats.hp == MAX_HP - COMBAT_DAMAGE, 'loser hp wrong');
    }

    // ------------------------------------------ //
    // -------- Neighbor Occupancy Tests ------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(30000000)]
    fn test_neighbor_occupancy_no_neighbors() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: test_game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: test_game_id });

        let game_state = game.get_game_state(test_game_id);
        assert(game_state.neighbor_occupancy == 0, 'no neighbors should be 0');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_neighbor_occupancy_east() {
        let caller = PLAYER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        // Player at (0, 0)
        let player_id: u32 = 10;
        world
            .write_model_test(@GameSession { game_id: player_id, player: caller, is_active: true });
        world
            .write_model_test(
                @PlayerState {
                    game_id: player_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: player_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: player_id });

        // Active neighbor to the East at (1, 0)
        let neighbor_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: neighbor_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: neighbor_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: neighbor_id });

        let game_state = game.get_game_state(player_id);
        // East = direction 0 = bit 0 = value 1
        assert(game_state.neighbor_occupancy == 1, 'east bit should be set');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_neighbor_occupancy_multiple() {
        let caller = PLAYER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        // Player at (0, 0)
        let player_id: u32 = 10;
        world
            .write_model_test(@GameSession { game_id: player_id, player: caller, is_active: true });
        world
            .write_model_test(
                @PlayerState {
                    game_id: player_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: player_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: player_id });

        // Active neighbor to the East at (1, 0)
        let east_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: east_id, player: defender_addr, is_active: true },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: east_id });

        // Active neighbor to the West at (-1, 0)
        let west_id: u32 = 30;
        world
            .write_model_test(
                @GameSession { game_id: west_id, player: defender_addr, is_active: true },
            );
        world.write_model_test(@TileOccupant { x: -1, y: 0, game_id: west_id });

        let game_state = game.get_game_state(player_id);
        // East = bit 0 = 1, West = bit 3 = 8 => total = 9
        assert(game_state.neighbor_occupancy == 9, 'east+west should be 9');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_neighbor_occupancy_inactive_ignored() {
        let caller = PLAYER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        // Player at (0, 0)
        let player_id: u32 = 10;
        world
            .write_model_test(@GameSession { game_id: player_id, player: caller, is_active: true });
        world
            .write_model_test(
                @PlayerState {
                    game_id: player_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: player_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: player_id });

        // Inactive neighbor to the East at (1, 0)
        let stale_id: u32 = 99;
        world
            .write_model_test(
                @GameSession { game_id: stale_id, player: defender_addr, is_active: false },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: stale_id });

        let game_state = game.get_game_state(player_id);
        assert(game_state.neighbor_occupancy == 0, 'inactive should not count');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_neighbor_occupancy_after_move() {
        let caller = PLAYER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        // Player at (0, 0)
        let player_id: u32 = 10;
        world
            .write_model_test(@GameSession { game_id: player_id, player: caller, is_active: true });
        world
            .write_model_test(
                @PlayerState {
                    game_id: player_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: player_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: player_id });

        // Place active neighbor at (2, 0) - not adjacent to (0,0) but adjacent to (1,0)
        let neighbor_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: neighbor_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: neighbor_id,
                    position: Vec2 { x: 2, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world.write_model_test(@TileOccupant { x: 2, y: 0, game_id: neighbor_id });

        // Before move: no occupied neighbors at (0,0)
        let state_before = game.get_game_state(player_id);
        assert(state_before.neighbor_occupancy == 0, 'no neighbors at origin');

        // Move east to (1, 0) - now (2,0) should be east neighbor
        game.move(player_id, Direction::East);

        let state_after = game.get_game_state(player_id);
        // East = bit 0 = 1
        assert(state_after.neighbor_occupancy == 1, 'east neighbor after move');
    }

    // ------------------------------------------ //
    // ------------ XP Tests ------------------- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(30000000)]
    fn test_move_to_empty_tile_grants_xp() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: test_game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: test_game_id });

        game.move(test_game_id, Direction::East);
        let stats: PlayerStats = world.read_model(test_game_id);
        assert(stats.xp == EXPLORE_XP_REWARD, 'should gain explore xp');

        game.move(test_game_id, Direction::East);
        let stats2: PlayerStats = world.read_model(test_game_id);
        assert(stats2.xp == EXPLORE_XP_REWARD * 2, 'xp should accumulate');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_xp_saturates_at_max_u32() {
        let caller = PLAYER_ADDR();
        let (mut world, game) = deploy_world();

        let max_u32: u32 = 0xFFFFFFFF;
        let test_game_id: u32 = 999;
        world
            .write_model_test(
                @GameSession { game_id: test_game_id, player: caller, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: test_game_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats {
                    game_id: test_game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: max_u32 - 3,
                },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: test_game_id });

        game.move(test_game_id, Direction::East);

        let stats: PlayerStats = world.read_model(test_game_id);
        assert(stats.xp == max_u32, 'xp should saturate at max');
    }

    // ------------------------------------------ //
    // ------ XP-Based Combat Outcome Tests ---- //
    // ------------------------------------------ //

    #[test]
    #[available_gas(60000000)]
    fn test_combat_higher_xp_defender_wins() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: MAX_HP, max_hp: MAX_HP, xp: 10 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: MAX_HP, max_hp: MAX_HP, xp: 50 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Defender has higher XP (50 > 10), so defender wins.
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);
        let atk_state: PlayerState = world.read_model(attacker_id);

        // Attacker loses: stays at original position, takes damage
        assert(atk_state.position.x == 0 && atk_state.position.y == 0, 'atk should stay');
        assert(atk_stats.hp == MAX_HP - COMBAT_DAMAGE, 'loser hp wrong');
        assert(atk_stats.xp == 10, 'loser xp should not change');
        // Defender wins: gets XP reward, keeps HP
        assert(def_stats.hp == MAX_HP, 'winner hp should be full');
        assert(def_stats.xp == 50 + COMBAT_XP_REWARD, 'winner xp wrong');
    }

    #[test]
    #[available_gas(60000000)]
    fn test_combat_equal_xp_favors_attacker() {
        let attacker_addr = ATTACKER_ADDR();
        let defender_addr = DEFENDER_ADDR();
        let (mut world, game) = deploy_world();

        let attacker_id: u32 = 10;
        world
            .write_model_test(
                @GameSession { game_id: attacker_id, player: attacker_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: attacker_id,
                    position: Vec2 { x: 0, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: attacker_id, hp: MAX_HP, max_hp: MAX_HP, xp: 100 },
            );
        world.write_model_test(@TileOccupant { x: 0, y: 0, game_id: attacker_id });

        let defender_id: u32 = 20;
        world
            .write_model_test(
                @GameSession { game_id: defender_id, player: defender_addr, is_active: true },
            );
        world
            .write_model_test(
                @PlayerState {
                    game_id: defender_id,
                    position: Vec2 { x: 1, y: 0 },
                    last_direction: Option::None,
                    can_move: true,
                },
            );
        world
            .write_model_test(
                @PlayerStats { game_id: defender_id, hp: MAX_HP, max_hp: MAX_HP, xp: 100 },
            );
        world.write_model_test(@TileOccupant { x: 1, y: 0, game_id: defender_id });

        // Both have equal XP (100 == 100), attacker wins (defender penalised).
        starknet::testing::set_contract_address(attacker_addr);
        game.move(attacker_id, Direction::East);

        let atk_stats: PlayerStats = world.read_model(attacker_id);
        let def_stats: PlayerStats = world.read_model(defender_id);
        let atk_state: PlayerState = world.read_model(attacker_id);
        let def_state: PlayerState = world.read_model(defender_id);

        // Attacker wins: moves to defender's tile, gets XP
        assert(atk_state.position.x == 1 && atk_state.position.y == 0, 'atk should move');
        assert(atk_stats.hp == MAX_HP, 'winner hp should be full');
        assert(atk_stats.xp == 100 + COMBAT_XP_REWARD, 'winner xp wrong');
        // Defender loses: swapped to attacker's old position, takes damage
        assert(def_state.position.x == 0 && def_state.position.y == 0, 'def should swap');
        assert(def_stats.hp == MAX_HP - COMBAT_DAMAGE, 'loser hp wrong');
        assert(def_stats.xp == 100, 'loser xp should not change');
    }
}
