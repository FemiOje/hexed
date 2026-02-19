use starknet::ContractAddress;

// Combat & stat constants
pub const STARTING_HP: u32 = 100;
pub const MAX_HP: u32 = 100;
pub const COMBAT_DAMAGE: u32 = 10;
pub const COMBAT_XP_REWARD: u32 = 30;
pub const EXPLORE_XP_REWARD: u32 = 10;

// Encounter constants
pub const MIN_MAX_HP: u32 = 10;
pub const GIFT_THRESHOLD: u8 = 65; // 0-64 = gift (65%), 65-99 = curse (35%)

// Gift amounts
pub const HEAL_AMOUNT: u32 = 20;
pub const FORTIFY_HP_AMOUNT: u32 = 10;
pub const FORTIFY_MAX_HP_AMOUNT: u32 = 10;
pub const EMPOWER_XP_AMOUNT: u32 = 25;
pub const BLESSING_HP_AMOUNT: u32 = 10;
pub const BLESSING_MAX_HP_AMOUNT: u32 = 5;
pub const BLESSING_XP_AMOUNT: u32 = 15;

// Curse amounts
pub const POISON_DAMAGE: u32 = 15;
pub const WITHER_MAX_HP_AMOUNT: u32 = 10;
pub const DRAIN_XP_AMOUNT: u32 = 20;
pub const HEX_HP_AMOUNT: u32 = 10;
pub const HEX_MAX_HP_AMOUNT: u32 = 5;
pub const HEX_XP_AMOUNT: u32 = 10;

// Maps game_id → player address and tracks active state
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct GameSession {
    #[key]
    pub game_id: u32,
    pub player: ContractAddress,
    pub is_active: bool,
}

// All mutable game state for a session
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerState {
    #[key]
    pub game_id: u32,
    pub position: Vec2,
    pub last_direction: Option<Direction>,
    pub can_move: bool,
}

// Reverse lookup: who occupies a given tile? (0 = empty)
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct TileOccupant {
    #[key]
    pub x: i32,
    #[key]
    pub y: i32,
    pub game_id: u32,
}

// Player combat stats (separate from spatial state for ECS cleanliness)
#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerStats {
    #[key]
    pub game_id: u32,
    pub hp: u32,
    pub max_hp: u32,
    pub xp: u32,
}

// Return struct for get_game_state view function (not a model)
#[derive(Copy, Drop, Serde)]
pub struct GameState {
    pub game_id: u32,
    pub player: ContractAddress,
    pub position: Vec2,
    pub last_direction: Option<Direction>,
    pub can_move: bool,
    pub is_active: bool,
    pub hp: u32,
    pub max_hp: u32,
    pub xp: u32,
    pub neighbor_occupancy: u8,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum Direction {
    #[default]
    East, // 0: E:  (+1,  0)
    NorthEast, // 1: NE: (+1, -1)
    NorthWest, // 2: NW: ( 0, -1)
    West, // 3: W:  (-1,  0)
    SouthWest, // 4: SW: (-1, +1)
    SouthEast // 5: SE: ( 0, +1)
}

#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, DojoStore)]
pub struct Vec2 {
    pub x: i32,
    pub y: i32,
}


impl DirectionIntoFelt252 of Into<Direction, felt252> {
    fn into(self: Direction) -> felt252 {
        match self {
            Direction::East => 0,
            Direction::NorthEast => 1,
            Direction::NorthWest => 2,
            Direction::West => 3,
            Direction::SouthWest => 4,
            Direction::SouthEast => 5,
        }
    }
}

impl OptionDirectionIntoFelt252 of Into<Option<Direction>, felt252> {
    fn into(self: Option<Direction>) -> felt252 {
        match self {
            Option::None => 0,
            Option::Some(d) => d.into(),
        }
    }
}

#[generate_trait]
impl Vec2Impl of Vec2Trait {
    fn is_zero(self: Vec2) -> bool {
        if self.x - self.y == 0 {
            return true;
        }
        false
    }

    fn is_equal(self: Vec2, b: Vec2) -> bool {
        self.x == b.x && self.y == b.y
    }
}

#[cfg(test)]
mod tests {
    use super::{COMBAT_DAMAGE, MAX_HP, STARTING_HP, Vec2, Vec2Trait};

    #[test]
    fn test_vec_is_zero() {
        assert(Vec2Trait::is_zero(Vec2 { x: 0, y: 0 }), 'not zero');
    }

    #[test]
    fn test_vec_is_equal() {
        let position = Vec2 { x: 420, y: 0 };
        assert(position.is_equal(Vec2 { x: 420, y: 0 }), 'not equal');
    }

    #[test]
    fn test_hp_constants_valid() {
        assert(STARTING_HP <= MAX_HP, 'STARTING_HP exceeds MAX_HP');
        assert(MAX_HP > 0, 'MAX_HP must be positive');
        assert(COMBAT_DAMAGE > 0, 'COMBAT_DAMAGE must be positive');
    }
}
