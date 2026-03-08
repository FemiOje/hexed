/**
 * Game Director Context
 *
 * Orchestrates game state, entity synchronization, and event processing
 * Following death-mountain pattern for game director
 */

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useController } from "./controller";
import { useGameStore, initializePlayerState } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import { useStarknetApi } from "@/api/starknet";
import { GameEvent } from "@/types/game";

export interface GameDirectorContext {
  isInitialized: boolean;
  initializeGame: () => Promise<void>;
  processEvent: (event: GameEvent) => void;
  refreshGameState: () => Promise<void>;
}

const GameDirectorContext = createContext<GameDirectorContext>(
  {} as GameDirectorContext
);

/**
 * Game Director Provider
 * Manages game initialization, state synchronization, and event processing
 */
export const GameDirectorProvider = ({ children }: PropsWithChildren) => {
  const { address } = useController();
  const { getGameState, getHighestScore } = useStarknetApi();

  const {
    playerAddress,
    gameId,
    setPlayerAddress,
    setPosition,
    setMoves,
    setIsSpawned,
    setIsInitializing,
    setStats,
    setIsDead,
    setOccupiedNeighbors,
    setHighestScore,
    addEvent,
    resetGameState,
  } = useGameStore();

  const { setError, clearError } = useUIStore();

  const [isInitialized, setIsInitialized] = useState(false);

  /**
   * Initialize game state when wallet connects
   */
  useEffect(() => {
    if (address && address !== playerAddress) {
      // debugLog("Wallet connected, initializing game state", address);
      initializeGame();
    } else if (!address && playerAddress) {
      // debugLog("Wallet disconnected, resetting game state");
      resetGameState();
      setPlayerAddress(null);
      setIsInitialized(false);
    }
  }, [address, playerAddress]);

  /**
   * Initialize game state on wallet connect.
   * Game discovery is handled by the Denshokan SDK on the start page;
   * game state is loaded when the player navigates to /game?id={tokenId}.
   */
  const initializeGame = useCallback(async () => {
    if (!address) return;

    try {
      setIsInitializing(true);
      clearError();

      initializePlayerState(address);
      setIsSpawned(false);
      setIsInitialized(true);

      // Always fetch leaderboard
      const highestScore = await getHighestScore();
      if (highestScore) {
        setHighestScore(highestScore);
      }
    } catch (error) {
      console.error("Error initializing game:", error);
      setError("Failed to initialize game state");
    } finally {
      setIsInitializing(false);
    }
  }, [
    address,
    getHighestScore,
    setIsSpawned,
    setIsInitializing,
    setHighestScore,
    clearError,
    setError,
  ]);

  /**
   * Process game event and update state
   * @param event - GameEvent to process
   */
  const processEvent = useCallback(
    (event: GameEvent) => {
      addEvent(event);

      switch (event.type) {
        case "spawned":
          if (event.position) {
            setPosition(event.position);
            setIsSpawned(true);
            setMoves({
              player: event.position.player,
              last_direction: null,
              can_move: true,
            });
          }
          break;

        case "moved":
          if (event.position) {
            setPosition(event.position);
          }
          if (event.moves) {
            setMoves(event.moves);
          }
          break;

        case "combat_result":
          if (event.position) {
            setPosition(event.position);
          }
          break;

        case "position_update":
          if (event.position) {
            setPosition(event.position);
          }
          break;

        case "neighbors_revealed":
          if (event.neighborsOccupied !== undefined) {
            setOccupiedNeighbors(event.neighborsOccupied);
          }
          break;
      }
    },
    [addEvent, setPosition, setMoves, setIsSpawned, setOccupiedNeighbors]
  );

  /**
   * Refresh game state from blockchain via get_game_state(token_id).
   */
  const refreshGameState = useCallback(async () => {
    if (!address || !gameId) return;

    try {
      const gameState = await getGameState(gameId);

      if (!gameState) {
        setError("Failed to load game state");
        return;
      }

      setPosition({ player: address, vec: gameState.position });
      setMoves({
        player: address,
        last_direction: gameState.last_direction,
        can_move: gameState.can_move,
      });
      setStats(gameState.hp, gameState.max_hp, gameState.xp);
      setOccupiedNeighbors(gameState.neighbor_occupancy);
      setIsSpawned(gameState.is_active);

      if (!gameState.is_active && gameState.hp === 0) {
        setIsDead(true, gameState.xp, "Slain by another player");

        // Refresh leaderboard — score was auto-registered by the contract on death
        const highestScore = await getHighestScore();
        if (highestScore) {
          setHighestScore(highestScore);
        }
      }
    } catch (error) {
      console.error("Error refreshing game state:", error);
      setError("Failed to refresh game state");
    }
  }, [
    address,
    gameId,
    getGameState,
    getHighestScore,
    setPosition,
    setMoves,
    setIsSpawned,
    setIsDead,
    setStats,
    setOccupiedNeighbors,
    setHighestScore,
    setError,
  ]);

  return (
    <GameDirectorContext.Provider
      value={{
        isInitialized,
        initializeGame,
        processEvent,
        refreshGameState,
      }}
    >
      {children}
    </GameDirectorContext.Provider>
  );
};

/**
 * Hook to access Game Director
 */
export const useGameDirector = () => {
  const context = useContext(GameDirectorContext);
  if (!context) {
    throw new Error(
      "useGameDirector must be used within a GameDirectorProvider"
    );
  }
  return context;
};
