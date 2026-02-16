/**
 * Position Tracking Utilities
 *
 * Utilities for hex grid position management and movement calculation
 * Following death-mountain pattern for accurate position tracking
 */

import { Vec2, Direction, Position } from "@/types/game";
import { isVec2Equal } from "@/types/game";

/**
 * Direction vectors for hex grid movement
 * Matches Cairo Direction enum values
 */
export const DIRECTION_VECTORS: Record<Direction, Vec2> = {
  [Direction.East]: { x: 1, y: 0 },        // E:  (+1,  0)
  [Direction.NorthEast]: { x: 1, y: -1 },  // NE: (+1, -1)
  [Direction.NorthWest]: { x: 0, y: -1 },  // NW: ( 0, -1)
  [Direction.West]: { x: -1, y: 0 },       // W:  (-1,  0)
  [Direction.SouthWest]: { x: -1, y: 1 },  // SW: (-1, +1)
  [Direction.SouthEast]: { x: 0, y: 1 },   // SE: ( 0, +1)
};

/**
 * Calculate new position after moving in a direction
 * @param currentPos - Current position
 * @param direction - Direction to move
 * @returns New position
 */
export function calculateNewPosition(
  currentPos: Vec2,
  direction: Direction
): Vec2 {
  const vector = DIRECTION_VECTORS[direction];
  return {
    x: currentPos.x + vector.x,
    y: currentPos.y + vector.y,
  };
}

/**
 * Validate if position is within grid bounds
 * Grid is centered at origin: [-5, 4] for a 10x10 grid
 * @param pos - Position to validate
 * @param gridMin - Minimum coordinate (inclusive)
 * @param gridMax - Maximum coordinate (inclusive)
 * @returns True if position is valid
 */
export function isValidPosition(pos: Vec2, gridMin: number = -10, gridMax: number = 10): boolean {
  return pos.x >= gridMin && pos.x <= gridMax && pos.y >= gridMin && pos.y <= gridMax;
}

/**
 * Calculate distance between two positions
 * Uses hex grid distance formula
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance in hex tiles
 */
export function calculateDistance(pos1: Vec2, pos2: Vec2): number {
  // Convert axial coordinates to cube coordinates
  const x1 = pos1.x;
  const z1 = pos1.y;
  const y1 = -x1 - z1;

  const x2 = pos2.x;
  const z2 = pos2.y;
  const y2 = -x2 - z2;

  // Calculate distance
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

/**
 * Get all valid adjacent positions
 * @param pos - Current position
 * @param gridSize - Grid size
 * @returns Array of valid adjacent positions
 */
export function getAdjacentPositions(
  pos: Vec2,
  gridMin: number = -10,
  gridMax: number = 10
): Vec2[] {
  const adjacent: Vec2[] = [];

  for (const direction of Object.values(Direction)) {
    if (typeof direction === "number") {
      const newPos = calculateNewPosition(pos, direction);
      if (isValidPosition(newPos, gridMin, gridMax)) {
        adjacent.push(newPos);
      }
    }
  }

  return adjacent;
}

/**
 * Check if two positions are adjacent
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns True if positions are adjacent
 */
export function arePositionsAdjacent(pos1: Vec2, pos2: Vec2): boolean {
  return calculateDistance(pos1, pos2) === 1;
}

/**
 * Get direction from one position to another
 * @param from - Starting position
 * @param to - Target position
 * @returns Direction or null if not adjacent
 */
export function getDirectionBetween(
  from: Vec2,
  to: Vec2
): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Check each direction
  for (const [direction, vector] of Object.entries(DIRECTION_VECTORS)) {
    if (vector.x === dx && vector.y === dy) {
      return parseInt(direction) as Direction;
    }
  }

  return null;
}

/**
 * Position history for tracking player movement
 */
export class PositionHistory {
  private history: Vec2[] = [];
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Add position to history
   * @param pos - Position to add
   */
  push(pos: Vec2): void {
    this.history.push({ ...pos });
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }
  }

  /**
   * Get most recent position
   * @returns Most recent position or null
   */
  getCurrent(): Vec2 | null {
    return this.history.length > 0
      ? { ...this.history[this.history.length - 1] }
      : null;
  }

  /**
   * Get previous position
   * @returns Previous position or null
   */
  getPrevious(): Vec2 | null {
    return this.history.length > 1
      ? { ...this.history[this.history.length - 2] }
      : null;
  }

  /**
   * Get all positions in history
   * @returns Array of positions
   */
  getAll(): Vec2[] {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get history size
   * @returns Number of positions in history
   */
  size(): number {
    return this.history.length;
  }

  /**
   * Check if position was visited
   * @param pos - Position to check
   * @returns True if position is in history
   */
  hasVisited(pos: Vec2): boolean {
    return this.history.some((p) => isVec2Equal(p, pos));
  }
}

/**
 * Validate position object
 * @param position - Position to validate
 * @returns True if position is valid
 */
export function isValidPositionObject(position: any): position is Position {
  return (
    position &&
    typeof position === "object" &&
    typeof position.player === "string" &&
    position.vec &&
    typeof position.vec === "object" &&
    typeof position.vec.x === "number" &&
    typeof position.vec.y === "number"
  );
}

/**
 * Create default position
 * @param player - Player address
 * @returns Default Position object
 */
export function createDefaultPosition(player: string): Position {
  return {
    player,
    vec: { x: 0, y: 0 },
  };
}
