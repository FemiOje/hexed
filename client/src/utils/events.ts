/**
 * Event Processing Utilities
 *
 * Handle transaction events and translate them to GameEvent types
 * Following death-mountain pattern for event processing
 */

import { GameEvent, Direction, EncounterOutcome } from "@/types/game";
import { feltHexToI32 } from "./helpers";

/**
 * Parse Vec2 from event data
 * @param data - Event data array
 * @param offset - Starting offset in data array
 * @returns Parsed Vec2 object
 */
function parseVec2(data: string[], offset: number): { x: number; y: number } {
  return {
    x: feltHexToI32(data[offset] || "0x0"),
    y: feltHexToI32(data[offset + 1] || "0x0"),
  };
}

/**
 * Process raw game event from contract
 * Parses Dojo events using proper selector matching
 *
 * Dojo StoreSetRecord event structure:
 * - keys[0] = StoreSetRecord selector (world emit marker)
 * - keys[1] = Event selector hash
 * - keys[2] = Namespace hash
 * - keys[3] = Entity selector
 * - data[0] = Number of keys (n)
 * - data[1..n] = Key values (e.g., player address)
 * - data[n+1] = Number of values (m)
 * - data[n+2..n+m+1] = Value fields (e.g., Vec2 x, y)
 *
 * @param event - Raw event from transaction receipt
 * @param manifest - Contract manifest for event lookup
 * @returns Typed GameEvent object
 */
export function processGameEvent(event: any, manifest: any): GameEvent {
  try {
    if (!event || !event.keys || event.keys.length < 2) {
      return { type: "unknown" };
    }

    const eventSelector = event.keys[1];
    const data = event.data || [];

    // Find event definition in manifest
    const eventDef = manifest?.events?.find(
      (def: any) => def.selector === eventSelector
    );

    if (!eventDef) {
      return { type: "unknown" };
    }

    // Extract event name from tag (e.g., "dojo_starter-Spawned" -> "Spawned")
    const eventName = eventDef?.tag?.split("-")[1]?.toLowerCase();

    // Parse Dojo StoreSetRecord data format
    // data[0] = number of keys
    const numKeys = parseInt(data[0] || "0", 16);
    // data[1..numKeys] = key values
    const gameId = data[1] || "0"; // First key is token_id (packed felt252 hex)
    // data[numKeys + 1] = number of values
    const valueOffset = numKeys + 2;

    // Parse Spawned event
    // Key: game_id
    // Values: player (address), position.x, position.y
    if (eventName === "spawned") {
      const player = data[valueOffset]; // player is first value
      const vec = parseVec2(data, valueOffset + 1); // position follows player

      return {
        type: "spawned",
        gameId,
        player,
        position: {
          player,
          vec,
        },
      };
    }

    // Parse Moved event
    // Key: game_id
    // Values: direction, position.x, position.y
    if (eventName === "moved") {
      const direction = parseInt(data[valueOffset] || "0", 16) as Direction;
      const vec = parseVec2(data, valueOffset + 1);

      return {
        type: "moved",
        gameId,
        direction,
        position: {
          player: "",
          vec,
        },
      };
    }

    // Parse NeighborsRevealed event
    // Key: game_id
    // Values: position.x, position.y, neighbors (u8)
    if (eventName === "neighborsrevealed") {
      const vec = parseVec2(data, valueOffset);
      const neighbors = parseInt(data[valueOffset + 2] || "0", 16);

      return {
        type: "neighbors_revealed",
        gameId,
        position: {
          player: "",
          vec,
        },
        neighborsOccupied: neighbors,
      };
    }

    // Parse EncounterOccurred event
    // Key: game_id
    // Values: is_gift (0/1), outcome (EncounterOutcome enum), hp_after, max_hp_after, xp_after, player_died (0/1)
    if (eventName === "encounteroccurred") {
      const isGift = parseInt(data[valueOffset] || "0", 16) !== 0;
      const outcome = parseInt(data[valueOffset + 1] || "0", 16) as EncounterOutcome;
      const hpAfter = parseInt(data[valueOffset + 2] || "0", 16);
      const maxHpAfter = parseInt(data[valueOffset + 3] || "0", 16);
      const xpAfter = parseInt(data[valueOffset + 4] || "0", 16);
      const playerDied = parseInt(data[valueOffset + 5] || "0", 16) !== 0;

      return {
        type: "encounter_occurred",
        gameId,
        isGift,
        encounterOutcome: outcome,
        hpAfter,
        maxHpAfter,
        xpAfter,
        encounterPlayerDied: playerDied,
      };
    }

    // Parse CombatResult event
    // Key: attacker_game_id
    // Values: defender_game_id, attacker_won (0/1), attacker_position.x, attacker_position.y, defender_position.x, defender_position.y
    if (eventName === "combatresult") {
      const defenderGameId = data[valueOffset] || "0";
      const attackerWon = parseInt(data[valueOffset + 1] || "0", 16) !== 0;
      const attackerPos = parseVec2(data, valueOffset + 2);
      const defenderPos = parseVec2(data, valueOffset + 4);

      return {
        type: "combat_result",
        gameId,
        combatWon: attackerWon,
        defenderGameId,
        position: {
          player: "",
          vec: attackerPos,
        },
        defenderPosition: defenderPos,
      };
    }

    return { type: "unknown" };
  } catch (error) {
    console.error("Error processing game event:", error, event);
    return { type: "unknown" };
  }
}

