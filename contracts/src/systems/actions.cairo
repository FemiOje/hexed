use untitled::models::{Direction, GameState};

#[starknet::interface]
pub trait IActions<T> {
    fn spawn(ref self: T);
    fn move(ref self: T, game_id: u32, direction: Direction);
    fn get_game_state(self: @T, game_id: u32) -> GameState;
}

#[dojo::contract]
pub mod actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use untitled::models::{
        Vec2, GameSession, PlayerState, PlayerStats, TileOccupant, STARTING_HP, MAX_HP,
        COMBAT_DAMAGE, COMBAT_XP_REWARD,
    };
    use untitled::utils::hex::{get_neighbor, is_within_bounds};
    use starknet::{ContractAddress, get_caller_address, get_tx_info, get_block_timestamp};
    use super::{Direction, GameState, IActions};
    use dojo::world::IWorldDispatcherTrait;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Spawned {
        #[key]
        pub game_id: u32,
        pub player: ContractAddress,
        pub position: Vec2,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Moved {
        #[key]
        pub game_id: u32,
        pub direction: Direction,
        pub position: Vec2,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct CombatResult {
        #[key]
        pub attacker_game_id: u32,
        pub defender_game_id: u32,
        pub attacker_won: bool,
        pub attacker_position: Vec2,
        pub defender_position: Vec2,
        pub damage_dealt: u32,
        pub xp_awarded: u32,
        pub loser_died: bool,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerDied {
        #[key]
        pub game_id: u32,
        pub killed_by: u32,
        pub position: Vec2,
    }

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn spawn(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();

            // Generate unique game_id (offset by 1 so 0 = "no game")
            let game_id: u32 = world.dispatcher.uuid() + 1;

            // Create session
            world.write_model(@GameSession { game_id, player, is_active: true });

            // Random position logic
            // TODO: Switch to VRF for prod
            let tx_info = get_tx_info().unbox();
            let timestamp = get_block_timestamp();
            let seed: felt252 = timestamp.into() + tx_info.transaction_hash + player.into();
            let seed_u256: u256 = seed.into();
            let x_u32: u32 = (seed_u256 % 10).try_into().unwrap();
            let y_u32: u32 = ((seed_u256 / 10) % 10).try_into().unwrap();
            let x: i32 = x_u32.try_into().unwrap();
            let y: i32 = y_u32.try_into().unwrap();

            // Initialize player state
            let position = Vec2 { x, y };
            let player_state = PlayerState {
                game_id,
                position,
                last_direction: Option::None,
                can_move: true,
            };
            world.write_model(@player_state);

            // Initialize player stats
            world
                .write_model(
                    @PlayerStats { game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 },
                );

            // Mark tile as occupied
            world.write_model(@TileOccupant { x, y, game_id });

            // Emit spawn event with game_id
            world.emit_event(@Spawned { game_id, player, position });
        }

        fn move(ref self: ContractState, game_id: u32, direction: Direction) {
            let mut world = self.world_default();
            let player = get_caller_address();

            // Verify ownership
            let session: GameSession = world.read_model(game_id);
            assert(session.player == player, 'not your game');
            assert(session.is_active, 'game not active');

            // Retrieve player state
            let mut state: PlayerState = world.read_model(game_id);
            assert(state.can_move, 'cannot move');

            // Calculate next position using hex math
            let next_vec = get_neighbor(state.position, direction);

            // Validate bounds
            assert(is_within_bounds(next_vec), 'Move is out of bounds');

            // Check if destination tile is occupied
            let tile: TileOccupant = world.read_model((next_vec.x, next_vec.y));
            let defender_game_id = tile.game_id;

            // Check for active defender on tile
            let tile_has_active_defender = if defender_game_id != 0 {
                let defender_session: GameSession = world.read_model(defender_game_id);
                defender_session.is_active
            } else {
                false
            };

            if tile_has_active_defender {
                // Combat: resolve with pseudo-random outcome
                // TODO: Replace with stat-based combat from game design doc
                let tx_info = get_tx_info().unbox();
                let timestamp = get_block_timestamp();
                let combat_seed: felt252 = timestamp.into()
                    + tx_info.transaction_hash
                    + player.into()
                    + game_id.into();
                let seed_u256: u256 = combat_seed.into();
                let attacker_won = (seed_u256 % 2) == 0;

                let old_position = state.position;

                // Read both players' stats
                let mut attacker_stats: PlayerStats = world.read_model(game_id);
                let mut defender_stats: PlayerStats = world.read_model(defender_game_id);
                let mut loser_died = false;

                if attacker_won {
                    // Winner (attacker): +XP, 0 damage
                    attacker_stats.xp += COMBAT_XP_REWARD;

                    // Loser (defender): -HP, 0 XP
                    if defender_stats.hp <= COMBAT_DAMAGE {
                        defender_stats.hp = 0;
                        loser_died = true;
                    } else {
                        defender_stats.hp -= COMBAT_DAMAGE;
                    }

                    world.write_model(@attacker_stats);
                    world.write_model(@defender_stats);

                    if loser_died {
                        // Defender dies: clean up defender, attacker claims destination
                        InternalImpl::handle_player_death(
                            ref world, defender_game_id, next_vec, game_id,
                        );

                        state.position = next_vec;
                        state.last_direction = Option::Some(direction);
                        world
                            .write_model(
                                @TileOccupant {
                                    x: next_vec.x, y: next_vec.y, game_id,
                                },
                            );
                        world
                            .write_model(
                                @TileOccupant {
                                    x: old_position.x, y: old_position.y, game_id: 0,
                                },
                            );
                        world.write_model(@state);
                    } else {
                        // Defender survives: swap positions
                        let mut defender_state: PlayerState = world
                            .read_model(defender_game_id);

                        state.position = next_vec;
                        state.last_direction = Option::Some(direction);
                        defender_state.position = old_position;

                        world
                            .write_model(
                                @TileOccupant {
                                    x: next_vec.x, y: next_vec.y, game_id,
                                },
                            );
                        world
                            .write_model(
                                @TileOccupant {
                                    x: old_position.x,
                                    y: old_position.y,
                                    game_id: defender_game_id,
                                },
                            );

                        world.write_model(@state);
                        world.write_model(@defender_state);
                    }
                } else {
                    // Winner (defender): +XP, 0 damage
                    defender_stats.xp += COMBAT_XP_REWARD;

                    // Loser (attacker): -HP, 0 XP
                    if attacker_stats.hp <= COMBAT_DAMAGE {
                        attacker_stats.hp = 0;
                        loser_died = true;
                    } else {
                        attacker_stats.hp -= COMBAT_DAMAGE;
                    }

                    world.write_model(@attacker_stats);
                    world.write_model(@defender_stats);

                    if loser_died {
                        // Attacker dies: clean up attacker, defender stays
                        InternalImpl::handle_player_death(
                            ref world, game_id, old_position, defender_game_id,
                        );
                    } else {
                        // Attacker survives: move fails, record attempted direction
                        state.last_direction = Option::Some(direction);
                        world.write_model(@state);
                    }
                }

                world
                    .emit_event(
                        @CombatResult {
                            attacker_game_id: game_id,
                            defender_game_id,
                            attacker_won,
                            attacker_position: if attacker_won {
                                next_vec
                            } else {
                                old_position
                            },
                            defender_position: if attacker_won {
                                old_position
                            } else {
                                next_vec
                            },
                            damage_dealt: COMBAT_DAMAGE,
                            xp_awarded: COMBAT_XP_REWARD,
                            loser_died,
                        },
                    );
            } else {
                // Empty tile (or inactive defender): normal move
                let old_position = state.position;

                // Clear old tile
                world
                    .write_model(
                        @TileOccupant { x: old_position.x, y: old_position.y, game_id: 0 },
                    );

                // Claim new tile
                world.write_model(@TileOccupant { x: next_vec.x, y: next_vec.y, game_id });

                // Update player state
                state.position = next_vec;
                state.last_direction = Option::Some(direction);
                world.write_model(@state);

                // Emit move event
                world.emit_event(@Moved { game_id, direction, position: next_vec });
            }
        }

        fn get_game_state(self: @ContractState, game_id: u32) -> GameState {
            let world = self.world_default();
            let session: GameSession = world.read_model(game_id);
            let state: PlayerState = world.read_model(game_id);
            let stats: PlayerStats = world.read_model(game_id);

            GameState {
                game_id,
                player: session.player,
                position: state.position,
                last_direction: state.last_direction,
                can_move: state.can_move,
                is_active: session.is_active,
                hp: stats.hp,
                max_hp: stats.max_hp,
                xp: stats.xp,
            }
        }
    }


    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"untitled")
        }

        fn handle_player_death(
            ref world: dojo::world::WorldStorage,
            game_id: u32,
            position: Vec2,
            killed_by: u32,
        ) {
            // Clear tile occupancy
            world.write_model(@TileOccupant { x: position.x, y: position.y, game_id: 0 });
    
            // Deactivate session
            let session: GameSession = world.read_model(game_id);
            world.write_model(@GameSession { game_id, player: session.player, is_active: false });
    
            // Disable movement and zero out position
            world
                .write_model(
                    @PlayerState {
                        game_id,
                        position: Vec2 { x: 0, y: 0 },
                        last_direction: Option::None,
                        can_move: false,
                    },
                );
    
            // Emit death event
            world.emit_event(@PlayerDied { game_id, killed_by, position });
        }
    }
}
