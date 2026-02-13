/**
 * Event Processing Utilities
 *
 * Handle transaction events and translate them to GameEvent types
 * Following death-mountain pattern for event processing
 */

import { GameEvent, Direction } from "@/types/game";
import { debugLog } from "./helpers";

/**
 * Parse Vec2 from event data
 * @param data - Event data array
 * @param offset - Starting offset in data array
 * @returns Parsed Vec2 object
 */
function parseVec2(data: string[], offset: number): { x: number; y: number } {
  return {
    x: parseInt(data[offset] || "0", 16),
    y: parseInt(data[offset + 1] || "0", 16),
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
      debugLog("Event selector not found in manifest:", eventSelector);
      return { type: "unknown" };
    }

    // Extract event name from tag (e.g., "dojo_starter-Spawned" -> "Spawned")
    const eventName = eventDef?.tag?.split("-")[1]?.toLowerCase();

    // Parse Dojo StoreSetRecord data format
    // data[0] = number of keys
    const numKeys = parseInt(data[0] || "0", 16);
    // data[1..numKeys] = key values
    const gameId = parseInt(data[1] || "0", 16); // First key is game_id
    // data[numKeys + 1] = number of values
    const numValues = parseInt(data[numKeys + 1] || "0", 16);
    // data[numKeys + 2..] = value fields
    const valueOffset = numKeys + 2;

    debugLog("Parsing event:", {
      eventName,
      selector: eventSelector,
      numKeys,
      numValues,
      gameId,
      data,
    });

    // Parse Spawned event
    // Key: game_id
    // Values: player (address), position.x, position.y
    if (eventName === "spawned") {
      const player = data[valueOffset]; // player is first value
      const vec = parseVec2(data, valueOffset + 1); // position follows player

      debugLog("Parsed Spawned event:", { gameId, player, vec });

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

      debugLog("Parsed Moved event:", { gameId, direction, vec });

      return {
        type: "moved",
        gameId,
        direction,
        position: {
          player: "", // Player not in Moved event anymore
          vec,
        },
      };
    }

    // Parse CombatResult event
    // Key: attacker_game_id
    // Values: defender_game_id, attacker_won (0/1), attacker_position.x, attacker_position.y, defender_position.x, defender_position.y
    if (eventName === "combatresult") {
      const defenderGameId = parseInt(data[valueOffset] || "0", 16);
      const attackerWon = parseInt(data[valueOffset + 1] || "0", 16) !== 0;
      const attackerPos = parseVec2(data, valueOffset + 2);
      const defenderPos = parseVec2(data, valueOffset + 4);

      debugLog("Parsed CombatResult event:", {
        gameId,
        defenderGameId,
        attackerWon,
        attackerPos,
        defenderPos,
      });

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
 *
 * @param event - Raw event from transaction receipt
 * @param manifest - Contract manifest for event lookup
 * @returns Typed GameEvent or null
 */
export function translateGameEvent(
  event: any,
  manifest: any
): GameEvent | null {
  try {
    if (!event || !event.keys || event.keys.length === 0) {
      return null;
    }

    // Process the event with manifest for proper parsing
    const processedEvent = processGameEvent(event, manifest);

    if (processedEvent.type !== "unknown") {
      debugLog("Translated event:", processedEvent);
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
 * Filters and processes events from transaction execution
 *
 * @param receipt - Transaction receipt
 * @param manifest - Contract manifest
 * @returns Array of valid GameEvent objects
 */
export function extractGameEvents(
  receipt: any,
  manifest: any
): GameEvent[] {
  try {
    if (!receipt || !receipt.events) {
      return [];
    }

    const translatedEvents = receipt.events
      .map((event: any) => translateGameEvent(event, manifest))
      .filter((event: GameEvent | null): event is GameEvent => event !== null);

    debugLog(`Extracted ${translatedEvents.length} game events from receipt`);

    return translatedEvents;
  } catch (error) {
    console.error("Error extracting game events:", error);
    return [];
  }
}

/**
 * Get event icon/image based on event type
 * @param event - GameEvent object
 * @returns Icon/image path
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
 * @param event - GameEvent object
 * @returns Event title string
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
 * @param direction - Direction enum value
 * @returns Direction name string
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
 * @param _event - GameEvent object
 * @returns True if fatal error
 */
export function isFatalError(_event: GameEvent): boolean {
  // In the future, check for specific error event types
  return false;
}

/**
 * Batch process multiple events
 * @param events - Array of raw events
 * @param manifest - Contract manifest
 * @returns Array of processed GameEvent objects
 */
export function batchProcessEvents(
  events: any[],
  manifest: any
): GameEvent[] {
  return events
    .map((event) => translateGameEvent(event, manifest))
    .filter((event): event is GameEvent => event !== null);
}
