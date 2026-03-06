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
   * Initialize game state from blockchain
   * Uses single get_game_state call following death-mountain pattern
   */
  const initializeGame = useCallback(async () => {
    if (!address) return;

    try {
      setIsInitializing(true);
      clearError();

      // debugLog("Initializing game for player", address);

      // Set player address in store
      initializePlayerState(address);

      // Load game_id from localStorage if available
      const storageKey = `hexed_game_id_${address}`;
      const savedGameId = localStorage.getItem(storageKey);

      if (savedGameId) {
        const gameId = savedGameId;
        if (gameId && gameId !== "0") {
          // debugLog("Loaded game_id from localStorage", gameId);
          setGameId(gameId);

          // Fetch complete game state with single RPC call
          const gameState = await getGameState(gameId);

          if (gameState) {
            // Validate ownership with normalized addresses
            const gamePlayer = normalizeAddress(gameState.player);
            const connectedAddr = normalizeAddress(address);

            if (gamePlayer === connectedAddr) {
              // debugLog("Game state loaded successfully", gameState);

              // Populate store
              setPosition({
                player: address,
                vec: gameState.position,
              });
              setMoves({
                player: address,
                last_direction: gameState.last_direction,
                can_move: gameState.can_move,
              });
              setStats(gameState.hp, gameState.max_hp, gameState.xp);
              setOccupiedNeighbors(gameState.neighbor_occupancy);
              setIsSpawned(gameState.is_active);

              // Detect death: player has a game but is no longer active with 0 HP
              if (!gameState.is_active && gameState.hp === 0) {
                setIsDead(true, gameState.xp, "Fell in a previous battle");
                // Register death score on leaderboard
                await registerDeathScore(gameState.xp);
              }

              setIsInitialized(true);
              // debugLog("Game initialization complete");
            } else {
              localStorage.removeItem(storageKey);
              setGameId(null);
              setIsSpawned(false);
              setIsInitialized(true);
            }
          } else {
            setIsSpawned(false);
            setIsInitialized(true);
          }
        } else {
          // Invalid game ID from storage
          setIsSpawned(false);
          setIsInitialized(true);
        }
      } else {
        // No saved game - player needs to spawn
        setIsSpawned(false);
        setIsInitialized(true);
      }

      // Fetch highest score for leaderboard display (always fetch, regardless of game state)
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
   * Manually refresh game state from blockchain
   * Uses single get_game_state call following death-mountain pattern
   */
  const refreshGameState = useCallback(async () => {
    if (!address || !gameId) return;

    try {
      // debugLog("Manually refreshing game state");

      // Fetch fresh state with single RPC call
      const gameState = await getGameState(gameId);

      if (gameState) {
        // Validate ownership with normalized addresses
        const gamePlayer = normalizeAddress(gameState.player);
        const connectedAddr = normalizeAddress(address);

        if (gamePlayer === connectedAddr) {
          // Update store
          setPosition({
            player: address,
            vec: gameState.position,
          });
          setMoves({
            player: address,
            last_direction: gameState.last_direction,
            can_move: gameState.can_move,
          });
          setStats(gameState.hp, gameState.max_hp, gameState.xp);
          setOccupiedNeighbors(gameState.neighbor_occupancy);
          setIsSpawned(gameState.is_active);

          // Detect death
          if (!gameState.is_active && gameState.hp === 0) {
            setIsDead(true, gameState.xp, "Slain by another player");
            await registerDeathScore(gameState.xp);
          }
        } else {
          // console.warn("Game ownership mismatch during refresh");
          // console.warn("Game player:", gameState.player, "→", gamePlayer);
          // console.warn("Connected:", address, "→", connectedAddr);
          setError("Game ownership validation failed");
        }
      } else {
        setError("Failed to load game state");
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
