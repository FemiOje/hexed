/**
 * Game Store
 *
 * Zustand store for centralized game state management
 * Following death-mountain pattern for state management
 */

import { create } from "zustand";
import { Position, Moves, Vec2, Direction, GameEvent } from "@/types/game";
import {
  calculateNewPosition,
  isValidPosition,
  PositionHistory,
} from "@/utils/position";
import { isVec2Equal } from "@/types/game";

interface HighestScore {
  player: string;
  username: string;
  xp: number;
}

interface GameState {
  // Player identification
  playerAddress: string | null;
  isSpawned: boolean;
  isDead: boolean;
  deathXp: number;
  deathReason: string | null;
  gameId: number | null;  // Current active game_id

  // Position state
  position: Position | null;
  positionHistory: PositionHistory;
  optimisticPosition: Vec2 | null; // For optimistic updates

  // Moves state
  moves: Moves | null;

  // Player stats
  hp: number;
  maxHp: number;
  xp: number;

  // Neighbor occupancy bitmask
  occupiedNeighbors: number;

  // Leaderboard state
  highestScore: HighestScore | null;

  // Game events log
  eventLog: GameEvent[];

  // Loading states
  isInitializing: boolean;
  isSyncing: boolean;

  // Actions - Player Management
  setPlayerAddress: (address: string | null) => void;
  setIsSpawned: (spawned: boolean) => void;
  setIsDead: (dead: boolean, xp?: number, reason?: string) => void;
  setGameId: (gameId: number | null) => void;

  // Actions - Position Management
  setPosition: (position: Position | null) => void;
  updatePositionVec: (vec: Vec2) => void;
  setOptimisticPosition: (vec: Vec2 | null) => void;
  rollbackOptimisticPosition: () => void;

  // Actions - Moves Management
  setMoves: (moves: Moves | null) => void;
  updateCanMove: (canMove: boolean) => void;
  updateLastDirection: (direction: Direction | null) => void;

  // Actions - Stats Management
  setStats: (hp: number, maxHp: number, xp: number) => void;

  // Actions - Neighbor Occupancy
  setOccupiedNeighbors: (mask: number) => void;

  // Actions - Leaderboard Management
  setHighestScore: (score: HighestScore | null) => void;

  // Actions - Event Management
  addEvent: (event: GameEvent) => void;
  clearEventLog: () => void;

  // Actions - State Management
  setIsInitializing: (initializing: boolean) => void;
  setIsSyncing: (syncing: boolean) => void;
  resetGameState: () => void;

  // Computed values
  getCurrentPosition: () => Vec2 | null;
  canPlayerMove: () => boolean;
  getLastDirection: () => Direction | null;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  playerAddress: null,
  isSpawned: false,
  isDead: false,
  deathXp: 0,
  deathReason: null,
  gameId: null,
  position: null,
  positionHistory: new PositionHistory(50),
  optimisticPosition: null,
  moves: null,
  hp: 0,
  maxHp: 0,
  xp: 0,
  occupiedNeighbors: 0,
  highestScore: null,
  eventLog: [],
  isInitializing: false,
  isSyncing: false,

  // Player Management Actions
  setPlayerAddress: (address: string | null) =>
    set({ playerAddress: address }),

  setIsSpawned: (spawned: boolean) => set({ isSpawned: spawned }),

  setIsDead: (dead: boolean, xp?: number, reason?: string) =>
    set({ isDead: dead, deathXp: xp ?? 0, deathReason: reason ?? null }),

  setGameId: (gameId: number | null) => set({ gameId }),

  // Position Management Actions
  setPosition: (position: Position | null) =>
    set((state) => {
      // Add to history if position changed
      if (position && position.vec) {
        const currentVec = state.position?.vec;
        if (!currentVec || !isVec2Equal(currentVec, position.vec)) {
          state.positionHistory.push(position.vec);
        }
      }

      // Only clear optimistic position if the new position matches it
      // This prevents race conditions where blockchain refresh returns stale data
      const shouldClearOptimistic =
        !state.optimisticPosition ||
        (position && isVec2Equal(state.optimisticPosition, position.vec));

      return {
        position,
        optimisticPosition: shouldClearOptimistic ? null : state.optimisticPosition,
      };
    }),

  updatePositionVec: (vec: Vec2) =>
    set((state) => {
      if (!state.position) return state;

      // Add to history
      state.positionHistory.push(vec);

      return {
        position: {
          ...state.position,
          vec,
        },
        optimisticPosition: null,
      };
    }),

