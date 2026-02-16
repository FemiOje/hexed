use untitled::models::{Direction, Vec2};

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

/// Check if hex is within 10x10 grid bounds
/// Validates that coordinates are in the range [0, 10)
pub fn is_within_bounds(position: Vec2) -> bool {
    // Simple rectangular bounding for 10x10 hex grid
    // This allows hexes where 0 <= q < 10 and 0 <= r < 10
    position.x >= 0 && position.x < 10 && position.y >= 0 && position.y < 10
}

// Note: axial_to_cube commented out for future use
// Cairo doesn't support signed integers in the same way
// Will implement when needed for distance calculations

#[cfg(test)]
mod tests {
    use super::{get_neighbor, is_within_bounds};
    use untitled::models::{Direction, Vec2};

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
}
