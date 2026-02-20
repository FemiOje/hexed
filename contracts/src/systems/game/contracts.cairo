use hexed::models::{Direction, GameState};


#[starknet::interface]
pub trait IGameSystems<T> {
    fn spawn(ref self: T);
    fn move(ref self: T, game_id: u32, direction: Direction);
    fn get_game_state(self: @T, game_id: u32) -> GameState;
    fn register_score(ref self: T, player: starknet::ContractAddress, username: felt252, xp: u32);
    fn get_highest_score(self: @T) -> (starknet::ContractAddress, felt252, u32);
}

#[dojo::contract]
pub mod game_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::IWorldDispatcherTrait;
    use hexed::constants::constants::DEFAULT_NS;
    use hexed::helpers::encounter::{EncounterOutcomeIntoU8, EncounterOutcomeTrait};
    use hexed::helpers::{combat, encounter, movement, spawn};
    use hexed::models::{
        COMBAT_DAMAGE, COMBAT_XP_REWARD, GameCounter, GameSession, HighestScore, MAX_CONCURRENT_GAMES,
        MAX_HP, PlayerState, PlayerStats, STARTING_HP, TileOccupant, Vec2,
    };
    use hexed::utils::hex::{get_neighbor, get_neighbor_occupancy, is_within_bounds};
    use starknet::{ContractAddress, get_caller_address};
    use super::{Direction, GameState, IGameSystems};

    // ------------------------------------------ //
    // ------------ Events --------------------- //
    // ------------------------------------------ //

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

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct NeighborsRevealed {
        #[key]
        pub game_id: u32,
        pub position: Vec2,
        pub neighbors: u8,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EncounterOccurred {
        #[key]
        pub game_id: u32,
        pub is_gift: bool,
        pub outcome: u8,
        pub hp_after: u32,
        pub max_hp_after: u32,
        pub xp_after: u32,
        pub player_died: bool,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct HighestScoreUpdated {
        #[key]
        pub player: ContractAddress,
        pub username: felt252,
        pub xp: u32,
    }

    // ------------------------------------------ //
    // ------------ Impl ----------------------- //
    // ------------------------------------------ //

    #[abi(embed_v0)]
    impl GameSystemsImpl of IGameSystems<ContractState> {
        fn spawn(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();

            // Check entry limit
            let mut counter: GameCounter = world.read_model(0_u32);
            assert(counter.active_games < MAX_CONCURRENT_GAMES, 'game limit reached');
            counter.active_games += 1;
            world.write_model(@counter);

            // Generate unique game_id (offset by 1 so 0 = "no game")
            let game_id: u32 = world.dispatcher.uuid() + 1;

            // Create session
            world.write_model(@GameSession { game_id, player, is_active: true });

            // Generate random spawn position
            let position = spawn::generate_spawn_position(player);

            // Initialize player state
            world
                .write_model(
                    @PlayerState {
                        game_id, position, last_direction: Option::None, can_move: true,
                    },
                );

            // Initialize player stats
            world.write_model(@PlayerStats { game_id, hp: STARTING_HP, max_hp: MAX_HP, xp: 0 });

            // Mark tile as occupied
            world.write_model(@TileOccupant { x: position.x, y: position.y, game_id });

            // Emit spawn event
            world.emit_event(@Spawned { game_id, player, position });

            // Reveal occupied neighbors
            let neighbors = get_neighbor_occupancy(ref world, position);
            world.emit_event(@NeighborsRevealed { game_id, position, neighbors });
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

            // Check if destination tile is occupied by an active defender
            let tile: TileOccupant = world.read_model((next_vec.x, next_vec.y));

            if combat::has_active_defender(ref world, tile.game_id) {
                let defender_game_id = tile.game_id;
                let outcome = combat::resolve_combat(
                    ref world, game_id, defender_game_id, ref state, direction,
                );

                world
                    .emit_event(
                        @CombatResult {
                            attacker_game_id: game_id,
                            defender_game_id,
                            attacker_won: outcome.attacker_won,
                            attacker_position: outcome.attacker_position,
                            defender_position: outcome.defender_position,
                            damage_dealt: COMBAT_DAMAGE,
                            xp_awarded: COMBAT_XP_REWARD,
                            loser_died: outcome.loser_died,
                        },
                    );

                if outcome.loser_died {
                    let (dead_id, killer_id) = if outcome.attacker_won {
                        (defender_game_id, game_id)
                    } else {
                        (game_id, defender_game_id)
                    };
                    world
                        .emit_event(
                            @PlayerDied {
                                game_id: dead_id,
                                killed_by: killer_id,
                                position: outcome.death_position,
                            },
                        );
                }

                // Reveal occupied neighbors from attacker's final position
                let final_position = outcome.attacker_position;
                let neighbors = get_neighbor_occupancy(ref world, final_position);
                world
                    .emit_event(
                        @NeighborsRevealed { game_id, position: final_position, neighbors },
                    );
            } else {
                movement::execute_move(ref world, game_id, ref state, next_vec, direction);

                world.emit_event(@Moved { game_id, direction, position: next_vec });

                // Resolve encounter on the new tile
                let enc = encounter::resolve_encounter(ref world, game_id, next_vec);

                world
                    .emit_event(
                        @EncounterOccurred {
                            game_id,
                            is_gift: enc.outcome.is_gift(),
                            outcome: enc.outcome.into(),
                            hp_after: enc.hp_after,
                            max_hp_after: enc.max_hp_after,
                            xp_after: enc.xp_after,
                            player_died: enc.player_died,
                        },
                    );

                if enc.player_died {
                    world.emit_event(@PlayerDied { game_id, killed_by: 0, position: next_vec });
                } else {
                    // Only reveal neighbors if player is alive
                    let neighbors = get_neighbor_occupancy(ref world, next_vec);
                    world.emit_event(@NeighborsRevealed { game_id, position: next_vec, neighbors });
                }
            }
        }

        fn get_game_state(self: @ContractState, game_id: u32) -> GameState {
            let mut world = self.world_default();
            let session: GameSession = world.read_model(game_id);
            let state: PlayerState = world.read_model(game_id);
            let stats: PlayerStats = world.read_model(game_id);
            let neighbor_occupancy = get_neighbor_occupancy(ref world, state.position);

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
                neighbor_occupancy,
            }
        }

        fn register_score(
            ref self: ContractState, player: ContractAddress, username: felt252, xp: u32,
        ) {
            let mut world = self.world_default();
            let mut current: HighestScore = world.read_model(0_u32);

            // If this is the first score or higher than current, update
            if xp > current.xp {
                current.player = player;
                current.username = username;
                current.xp = xp;
                current.game_id = 0_u32; // Singleton key

                world.write_model(@current);
                world.emit_event(@HighestScoreUpdated { player, username, xp });
            }
        }

        fn get_highest_score(self: @ContractState) -> (ContractAddress, felt252, u32) {
            let mut world = self.world_default();
            let score: HighestScore = world.read_model(0_u32);
            (score.player, score.username, score.xp)
        }
    }

    // ------------------------------------------ //
    // ------------ Internal ------------------- //
    // ------------------------------------------ //

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@DEFAULT_NS())
        }
    }
}
