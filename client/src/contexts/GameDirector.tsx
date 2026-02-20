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
import { debugLog } from "@/utils/helpers";

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
        debugLog("Registering death score on leaderboard", {
          address,
          playerName,
          finalXp,
        });

        console.log("[LEADERBOARD] Registering score:", {
          player: address,
          username: playerName || address,
          xp: finalXp,
          timestamp: new Date().toISOString(),
        });

        const scoreCall = registerScore(
          address,
          playerName || address,
          finalXp
        );

        console.log("[LEADERBOARD] Score call created:", scoreCall);

        // Execute register_score without waiting for confirmation
        await executeAction(
          [scoreCall],
          () => {
            console.error("[LEADERBOARD] Death score registration failed");
            debugLog("Death score registration failed");
          },
          () => {
            console.log("[LEADERBOARD] Death score registration submitted");
            debugLog("Death score registration submitted");
          }
        );

        // Fetch and update highest score
        console.log("[LEADERBOARD] Fetching highest score...");
        const highestScore = await getHighestScore();
        if (highestScore) {
          console.log("[LEADERBOARD] Updated highest score:", highestScore);
          debugLog("Updated highest score after death", highestScore);
          setHighestScore(highestScore);
        } else {
          console.log("[LEADERBOARD] No highest score returned from RPC");
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
    if (!address) {
      console.warn("Cannot initialize game: no address");
      return;
    }

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
        const gameId = parseInt(savedGameId, 10);
        if (!isNaN(gameId) && gameId > 0) {
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
              console.warn("Game ownership mismatch, clearing localStorage");
              console.warn("Game player:", gameState.player, "→", gamePlayer);
              console.warn("Connected:", address, "→", connectedAddr);
              localStorage.removeItem(storageKey);
              setGameId(null);
              setIsSpawned(false);
              setIsInitialized(true);
            }
          } else {
            debugLog("Game state not found, player may need to spawn");
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
        debugLog("No active game found, player needs to spawn");
        setIsSpawned(false);
        setIsInitialized(true);
      }

      // Fetch highest score for leaderboard display (always fetch, regardless of game state)
      const highestScore = await getHighestScore();
      if (highestScore) {
        debugLog("Loaded highest score", highestScore);
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
      debugLog("Processing game event", event);

      // Add event to log
      addEvent(event);

      // Update state based on event type
      switch (event.type) {
        case "spawned":
          if (event.position) {
            setPosition(event.position);
            setIsSpawned(true);

            // Initialize Moves state - contract creates Moves with can_move: true during spawn
            setMoves({
              player: event.position.player,
              last_direction: null,
              can_move: true,
            });

            debugLog("Player spawned at", event.position.vec);
          }
          break;

        case "moved":
          if (event.position) {
            setPosition(event.position);
            debugLog("Player moved to", event.position.vec);
          }
          if (event.moves) {
            setMoves(event.moves);
          }
          break;

        case "combat_result":
          if (event.position) {
            setPosition(event.position);
            debugLog(
              event.combatWon ? "Won combat, moved to" : "Lost combat, stayed at",
              event.position.vec
            );
          }
          break;

        case "position_update":
          if (event.position) {
            setPosition(event.position);
            debugLog("Position updated", event.position.vec);
          }
          break;

        case "neighbors_revealed":
          if (event.neighborsOccupied !== undefined) {
            setOccupiedNeighbors(event.neighborsOccupied);
            debugLog("Neighbors revealed, mask:", event.neighborsOccupied);
          }
          break;

        default:
          debugLog("Unhandled event type", event.type);
      }
    },
    [addEvent, setPosition, setMoves, setIsSpawned, setOccupiedNeighbors]
  );

  /**
   * Manually refresh game state from blockchain
   * Uses single get_game_state call following death-mountain pattern
   */
  const refreshGameState = useCallback(async () => {
    if (!address) {
      console.warn("Cannot refresh: no address");
      return;
    }

    if (!gameId) {
      console.warn("Cannot refresh: no gameId");
      return;
    }

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
            debugLog("Player death detected from blockchain", {
              hp: gameState.hp,
              xp: gameState.xp,
              isActive: gameState.is_active,
            });
            setIsDead(true, gameState.xp, "Slain by another player");
            // Register death score on leaderboard
            debugLog("About to register death score with XP:", gameState.xp);
            await registerDeathScore(gameState.xp);
            debugLog("Death score registration completed");
          }

          debugLog("Game state refreshed successfully");
        } else {
          // console.warn("Game ownership mismatch during refresh");
          // console.warn("Game player:", gameState.player, "→", gamePlayer);
          // console.warn("Connected:", address, "→", connectedAddr);
          setError("Game ownership validation failed");
        }
      } else {
        console.warn("Game state not found during refresh");
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
