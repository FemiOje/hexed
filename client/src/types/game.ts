/**
 * Game Types
 *
 * TypeScript interfaces matching Cairo contract models from contracts/src/models.cairo
 */

/**
 * Direction enum matching Cairo Direction model
 * IMPORTANT: Uses 0-based indexing to match Cairo's default enum serialization
 * Represents 6 possible movement directions on a pointy-top hexagonal grid
 */
export enum Direction {
  East = 0,       // E:  (+1,  0)
  NorthEast = 1,  // NE: (+1, -1)
  NorthWest = 2,  // NW: ( 0, -1)
  West = 3,       // W:  (-1,  0)
  SouthWest = 4,  // SW: (-1, +1)
  SouthEast = 5,  // SE: ( 0, +1)
}

/**
 * Vec2 - 2D coordinate vector matching Cairo Vec2 model
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Position model - Player's position on the hex grid
 */
export interface Position {
  player: string;  // ContractAddress as hex string
  vec: Vec2;
}

/**
 * Moves model - Player movement state
 */
export interface Moves {
  player: string;  // ContractAddress as hex string
  last_direction: Direction | null;  // Option<Direction> in Cairo
  can_move: boolean;
}

/**
 * GameSession model - Maps game_id to player and tracks active state
 */
export interface GameSession {
  game_id: number;  // u32
  player: string;   // ContractAddress as hex string
  is_active: boolean;
}

/**
 * PlayerState model - All mutable game state for a session
 */
export interface PlayerState {
  game_id: number;  // u32
  position: Vec2;
  last_direction: Direction | null;
  can_move: boolean;
}

/**
 * GameState - Return struct from get_game_state view function
 */
export interface GameState {
  game_id: number;       // u32
  player: string;        // ContractAddress as hex string
  position: Vec2;
  last_direction: Direction | null;
  can_move: boolean;
  is_active: boolean;
  hp: number;            // Current health points
  max_hp: number;        // Maximum health points cap
  xp: number;            // Experience points
  neighbor_occupancy: number;  // u8 bitmask of occupied neighbor directions
}

/**
 * Game Event types for event processing
 */
export interface GameEvent {
  type: 'spawned' | 'moved' | 'combat_result' | 'position_update' | 'neighbors_revealed' | 'encounter_occurred' | 'unknown';
  gameId?: number;  // game_id from event (u32)
  player?: string;
  position?: Position;
  direction?: Direction;
  moves?: Moves;
  // Combat fields (only present when type === 'combat_result')
  combatWon?: boolean;
  defenderGameId?: number;
  defenderPosition?: Vec2;
  // Neighbor occupancy (only present when type === 'neighbors_revealed')
  neighborsOccupied?: number;  // u8 bitmask
  // Encounter fields (only present when type === 'encounter_occurred')
  isGift?: boolean;
  encounterOutcome?: EncounterOutcome;
  hpAfter?: number;
  maxHpAfter?: number;
  xpAfter?: number;
  encounterPlayerDied?: boolean;
}

/**
 * Game Action types for user actions
 */
export interface GameAction {
  type: 'spawn' | 'move';
  direction?: Direction;
}

/**
 * EncounterOutcome enum matching Cairo EncounterOutcome model
 * Gifts (0-2) and Curses (3-5)
 */
export enum EncounterOutcome {
  Heal = 0,
  Empower = 1,
  Blessing = 2,
  Poison = 3,
  Drain = 4,
  Hex = 5,
}

/**
 * Helper function to convert Direction enum to felt252 value
 * Matches Cairo DirectionIntoFelt252 impl
 */
export function directionToFelt(direction: Direction): number {
  return direction;
}

/**
 * Helper function to convert Direction to string
 */
export function directionToString(direction: Direction): string {
  switch (direction) {
    case Direction.East:
      return "East";
    case Direction.NorthEast:
      return "NorthEast";
    case Direction.NorthWest:
      return "NorthWest";
    case Direction.West:
      return "West";
    case Direction.SouthWest:
      return "SouthWest";
    case Direction.SouthEast:
      return "SouthEast";
    default:
      return "Unknown";
  }
}

/**
 * Helper function to check if Vec2 is zero
 * Matches Cairo Vec2Trait::is_zero
 */
export function isVec2Zero(vec: Vec2): boolean {
  return vec.x === 0 && vec.y === 0;
}

/**
 * Helper function to check if two Vec2 are equal
 * Matches Cairo Vec2Trait::is_equal
 */
export function isVec2Equal(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}
