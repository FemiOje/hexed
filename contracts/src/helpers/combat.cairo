use dojo::model::ModelStorage;
use hexed::models::{
    COMBAT_DAMAGE, COMBAT_HP_REWARD, COMBAT_RETALIATION_DAMAGE, COMBAT_XP_REWARD, Direction,
    GameCounter, GameSession, PlayerState, PlayerStats, TileOccupant, Vec2,
};
use hexed::utils::hex::get_neighbor;

/// Returned by resolve_combat so the caller can emit events.
#[derive(Drop, Copy)]
pub struct CombatOutcome {
    pub attacker_won: bool,
    pub attacker_died: bool,
    pub defender_died: bool,
    pub attacker_position: Vec2,
    pub defender_position: Vec2,
}

/// Checks whether the tile's occupant is an active player.
pub fn has_active_defender(ref world: dojo::world::WorldStorage, defender_game_id: u32) -> bool {
    if defender_game_id != 0 {
        let defender_session: GameSession = world.read_model(defender_game_id);
        defender_session.is_active
    } else {
        false
    }
}

/// Adds XP with saturation at u32::MAX.
pub fn add_xp(ref stats: PlayerStats, amount: u32) {
    let max: u32 = 0xFFFFFFFF;
    if stats.xp > max - amount {
        stats.xp = max;
    } else {
        stats.xp += amount;
    }
}

/// Resolves combat between attacker and defender.
/// Winner is the player with higher XP. Equal XP penalises the defender (attacker wins).
/// Handles all model writes (stats, tiles, positions, death cleanup).
/// Returns outcome data for the caller to emit events.
pub fn resolve_combat(
    ref world: dojo::world::WorldStorage,
    game_id: u32,
    defender_game_id: u32,
    ref state: PlayerState,
    direction: Direction,
) -> CombatOutcome {
    let old_position = state.position;
    let next_vec = get_neighbor(old_position, direction);

    let mut attacker_stats: PlayerStats = world.read_model(game_id);
    let mut defender_stats: PlayerStats = world.read_model(defender_game_id);

    // Higher XP wins. Equal XP penalises defender (attacker wins).
    let attacker_won = attacker_stats.xp >= defender_stats.xp;
    let mut attacker_died = false;
    let mut defender_died = false;

    if attacker_won {
        add_xp(ref attacker_stats, COMBAT_XP_REWARD);

        // Attacker heals on win (capped at max_hp)
        let hp_headroom = attacker_stats.max_hp - attacker_stats.hp;
        if hp_headroom < COMBAT_HP_REWARD {
            attacker_stats.hp = attacker_stats.max_hp;
        } else {
            attacker_stats.hp += COMBAT_HP_REWARD;
        }

        if defender_stats.hp <= COMBAT_DAMAGE {
            defender_stats.hp = 0;
            defender_died = true;
        } else {
            defender_stats.hp -= COMBAT_DAMAGE;
        }

        world.write_model(@attacker_stats);
        world.write_model(@defender_stats);

        if defender_died {
            handle_player_death(ref world, defender_game_id, next_vec, game_id);

            state.position = next_vec;
            state.last_direction = Option::Some(direction);
            world.write_model(@TileOccupant { x: next_vec.x, y: next_vec.y, game_id });
            world.write_model(@TileOccupant { x: old_position.x, y: old_position.y, game_id: 0 });
            world.write_model(@state);
        } else {
            let mut defender_state: PlayerState = world.read_model(defender_game_id);

            state.position = next_vec;
            state.last_direction = Option::Some(direction);
            defender_state.position = old_position;

            world.write_model(@TileOccupant { x: next_vec.x, y: next_vec.y, game_id });
            world
                .write_model(
                    @TileOccupant {
                        x: old_position.x, y: old_position.y, game_id: defender_game_id,
                    },
                );

            world.write_model(@state);
            world.write_model(@defender_state);
        }
    } else {
        // Defender wins but receives no XP reward (passive participant)

        // Attacker takes full combat damage
        if attacker_stats.hp <= COMBAT_DAMAGE {
            attacker_stats.hp = 0;
            attacker_died = true;
        } else {
            attacker_stats.hp -= COMBAT_DAMAGE;
        }

        // Defender takes retaliation damage (half of combat damage)
        if defender_stats.hp <= COMBAT_RETALIATION_DAMAGE {
            defender_stats.hp = 0;
            defender_died = true;
        } else {
            defender_stats.hp -= COMBAT_RETALIATION_DAMAGE;
        }

        world.write_model(@attacker_stats);
        world.write_model(@defender_stats);

        if attacker_died {
            handle_player_death(ref world, game_id, old_position, defender_game_id);
        } else {
            state.last_direction = Option::Some(direction);
            world.write_model(@state);
        }

        if defender_died {
            handle_player_death(ref world, defender_game_id, next_vec, game_id);
        }
    }

    CombatOutcome {
        attacker_won,
        attacker_died,
        defender_died,
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
    }
}

/// Cleans up a dead player: clears tile, deactivates session, disables movement, decrements game
/// counter.
/// Does NOT emit PlayerDied event — the caller is responsible for that.
pub fn handle_player_death(
    ref world: dojo::world::WorldStorage, game_id: u32, position: Vec2, killed_by: u32,
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

    // Decrement active game counter
    let mut counter: GameCounter = world.read_model(0_u32);
    if counter.active_games > 0 {
        counter.active_games -= 1;
        world.write_model(@counter);
    }
}

