use dojo::model::ModelStorage;
use hexed::constants::constants::{GRID_MAX, GRID_MIN};
use hexed::models::{Direction, GameSession, TileOccupant, Vec2};

/// Get neighbor hex in axial coordinates (pointy-top orientation)
/// Axial system: q (x-axis), r (y-axis)
pub fn get_neighbor(position: Vec2, direction: Direction) -> Vec2 {
    let q = position.x;
    let r = position.y;

    match direction {
        Direction::East => Vec2 { x: q + 1, y: r }, // (+1,  0)
        Direction::NorthEast => Vec2 { x: q + 1, y: r - 1 }, // (+1, -1)
        Direction::NorthWest => Vec2 { x: q, y: r - 1 }, // ( 0, -1)
        Direction::West => Vec2 { x: q - 1, y: r }, // (-1,  0)
        Direction::SouthWest => Vec2 { x: q - 1, y: r + 1 }, // (-1, +1)
        Direction::SouthEast => Vec2 { x: q, y: r + 1 } // ( 0, +1)
    }
}

/// Get a u8 bitmask indicating which of the 6 neighbors are occupied by active players.
/// Bit i corresponds to direction i (East=0, NE=1, NW=2, W=3, SW=4, SE=5).
pub fn get_neighbor_occupancy(ref world: dojo::world::WorldStorage, position: Vec2) -> u8 {
    let directions: [Direction; 6] = [
        Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West,
        Direction::SouthWest, Direction::SouthEast,
    ];

    let mut mask: u8 = 0;
    let mut i: u32 = 0;
    while i < 6 {
        let dir = *directions.span().at(i);
        let neighbor = get_neighbor(position, dir);
        if is_within_bounds(neighbor) {
            let tile: TileOccupant = world.read_model((neighbor.x, neighbor.y));
            if tile.game_id != 0 {
                let session: GameSession = world.read_model(tile.game_id);
                if session.is_active {
                    mask = mask | pow2(i);
                }
            }
        }
        i += 1;
    }
    mask
}

/// Returns 2^n for n in [0, 7].
fn pow2(n: u32) -> u8 {
    if n == 0 {
        1
    } else if n == 1 {
        2
    } else if n == 2 {
        4
    } else if n == 3 {
        8
    } else if n == 4 {
        16
    } else if n == 5 {
        32
    } else if n == 6 {
        64
    } else {
        128
    }
}

/// Check if hex is within 10x10 grid bounds centered at origin
/// Validates that coordinates are in the range [GRID_MIN, GRID_MAX] ([-5, 4])
pub fn is_within_bounds(position: Vec2) -> bool {
    position.x >= GRID_MIN
        && position.x <= GRID_MAX
        && position.y >= GRID_MIN
        && position.y <= GRID_MAX
}

#[cfg(test)]
mod tests {
    use hexed::models::{Direction, Vec2};
    use super::{get_neighbor, is_within_bounds};

    #[test]
    fn test_hex_movement_east() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::East);
        assert(next.x == 1, 'East q failed');
        assert(next.y == 0, 'East r failed');
    }

    #[test]
    fn test_hex_movement_northeast() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::NorthEast);
        assert(next.x == 1, 'NE q failed');
        assert(next.y == -1, 'NE r failed');
    }

    #[test]
    fn test_hex_movement_northwest() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::NorthWest);
        assert(next.x == 0, 'NW q failed');
        assert(next.y == -1, 'NW r failed');
    }

    #[test]
    fn test_hex_movement_west() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::West);
        assert(next.x == -1, 'West q failed');
        assert(next.y == 0, 'West r failed');
    }

    #[test]
    fn test_hex_movement_southwest() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::SouthWest);
        assert(next.x == -1, 'SW q failed');
        assert(next.y == 1, 'SW r failed');
    }

    #[test]
    fn test_hex_movement_southeast() {
        let pos = Vec2 { x: 0, y: 0 };
        let next = get_neighbor(pos, Direction::SouthEast);
        assert(next.x == 0, 'SE q failed');
        assert(next.y == 1, 'SE r failed');
    }

    #[test]
    fn test_boundary_validation() {
        // Origin is valid (center of grid)
        assert(is_within_bounds(Vec2 { x: 0, y: 0 }), 'Origin failed');
        // Min corner (-10, -10) is valid
        assert(is_within_bounds(Vec2 { x: -10, y: -10 }), 'Min corner failed');
        // Max corner (10, 10) is valid
        assert(is_within_bounds(Vec2 { x: 10, y: 10 }), 'Max corner failed');
        // Negative positions within range are valid
        assert(is_within_bounds(Vec2 { x: -3, y: 5 }), 'Neg pos failed');
        // Out of bounds: positive overflow
        assert(!is_within_bounds(Vec2 { x: 11, y: 0 }), 'Out +q failed');
        assert(!is_within_bounds(Vec2 { x: 0, y: 11 }), 'Out +r failed');
        // Out of bounds: negative overflow
        assert(!is_within_bounds(Vec2 { x: -11, y: 0 }), 'Out -q failed');
        assert(!is_within_bounds(Vec2 { x: 0, y: -11 }), 'Out -r failed');
    }
}
