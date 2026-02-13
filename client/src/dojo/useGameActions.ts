/**
 * useGameActions Hook
 *
 * Enhanced hook with Zustand store integration and optimistic updates
 * Following death-mountain pattern for game actions
 */

import { useState, useCallback } from "react";
import { useSystemCalls } from "./useSystemCalls";
import { useGameDirector } from "@/contexts/GameDirector";
import { useGameStore, createOptimisticMove } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import { Direction, isVec2Equal } from "@/types/game";
import { useController } from "@/contexts/controller";
import { debugLog } from "@/utils/helpers";
import toast from "react-hot-toast";

export const useGameActions = () => {
  const { address } = useController();
  const { spawn, move, executeAction, setCurrentMoves } = useSystemCalls();
  const { processEvent, refreshGameState } = useGameDirector();

  // Get store state and actions
  const {
    setOptimisticPosition,
    rollbackOptimisticPosition,
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
      toast.error("No wallet connected");
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
              const storageKey = `untitled_game_id_${address}`;
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
   * Move player in specified direction with optimistic update
   * @param direction - Direction enum value
   */
  const handleMove = useCallback(
    async (direction: Direction) => {
      if (!address) {
        toast.error("No wallet connected");
        return;
      }

      if (!gameId) {
        toast.error("No active game");
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

      // Save pre-move position for combat detection fallback
      const preMovePos = { ...currentPos };

      try {
        setIsMoving(true);
        setIsTransactionPending(true);

        // Optimistic update: calculate and show new position immediately
        const optimisticPos = createOptimisticMove(direction);
        if (optimisticPos) {
          setOptimisticPosition(optimisticPos);
        }

        // Create move call with game_id
        const moveCall = move(gameId, direction);

        // Execute with callbacks
        const events = await executeAction(
          [moveCall],
          () => {
            rollbackOptimisticPosition();
            setIsMoving(false);
            setIsTransactionPending(false);
            toast.error("Move action failed");
          },
          () => {
            setIsTransactionPending(false);
          }
        );

        // Detect move outcome from events
        // Using string type since TS can't track reassignment inside forEach
        let moveOutcome = "unknown";

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
        });

        // Show immediate toast if event was parsed
        if (moveOutcome === "moved") {
          toast.success("Moved!");
        } else if (moveOutcome === "combat_won") {
          toast.success("Won combat! Swapped positions.");
        } else if (moveOutcome === "combat_lost") {
          toast.error("Lost combat! Move failed.");
          rollbackOptimisticPosition();
        }

        // Delay refresh to give blockchain time to index
        setTimeout(async () => {
          await refreshGameState();

          // Fallback combat detection: if events weren't parsed (stale manifest),
          // compare position after refresh to detect combat outcome
          if (moveOutcome === "unknown" && optimisticPos) {
            const refreshedPos = useGameStore.getState().position?.vec;
            if (refreshedPos) {
              if (isVec2Equal(refreshedPos, preMovePos)) {
                // Position didn't change — combat loss
                toast.error("Lost combat! Move failed.");
              } else if (isVec2Equal(refreshedPos, optimisticPos)) {
                toast.success("Moved!");
              } else {
                // Position changed but not to expected destination — combat win (swap)
                toast.success("Won combat! Swapped positions.");
              }
            }
          }

          // Always clear optimistic after refresh to prevent stale display
          rollbackOptimisticPosition();
        }, 2000);

        setIsMoving(false);
      } catch (error) {
        console.error("Move error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        rollbackOptimisticPosition();

        setError(errorMessage);
        toast.error(errorMessage);
        setIsMoving(false);
        setIsTransactionPending(false);
      }
    },
    [
      address,
      gameId,
      move,
      executeAction,
      processEvent,
      refreshGameState,
      setOptimisticPosition,
      rollbackOptimisticPosition,
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
