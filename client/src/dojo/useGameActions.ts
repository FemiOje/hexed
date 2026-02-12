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
import { useUIStore, showSuccessNotification, showErrorNotification } from "@/stores/uiStore";
import { Direction } from "@/types/game";
import { useController } from "@/contexts/controller";
import { debugLog } from "@/utils/helpers";

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
      showErrorNotification("No wallet connected");
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
          showErrorNotification("Spawn action failed");
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

          showSuccessNotification("Player spawned successfully!");
        }
      });

      // Refresh state from blockchain to ensure accuracy
      await refreshGameState();

      setIsSpawning(false);
    } catch (error) {
      console.error("Spawn error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      showErrorNotification(errorMessage);
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
        showErrorNotification("No wallet connected");
        return;
      }

      if (!gameId) {
        showErrorNotification("No active game");
        return;
      }

      if (!canPlayerMove()) {
        showErrorNotification("Cannot move yet");
        return;
      }

      const currentPos = getCurrentPosition();
      if (!currentPos) {
        showErrorNotification("Position not found");
        return;
      }

      try {
        setIsMoving(true);
        setIsTransactionPending(true);

        // debugLog("Moving player", { gameId, currentPos, direction });

        // Optimistic update: calculate and show new position immediately
        const optimisticPos = createOptimisticMove(direction);
        if (optimisticPos) {
          setOptimisticPosition(optimisticPos);
          // debugLog("Optimistic position set", optimisticPos);
        }

        // Create move call with game_id
        const moveCall = move(gameId, direction);

        // Execute with callbacks
        const events = await executeAction(
          [moveCall],
          () => {
            // Rollback optimistic update on failure
            // debugLog("Move failed, rolling back optimistic update");
            rollbackOptimisticPosition();
            setIsMoving(false);
            setIsTransactionPending(false);
            showErrorNotification("Move action failed");
          },
          () => {
            // Success callback
            // debugLog("Move transaction confirmed");
            setIsTransactionPending(false);
          }
        );

        // debugLog("Move events received", events);

        // Process events through GameDirector
        events.forEach((event) => {
          processEvent(event);

          if (event.type === "moved") {
            // debugLog("Player moved", event.position);

            // Update current moves state for sync checking
            if (event.moves) {
              setCurrentMoves(event.moves);
            }

            showSuccessNotification("Moved successfully!");
          }
        });

        // Delay refresh to give blockchain time to index the transaction
        // The optimistic update keeps UI responsive during this delay
        setTimeout(async () => {
          await refreshGameState();
        }, 2000);

        setIsMoving(false);
      } catch (error) {
        console.error("Move error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Rollback optimistic update on error
        rollbackOptimisticPosition();

        setError(errorMessage);
        showErrorNotification(errorMessage);
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

  return {
    // Actions
    handleSpawn,
    handleMove,

    // Loading states
    isSpawning,
    isMoving,
    isLoading: isSpawning || isMoving,
  };
};
