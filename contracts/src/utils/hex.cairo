use untitled::models::{Direction, Vec2};
use untitled::constants::constants::{GRID_MIN, GRID_MAX};

/// Get neighbor hex in axial coordinates (pointy-top orientation)
/// Axial system: q (x-axis), r (y-axis)
pub fn get_neighbor(position: Vec2, direction: Direction) -> Vec2 {
    let q = position.x;
    let r = position.y;

    match direction {
        Direction::East =>      Vec2 { x: q + 1, y: r },      // (+1,  0)
        Direction::NorthEast => Vec2 { x: q + 1, y: r - 1 },  // (+1, -1)
        Direction::NorthWest => Vec2 { x: q,     y: r - 1 },  // ( 0, -1)
        Direction::West =>      Vec2 { x: q - 1, y: r },      // (-1,  0)
        Direction::SouthWest => Vec2 { x: q - 1, y: r + 1 },  // (-1, +1)
        Direction::SouthEast => Vec2 { x: q,     y: r + 1 },  // ( 0, +1)
    }
}

/// Check if hex is within 10x10 grid bounds centered at origin
/// Validates that coordinates are in the range [GRID_MIN, GRID_MAX] ([-5, 4])
pub fn is_within_bounds(position: Vec2) -> bool {
    position.x >= GRID_MIN && position.x <= GRID_MAX
        && position.y >= GRID_MIN && position.y <= GRID_MAX
}

#[cfg(test)]
mod tests {
    use super::{get_neighbor, is_within_bounds};
    use untitled::models::{Direction, Vec2};

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