/**
 * Translate game event from transaction receipt
 * Maps raw transaction events to typed GameEvent objects
 */
export function translateGameEvent(
  event: any,
  manifest: any
): GameEvent | null {
  try {
    if (!event || !event.keys || event.keys.length === 0) {
      return null;
    }

    const processedEvent = processGameEvent(event, manifest);

    if (processedEvent.type !== "unknown") {
      return processedEvent;
    }

    return null;
  } catch (error) {
    console.error("Error translating game event:", error);
    return null;
  }
}

/**
 * Extract valid game events from transaction receipt
 */
export function extractGameEvents(
  receipt: any,
  manifest: any
): GameEvent[] {
  try {
    if (!receipt || !receipt.events) {
      return [];
    }

    return receipt.events
      .map((event: any) => translateGameEvent(event, manifest))
      .filter((event: GameEvent | null): event is GameEvent => event !== null);
  } catch (error) {
    console.error("Error extracting game events:", error);
    return [];
  }
}

/**
 * Get event icon/image based on event type
 */
export function getEventIcon(event: GameEvent): string {
  switch (event.type) {
    case "spawned":
      return "/icons/spawn.svg";
    case "moved":
      return "/icons/move.svg";
    case "combat_result":
      return "/icons/combat.svg";
    case "position_update":
      return "/icons/position.svg";
    default:
      return "/icons/default.svg";
  }
}

/**
 * Get human-readable event title
 */
export function getEventTitle(event: GameEvent): string {
  switch (event.type) {
    case "spawned":
      return "Player Spawned";
    case "moved":
      return event.direction
        ? `Moved ${getDirectionName(event.direction)}`
        : "Player Moved";
    case "combat_result":
      return event.combatWon ? "Won Combat!" : "Lost Combat";
    case "position_update":
      return "Position Updated";
    default:
      return "Unknown Event";
  }
}

/**
 * Get direction name from Direction enum
 */
function getDirectionName(direction: Direction): string {
  const names: Record<Direction, string> = {
    [Direction.East]: "East",
    [Direction.NorthEast]: "Northeast",
    [Direction.NorthWest]: "Northwest",
    [Direction.West]: "West",
    [Direction.SouthWest]: "Southwest",
    [Direction.SouthEast]: "Southeast",
  };
  return names[direction] || "Unknown";
}

/**
 * Check if event is a fatal error
 */
export function isFatalError(_event: GameEvent): boolean {
  return false;
}

/**
 * Batch process multiple events
 */
export function batchProcessEvents(
  events: any[],
  manifest: any
): GameEvent[] {
  return events
    .map((event) => translateGameEvent(event, manifest))
    .filter((event): event is GameEvent => event !== null);
}
