import { useDynamicConnector } from "@/starknet-provider";
import { useController } from "@/contexts/controller";
import { getContractByName } from "@/utils/networkConfig";
import { delay, debugLog, parseTransactionError } from "@/utils/helpers";
import { extractGameEvents } from "@/utils/events";
import { GameEvent, Moves } from "@/types/game";
import { useCallback, useRef } from "react";
import { useStarknetApi } from "@/api/starknet";

/**
 * useSystemCalls Hook
 *
 * Following the death-mountain pattern for contract interactions.
 * This hook provides factory functions that return contract call objects.
 *
 * Pattern:
 * 1. Extract contract addresses from manifest using getContractByName()
 * 2. Create factory functions that return {contractAddress, entrypoint, calldata}
 * 3. These call objects are passed to executeAction() (to be implemented in Phase 2)
 *
 * @returns Object containing contract call factory functions
 */
export const useSystemCalls = () => {
  const { currentNetworkConfig } = useDynamicConnector();
  const { account, address } = useController();
  const { getPlayerMoves } = useStarknetApi();

  // Store current moves state for sync checking
  const currentMovesRef = useRef<Moves | null>(null);

  // Extract contract addresses from manifest
  const namespace = currentNetworkConfig.namespace;
  const manifest = currentNetworkConfig.manifest;

  // Get the game systems contract address (contains spawn, move, etc.)
  const GAME_SYSTEMS_ADDRESS = getContractByName(
    manifest,
    namespace,
    "game_systems"
  )?.address;

  if (!GAME_SYSTEMS_ADDRESS) {
    console.warn("Game systems contract address not found in manifest");
  }

  /**
   * Factory function for spawn action
   * Creates a new player at the spawn point
   *
   * @returns Contract call object
   */
  const spawn = () => {
    return {
      contractAddress: GAME_SYSTEMS_ADDRESS,
      entrypoint: "spawn",
      calldata: [],
    };
  };

  /**
   * Factory function for move action
   * Moves the player in a specified direction
   *
   * @param gameId - The game ID (u32)
   * @param direction - Direction enum value (0-5 for hex directions)
   * @returns Contract call object
   */
  const move = (gameId: number, direction: number) => {
    return {
      contractAddress: GAME_SYSTEMS_ADDRESS,
      entrypoint: "move",
      calldata: [gameId, direction],
    };
  };

  /**
   * Factory function for register_score action
   * Registers the player's score on the leaderboard
   *
   * @param player - Player contract address
   * @param username - Player username (felt252)
   * @param xp - Player XP score (u32)
   * @returns Contract call object
   */
  const registerScore = (player: string, username: string, xp: number) => {
    // Convert username string to felt252 (simple ASCII encoding)
    const usernameFelt = BigInt(
      username === address
        ? 0
        : username
            .slice(0, 31)
            .split("")
            .reduce((acc, char) => acc * 256n + BigInt(char.charCodeAt(0)), 0n)
    ).toString();

    return {
      contractAddress: GAME_SYSTEMS_ADDRESS,
      entrypoint: "register_score",
      calldata: [player, usernameFelt, xp],
    };
  };

  /**
   * Wait for global state synchronization
   * Ensures local state matches blockchain state before executing action
   *
   * @param calls - Contract calls to be executed
   * @param retries - Current retry count
   * @returns True when state is synced
   */
  const waitForGlobalState = useCallback(
    async (calls: any[], retries: number): Promise<boolean> => {
      // If no address, no need to wait
      if (!address) return true;

      // If no current moves state, no need to wait
      if (!currentMovesRef.current) return true;

      // For move actions, check if can_move is true
      const hasMoveCall = calls.find((call) => call.entrypoint === "move");
      if (hasMoveCall) {
        // Fetch latest moves state from blockchain
        const latestMoves = await getPlayerMoves(address);

        if (!latestMoves) {
          // If can't fetch, proceed anyway after max retries
          if (retries > 9) return true;
          await delay(500);
          return waitForGlobalState(calls, retries + 1);
        }

        // Check if player can move
        if (!latestMoves.can_move) {
          debugLog("Waiting for can_move to be true");
          if (retries > 9) {
            console.warn("Max retries reached, proceeding anyway");
            return true;
          }
          await delay(500);
          return waitForGlobalState(calls, retries + 1);
        }

        // Update current state
        currentMovesRef.current = latestMoves;
      }

      return true;
    },
    [address, getPlayerMoves]
  );

  /**
   * Set current moves state
   * Used to track local state for sync checking
   *
   * @param moves - Current Moves state
   */
  const setCurrentMoves = useCallback((moves: Moves | null) => {
    currentMovesRef.current = moves;
  }, []);

  /**
   * Wait for pre-confirmed transaction
   * Uses PRE_CONFIRMED status for faster UX
   *
   * @param txHash - Transaction hash
   * @param retries - Current retry count
   * @returns Transaction receipt
   */
  const waitForPreConfirmedTransaction = useCallback(
    async (txHash: string, retries: number): Promise<any> => {
      if (retries > 5) {
        throw new Error("Transaction confirmation timeout");
      }

      try {
        debugLog(`Waiting for pre-confirmed transaction (attempt ${retries + 1})`, txHash);

        const receipt: any = await account!.waitForTransaction(txHash, {
          retryInterval: 275,
          successStates: ["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
        });

        debugLog("Transaction pre-confirmed", receipt);
        return receipt;
      } catch (error) {
        console.error("Error waiting for pre-confirmed transaction:", error);
        await delay(500);
        return waitForPreConfirmedTransaction(txHash, retries + 1);
      }
    },
    [account]
  );

  /**
   * Wait for full transaction confirmation
   * More reliable but slower than pre-confirmed
   *
   * @param txHash - Transaction hash
   * @param retries - Current retry count
   * @returns Transaction receipt
   */
  const waitForTransaction = useCallback(
    async (txHash: string, retries: number): Promise<any> => {
      if (retries > 9) {
        throw new Error("Transaction confirmation timeout");
      }

      try {
        debugLog(`Waiting for transaction (attempt ${retries + 1})`, txHash);

        const receipt: any = await account!.waitForTransaction(txHash, {
          retryInterval: 350,
        });

        debugLog("Transaction confirmed", receipt);
        return receipt;
      } catch (error) {
        console.error("Error waiting for transaction:", error);
        await delay(500);
        return waitForTransaction(txHash, retries + 1);
      }
    },
    [account]
  );

  /**
   * Execute action with transaction handling
   * Following death-mountain pattern
   *
   * Pattern:
   * 1. Wait for global state sync
   * 2. Execute transaction via account.execute()
   * 3. Wait for pre-confirmed receipt (fast UX)
   * 4. Check execution status for REVERTED
   * 5. Extract and process events from receipt
   * 6. Call success or failure callbacks
   *
   * @param calls - Array of contract calls to execute
   * @param forceResetAction - Callback to reset state on failure
   * @param successCallback - Callback to call on success
   * @returns Array of processed game events
   */
  const executeAction = useCallback(
    async (
      calls: any[],
      forceResetAction: () => void,
      successCallback: () => void
    ): Promise<GameEvent[]> => {
      try {
        if (!account) {
          throw new Error("No account connected");
        }

        if (!calls || calls.length === 0) {
          throw new Error("No calls provided");
        }

        // Log the action being executed
        debugLog("Executing action", {
          callCount: calls.length,
          calls: calls.map((c) => c.entrypoint),
        });

        // Wait for global state sync before executing
        await waitForGlobalState(calls, 0);

        // Execute transaction
        const tx = await account.execute(calls);
        debugLog("Transaction submitted", tx.transaction_hash);

        // Wait for pre-confirmed receipt (fast UX)
        const receipt: any = await waitForPreConfirmedTransaction(
          tx.transaction_hash,
          0
        );

        // Check for revert
        if (receipt.execution_status === "REVERTED") {
          debugLog("Transaction reverted", receipt);
          forceResetAction();

          throw new Error("Transaction reverted");
        }

        // Extract game events from receipt
        const gameEvents = extractGameEvents(receipt, manifest);
        debugLog(`Extracted ${gameEvents.length} game events`, gameEvents);

        // Call success callback
        successCallback();

        return gameEvents;
      } catch (error) {
        console.error("Error executing action:", error);
        const errorMessage = parseTransactionError(error);
        console.error("Parsed error:", errorMessage);

        // Reset state on failure
        forceResetAction();

        throw error;
      }
    },
    [account, manifest, waitForPreConfirmedTransaction, waitForGlobalState]
  );

  return {
    // Contract call factories
    spawn,
    move,
    registerScore,

    // Transaction execution
    executeAction,
    waitForTransaction,
    waitForPreConfirmedTransaction,

    // State synchronization
    waitForGlobalState,
    setCurrentMoves,

    // Contract addresses (useful for debugging)
    addresses: {
      ACTIONS: GAME_SYSTEMS_ADDRESS,
    },
  };
};
