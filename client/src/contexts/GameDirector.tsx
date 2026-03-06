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
import { num } from "starknet";
import { useController } from "./controller";
import { useGameStore, initializePlayerState } from "@/stores/gameStore";
import { useUIStore } from "@/stores/uiStore";
import { useStarknetApi } from "@/api/starknet";
import { useSystemCalls } from "@/dojo/useSystemCalls";
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
 * Normalize Starknet address for comparison
 * Handles different padding/formatting
 */
const normalizeAddress = (addr: string): string => {
  try {
    return num.toHex(num.toBigInt(addr));
  } catch {
    return addr.toLowerCase();
  }
};

/**
 * Game Director Provider
 * Manages game initialization, state synchronization, and event processing
 */
export const GameDirectorProvider = ({ children }: PropsWithChildren) => {
  const { address, playerName } = useController();
  const { getGameState, getHighestScore } = useStarknetApi();
  const { registerScore, executeAction } = useSystemCalls();

  const {
    playerAddress,
    gameId,
    setPlayerAddress,
    setPosition,
    setMoves,
    setIsSpawned,
    setGameId,
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
   * Register player's final score when they die
   * Called when death is detected from blockchain state
   */
  const registerDeathScore = useCallback(
    async (finalXp: number) => {
      if (!address) return;

      try {
        const scoreCall = registerScore(
          address,
          playerName || address,
          finalXp
        );

        // Execute register_score without waiting for confirmation
        await executeAction(
          [scoreCall],
          () => {},
          () => {}
        );

        // Fetch and update highest score
        const highestScore = await getHighestScore();
        if (highestScore) {
          setHighestScore(highestScore);
        }
      } catch (error) {
        console.error("Error registering death score:", error);
        // Don't fail death detection if score registration fails
      }
    },
    [address, playerName, registerScore, executeAction, getHighestScore, setHighestScore]
  );

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
   * Initialize game state from blockchain.
   * Loads saved token_id (hex) from localStorage and fetches game state.
   */
  const initializeGame = useCallback(async () => {
    if (!address) return;

    try {
      setIsInitializing(true);
      clearError();

      initializePlayerState(address);

      // Load token_id from localStorage
      const storageKey = `hexed_game_id_${address}`;
      const savedTokenId = localStorage.getItem(storageKey);

      if (savedTokenId && savedTokenId !== "0") {
        setGameId(savedTokenId);

        const gameState = await getGameState(savedTokenId);

        if (gameState) {
          const gamePlayer = normalizeAddress(gameState.player);
          const connectedAddr = normalizeAddress(address);

          if (gamePlayer === connectedAddr) {
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
              setIsDead(true, gameState.xp, "Fell in a previous battle");
              await registerDeathScore(gameState.xp);
            }
          } else {
            // Ownership mismatch — stale localStorage entry
            localStorage.removeItem(storageKey);
            setGameId(null);
            setIsSpawned(false);
          }
        } else {
          setIsSpawned(false);
        }
      } else {
        setIsSpawned(false);
      }

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
    setGameId,
    getGameState,
    getHighestScore,
    registerDeathScore,
    setPosition,
    setMoves,
    setIsSpawned,
    setIsDead,
    setIsInitializing,
    setStats,
    setOccupiedNeighbors,
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

      const gamePlayer = normalizeAddress(gameState.player);
      const connectedAddr = normalizeAddress(address);

      if (gamePlayer !== connectedAddr) {
        setError("Game ownership validation failed");
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
        await registerDeathScore(gameState.xp);
      }
    } catch (error) {
      console.error("Error refreshing game state:", error);
      setError("Failed to refresh game state");
    }
  }, [
    address,
    gameId,
    getGameState,
    registerDeathScore,
    setPosition,
    setMoves,
    setIsSpawned,
    setIsDead,
    setStats,
    setOccupiedNeighbors,
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
