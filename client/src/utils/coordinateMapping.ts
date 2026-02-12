/**
 * Coordinate System Mapping
 *
 * Maps between blockchain coordinates and UI coordinates:
 * - Blockchain: Vec2 {x, y} - Pure axial coordinates (q, r)
 * - UI: HexPosition {col, row} - Pure axial coordinates (q, r)
 * - Three.js rendering: Converts axial to 3D space correctly (see three/utils.ts)
 *
 * Both systems use identical axial coordinates, so the mapping is a direct 1:1:
 * x = col (q-axis), y = row (r-axis)
 *
 * Direction mapping (0-based to match Cairo enum serialization):
 * - Direction.East (0) = Vec2(+1, 0) = HexPosition(+1, 0)
 * - Direction.NorthEast (1) = Vec2(+1, -1) = HexPosition(+1, -1)
 * - Direction.NorthWest (2) = Vec2(0, -1) = HexPosition(0, -1)
 * - Direction.West (3) = Vec2(-1, 0) = HexPosition(-1, 0)
 * - Direction.SouthWest (4) = Vec2(-1, +1) = HexPosition(-1, +1)
 * - Direction.SouthEast (5) = Vec2(0, +1) = HexPosition(0, +1)
 *
 * Note: The rendering layer (three/utils.ts) handles conversion from axial to
 * 3D pixel coordinates for display, but the logical coordinate system remains
 * pure axial throughout.
 */

import type { Vec2 } from "@/types/game";
import type { HexPosition } from "@/three/utils";

/**
 * Convert blockchain Vec2 coordinates to UI HexPosition
 * @param vec - Blockchain position {x, y}
 * @returns UI position {col, row}
 */
export function vec2ToHexPosition(vec: Vec2): HexPosition {
  const result = {
    col: vec.x,
    row: vec.y,
  };
  return result;
}

/**
 * Convert UI HexPosition to blockchain Vec2 coordinates
 * @param hex - UI position {col, row}
 * @returns Blockchain position {x, y}
 */
export function hexPositionToVec2(hex: HexPosition): Vec2 {
  return {
    x: hex.col,
    y: hex.row,
  };
}

/**
 * Calculate which direction represents a move from one position to another
 * Returns null if positions are not adjacent
 * @param from - Starting position
 * @param to - Target position
 * @returns Direction enum value or null
 */
export function calculateDirection(from: HexPosition, to: HexPosition): number | null {
  const dx = to.col - from.col;
  const dy = to.row - from.row;

  // Direction mapping based on Vec2 offsets
  // Uses 0-based indexing to match Cairo enum serialization
  const directionMap: Record<string, number> = {
    "1,0": 0,    // East
    "1,-1": 1,   // NorthEast
    "0,-1": 2,   // NorthWest
    "-1,0": 3,   // West
    "-1,1": 4,   // SouthWest
    "0,1": 5,    // SouthEast
  };

  const key = `${dx},${dy}`;
  const direction = directionMap[key] ?? null;

  return direction;
}

/**
 * Get all adjacent hex positions (6 neighbors)
 * @param pos - Center position
 * @returns Array of 6 neighboring positions
 */
export function getAdjacentHexPositions(pos: HexPosition): HexPosition[] {
  return [
    { col: pos.col + 1, row: pos.row },      // East
    { col: pos.col + 1, row: pos.row - 1 },  // NorthEast
    { col: pos.col, row: pos.row - 1 },      // NorthWest
    { col: pos.col - 1, row: pos.row },      // West
    { col: pos.col - 1, row: pos.row + 1 },  // SouthWest
    { col: pos.col, row: pos.row + 1 },      // SouthEast
  ];
}

/**
 * Check if two hex positions are adjacent (neighbors)
 * @param a - First position
 * @param b - Second position
 * @returns True if positions are neighbors
 */
export function areHexPositionsAdjacent(a: HexPosition, b: HexPosition): boolean {
  return calculateDirection(a, b) !== null;
}
