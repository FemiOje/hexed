use dojo::model::ModelStorage;
use hexed::helpers::combat::add_xp;
use hexed::models::{Direction, EXPLORE_XP_REWARD, PlayerState, PlayerStats, TileOccupant, Vec2};

/// Executes a normal move to an empty tile.
/// Handles tile updates, state changes, and exploration XP.
/// Does NOT emit Moved event — the caller is responsible for that.
pub fn execute_move(
    ref world: dojo::world::WorldStorage,
    game_id: u32,
    ref state: PlayerState,
    next_position: Vec2,
    direction: Direction,
) {
    let old_position = state.position;

    // Clear old tile
    world.write_model(@TileOccupant { x: old_position.x, y: old_position.y, game_id: 0 });

    // Claim new tile
    world.write_model(@TileOccupant { x: next_position.x, y: next_position.y, game_id });

    // Update player state
    state.position = next_position;
    state.last_direction = Option::Some(direction);
    world.write_model(@state);

    // Award exploration XP
    let mut stats: PlayerStats = world.read_model(game_id);
    add_xp(ref stats, EXPLORE_XP_REWARD);
    world.write_model(@stats);
}