  setOptimisticPosition: (vec: Vec2 | null) =>
    set({ optimisticPosition: vec }),

  rollbackOptimisticPosition: () => set({ optimisticPosition: null }),

  // Moves Management Actions
  setMoves: (moves: Moves | null) => set({ moves }),

  updateCanMove: (canMove: boolean) =>
    set((state) => {
      if (!state.moves) return state;
      return {
        moves: {
          ...state.moves,
          can_move: canMove,
        },
      };
    }),

  updateLastDirection: (direction: Direction | null) =>
    set((state) => {
      if (!state.moves) return state;
      return {
        moves: {
          ...state.moves,
          last_direction: direction,
        },
      };
    }),

  // Stats Management Actions
  setStats: (hp: number, maxHp: number, xp: number) =>
    set({ hp, maxHp, xp }),

  // Neighbor Occupancy Actions
  setOccupiedNeighbors: (mask: number) => set({ occupiedNeighbors: mask }),

  // Leaderboard Actions
  setHighestScore: (score: HighestScore | null) => set({ highestScore: score }),

  // Event Management Actions
  addEvent: (event: GameEvent) =>
    set((state) => ({
      eventLog: [event, ...state.eventLog].slice(0, 100), // Keep last 100 events
    })),

  clearEventLog: () => set({ eventLog: [] }),

  // State Management Actions
  setIsInitializing: (initializing: boolean) =>
    set({ isInitializing: initializing }),

  setIsSyncing: (syncing: boolean) => set({ isSyncing: syncing }),

  resetGameState: () =>
    set({
      isSpawned: false,
      isDead: false,
      deathXp: 0,
      deathReason: null,
      gameId: null,
      position: null,
      positionHistory: new PositionHistory(50),
      optimisticPosition: null,
      moves: null,
      hp: 0,
      maxHp: 0,
      xp: 0,
      occupiedNeighbors: 0,
      highestScore: null,
      eventLog: [],
      isInitializing: false,
      isSyncing: false,
    }),

  // Computed values
  getCurrentPosition: () => {
    const state = get();
    // Return optimistic position if it exists, otherwise return actual position
    if (state.optimisticPosition) {
      return state.optimisticPosition;
    }
    return state.position?.vec || null;
  },

  canPlayerMove: () => {
    const state = get();
    return state.moves?.can_move || false;
  },

  getLastDirection: () => {
    const state = get();
    return state.moves?.last_direction || null;
  },
}));

/**
 * Selector hooks for optimized re-renders
 */

export const usePlayerAddress = () =>
  useGameStore((state) => state.playerAddress);

export const useIsSpawned = () => useGameStore((state) => state.isSpawned);

export const useIsDead = () => useGameStore((state) => state.isDead);
export const useDeathXp = () => useGameStore((state) => state.deathXp);
export const useDeathReason = () => useGameStore((state) => state.deathReason);

export const useGameId = () => useGameStore((state) => state.gameId);

export const usePlayerPosition = () => useGameStore((state) => state.position);

export const useCurrentPosition = () =>
  useGameStore((state) => state.getCurrentPosition());

export const usePlayerMoves = () => useGameStore((state) => state.moves);

export const useCanPlayerMove = () =>
  useGameStore((state) => state.canPlayerMove());

export const usePlayerHp = () => useGameStore((state) => state.hp);
export const usePlayerMaxHp = () => useGameStore((state) => state.maxHp);
export const usePlayerXp = () => useGameStore((state) => state.xp);

export const useHighestScore = () =>
  useGameStore((state) => state.highestScore);

export const useEventLog = () => useGameStore((state) => state.eventLog);

export const useIsGameInitializing = () =>
  useGameStore((state) => state.isInitializing);

export const useIsGameSyncing = () =>
  useGameStore((state) => state.isSyncing);

/**
 * Utility function to update position with optimistic update
 * @param direction - Direction to move
 * @returns Optimistic new position or null
 */
export const createOptimisticMove = (direction: Direction): Vec2 | null => {
  const state = useGameStore.getState();
  const currentPos = state.getCurrentPosition();

  if (!currentPos) return null;

  const newPos = calculateNewPosition(currentPos, direction);

  // Validate position
  if (!isValidPosition(newPos)) {
    return null;
  }

  return newPos;
};

/**
 * Helper to initialize player state
 * @param address - Player address
 */
export const initializePlayerState = (address: string) => {
  const store = useGameStore.getState();
  store.setPlayerAddress(address);
  store.resetGameState();
};
