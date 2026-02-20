/**
 * useGameActions Hook
 *
 * Enhanced hook with Zustand store integration and optimistic updates
 * Following death-mountain pattern for game actions
 */

import { useState, useCallback } from "react";
import { useSystemCalls } from "./useSystemCalls";
import { useGameDirector } from "@/contexts/GameDirector";
import { useGameStore } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import { Direction, directionToString, EncounterOutcome, GameEvent } from "@/types/game";
import { useController } from "@/contexts/controller";
import { debugLog } from "@/utils/helpers";
import toast from "react-hot-toast";

/**
 * Format encounter event into a display string
 */
function formatEncounterText(event: GameEvent): string {
  switch (event.encounterOutcome) {
    case EncounterOutcome.Heal:
      return "HEAL! +20 HP";
    case EncounterOutcome.Empower:
      return "EMPOWER! +25 XP";
    case EncounterOutcome.Blessing:
      return "BLESSING! +10 HP, +15 XP";
    case EncounterOutcome.Poison:
      return "POISON!! -15 HP";
    case EncounterOutcome.Drain:
      return "DRAIN!! -5 XP";
    case EncounterOutcome.Hex:
      return "HEX!! -10 HP, -5 XP";
    default:
      return "Unknown encounter";
  }
}

export const useGameActions = () => {
  const { address } = useController();
  const { spawn, move, executeAction, setCurrentMoves } = useSystemCalls();
  const { processEvent, refreshGameState } = useGameDirector();

  // Get store state and actions
  const {
    setIsSpawned,
    setGameId,
    getCurrentPosition,
    canPlayerMove,
  } = useGameStore();

  // Get current game_id from store
  const gameId = useGameStore((state) => state.gameId);

  const { setIsTransactionPending, setError } = useUIStore();

  const [isSpawning, setIsSpawning] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  /**
   * Spawn a new player
   * Creates player at spawn point and initializes game state
   */
  const handleSpawn = useCallback(async () => {
    if (!address) {
      toast.error("No account connected");
      return;
    }

    try {
      setIsSpawning(true);
      setIsTransactionPending(true);

      debugLog("Spawning player", address);

      // Create spawn call
      const spawnCall = spawn();

      // Execute with callbacks
      const events = await executeAction(
        [spawnCall],
        () => {
          // Rollback on failure
          debugLog("Spawn failed, reverting state");
          setIsSpawning(false);
          setIsTransactionPending(false);
          toast.error("Spawn action failed");
        },
        () => {
          // Success callback
          debugLog("Spawn transaction confirmed");
          setIsTransactionPending(false);
        }
      );

      debugLog("Spawn events received", events);

      // Process events through GameDirector
      events.forEach((event) => {
        processEvent(event);

        if (event.type === "spawned") {
          debugLog("Player spawned", event.position);
          setIsSpawned(true);

          // Capture and save game_id
          if (event.gameId) {
            debugLog("Captured game_id from spawn event:", event.gameId);
            setGameId(event.gameId);

            // Save to localStorage for persistence
            if (address) {
              const storageKey = `hexed_game_id_${address}`;
              localStorage.setItem(storageKey, event.gameId.toString());
              debugLog("Saved game_id to localStorage", { key: storageKey, gameId: event.gameId });
            }
          }

          toast.success("Player spawned!");
        }
      });

      // Refresh state from blockchain to ensure accuracy
      await refreshGameState();

      setIsSpawning(false);
    } catch (error) {
      console.error("Spawn error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSpawning(false);
      setIsTransactionPending(false);
    }
  }, [
    address,
    spawn,
    executeAction,
    processEvent,
    refreshGameState,
    setIsSpawned,
    setGameId,
    setIsTransactionPending,
    setError,
  ]);

  /**
   * Move player in specified direction
   * Waits for blockchain confirmation before updating UI
   * @param direction - Direction enum value
   */
  const handleMove = useCallback(
    async (direction: Direction) => {
      if (!address) {
        toast.error("No account connected");
        return;
      }

      if (!gameId) {
        toast.error("No active game");
        return;
      }

      if (isMoving) {
        return;
      }

      if (!canPlayerMove()) {
        toast.error("Cannot move yet");
        return;
      }

      const currentPos = getCurrentPosition();
      if (!currentPos) {
        toast.error("Position not found");
        return;
      }

      try {
        setIsMoving(true);
        setIsTransactionPending(true);

        // Capture pre-move stats for delta calculation
        const prevHp = useGameStore.getState().hp;
        const prevXp = useGameStore.getState().xp;

        // Create move call with game_id
        const moveCall = move(gameId, direction);

        // Execute with callbacks
        const events = await executeAction(
          [moveCall],
          () => {
            setIsMoving(false);
            setIsTransactionPending(false);
            toast.error("Move action failed");
          },
          () => {
            setIsTransactionPending(false);
          }
        );

        // Detect move outcome and capture encounter event
        let moveOutcome = "unknown";
        let encounterEvent: GameEvent | null = null;

        events.forEach((event) => {
          processEvent(event);

          if (event.type === "moved") {
            moveOutcome = "moved";
            if (event.moves) {
              setCurrentMoves(event.moves);
            }
          }

          if (event.type === "combat_result") {
            moveOutcome = event.combatWon ? "combat_won" : "combat_lost";
          }

          if (event.type === "encounter_occurred") {
            encounterEvent = event;
          }
        });

        // Refresh full state (HP/XP/can_move) from blockchain using pre_confirmed block tag.
        // This reads from the pending block that includes our pre-confirmed tx.
        await refreshGameState();

        // Compute stat deltas after refresh
        const newHp = useGameStore.getState().hp;
        const newXp = useGameStore.getState().xp;
        const playerDied = useGameStore.getState().isDead;
        const hpDelta = newHp - prevHp;
        const xpGained = newXp - prevXp;

        // Override death reason with specific cause from move outcome
        if (playerDied) {
          const reason = moveOutcome === "combat_lost"
            ? "Defeated in combat with another player"
            : "Killed by a deadly encounter";
          useGameStore.getState().setIsDead(true, newXp, reason);
        }

        // --- Toast logic ---
        if (moveOutcome === "combat_won" || moveOutcome === "combat_lost") {
          // Combat: single toast (keep existing style)
          const combatTitle = moveOutcome === "combat_won" ? "Won combat!" : "Lost combat!";
          const combatColor = moveOutcome === "combat_won" ? "#4caf50" : "#f44336";
          toast.custom(
            (t) => (
              <div
                style={{
                  opacity: t.visible ? 1 : 0,
                  transition: "opacity 0.2s ease",
                  background: "rgba(10, 10, 30, 0.95)",
                  border: `1px solid ${combatColor}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  color: "#e0e0e0",
                  fontFamily: "monospace",
                  fontSize: 13,
                  maxWidth: 280,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6, color: combatColor }}>
                  {combatTitle}
                </div>
                {xpGained !== 0 && (
                  <div style={{ color: xpGained > 0 ? "#4caf50" : "#f44336" }}>
                    {xpGained > 0 ? "+" : ""}{xpGained} XP
                  </div>
                )}
                {hpDelta !== 0 && (
                  <div style={{ color: hpDelta > 0 ? "#4caf50" : "#f44336" }}>
                    {hpDelta > 0 ? "+" : ""}{hpDelta} HP
                  </div>
                )}
              </div>
            ),
            { duration: 3000 }
          );
        } else if (moveOutcome === "moved") {
          // Toast 1: Movement toast (always shown)
          toast.custom(
            (t) => (
              <div
                style={{
                  opacity: t.visible ? 1 : 0,
                  transition: "opacity 0.2s ease",
                  background: "rgba(10, 10, 30, 0.95)",
                  border: "1px solid #4285f4",
                  borderRadius: 8,
                  padding: "12px 16px",
                  color: "#e0e0e0",
                  fontFamily: "monospace",
                  fontSize: 13,
                  maxWidth: 280,
                }}
              >
                <div style={{ fontWeight: 600, color: "#4285f4" }}>
                  Moved {directionToString(direction)}, +10 XP
                </div>
              </div>
            ),
            { duration: 2500 }
          );

          // Toast 2: Encounter toast (if encounter event was received)
          if (encounterEvent) {
            const enc = encounterEvent as GameEvent;
            const encounterText = formatEncounterText(enc);
            const encounterColor = enc.isGift ? "#4caf50" : "#f44336";

            setTimeout(() => {
              toast.custom(
                (t) => (
                  <div
                    style={{
                      opacity: t.visible ? 1 : 0,
                      transition: "opacity 0.2s ease",
                      background: "rgba(10, 10, 30, 0.95)",
                      border: `1px solid ${encounterColor}`,
                      borderRadius: 8,
                      padding: "12px 16px",
                      color: "#e0e0e0",
                      fontFamily: "monospace",
                      fontSize: 13,
                      maxWidth: 280,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: encounterColor }}>
                      {encounterText}
                    </div>
                  </div>
                ),
                { duration: 3000 }
              );
            }, 400);
          }
        }
      } catch (error) {
        console.error("Move error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsMoving(false);
        setIsTransactionPending(false);
      }
    },
    [
      address,
      gameId,
      isMoving,
      move,
      executeAction,
      processEvent,
      refreshGameState,
      getCurrentPosition,
      canPlayerMove,
      setCurrentMoves,
      setIsTransactionPending,
      setError,
    ]
  );

  // Get error state from UI store
  const lastError = useUIStore((state) => state.lastError);
  const clearErrorAction = useUIStore((state) => state.clearError);

  return {
    // Actions
    handleSpawn,
    handleMove,

    // Loading states
    isSpawning,
    isMoving,
    isLoading: isSpawning || isMoving,

    // Error handling
    lastError,
    clearError: clearErrorAction,
  };
};
