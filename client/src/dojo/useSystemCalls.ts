import { useDynamicConnector } from "@/starknet-provider";
import { useController } from "@/contexts/controller";
import { getContractByName } from "@/utils/networkConfig";
import { delay } from "@/utils/helpers";
import { extractGameEvents } from "@/utils/events";
import { GameEvent, Moves } from "@/types/game";
import { useCallback, useRef } from "react";
import { useStarknetApi } from "@/api/starknet";
import { CallData, num } from "starknet";

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
    "game_systems",
  )?.address;

  // Read game_token_systems directly from manifest to preserve init_calldata
  const gameTokenEntry = manifest?.contracts?.find(
    (c: any) => c.tag === `${namespace}-game_token_systems`,
  );
  const GAME_TOKEN_SYSTEMS_ADDRESS = gameTokenEntry?.address;

  if (!GAME_SYSTEMS_ADDRESS) {
    // Game systems contract not found in manifest
  }

  /**
   * Factory function for spawn action
   * Creates a new player at the spawn point
   *
   * @returns Contract call object
   */
  const spawn = (tokenId: string) => {
    return {
      contractAddress: GAME_SYSTEMS_ADDRESS,
      entrypoint: "spawn",
      calldata: [tokenId],
    };
  };

  const encodeNameToFelt = useCallback((name: string): string => {
    // Match the registerScore encoding so "player name" is a felt252 (not a shortstring)
    // Keep within 31 bytes to fit in a felt.
    const trimmed = (name || "").trim();
    if (!trimmed) return "0";
    return BigInt(
      trimmed
        .slice(0, 31)
        .split("")
        .reduce((acc, char) => acc * 256n + BigInt(char.charCodeAt(0)), 0n),
    ).toString();
  }, []);

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
        const receipt: any = await account!.waitForTransaction(txHash, {
          retryInterval: 350,
        });

        return receipt;
      } catch (error) {
        console.error("Error waiting for transaction:", error);
        await delay(500);
        return waitForTransaction(txHash, retries + 1);
      }
    },
    [account],
  );

  /**
   * Mint a new game token (EGS flow) and return the token_id as a hex string.
   *
   * Extracts token_id from the ERC721 Transfer event (from=0x0, to=caller).
   * The hex string is used as-is for contract calls, localStorage, and URL params.
   */
  const mintGame = useCallback(
    async (playerName?: string): Promise<string> => {
      if (!GAME_TOKEN_SYSTEMS_ADDRESS) {
        throw new Error("game_token_systems not found in manifest");
      }

      if (!account) {
        throw new Error("No account connected");
      }

      // player_name Option<felt252>
      const encodedName = playerName ? encodeNameToFelt(playerName) : "0";
      const playerNameOpt =
        encodedName && encodedName !== "0" ? [0, encodedName] : [1];

      // Build calldata matching the deployed mint_game ABI
      const calldata = CallData.compile([
        ...playerNameOpt, // player_name: Option<felt252>
        1, // settings_id: None
        1, // start: None
        1, // end: None
        1, // objective_id: None
        1, // context: None
        1, // client_url: None
        1, // renderer_address: None
        1, // skills_address: None
        account.address, // to: ContractAddress
        0, // soulbound: false
        0, // paymaster: false
        0, // salt: 0
        0, // metadata: 0
      ]);

      const tx = await account.execute([
        {
          contractAddress: GAME_TOKEN_SYSTEMS_ADDRESS,
          entrypoint: "mint_game",
          calldata,
        },
      ]);

      const receipt: any = await waitForTransaction(tx.transaction_hash, 0);

      // Extract token_id from ERC721 Transfer event (from=0x0 → to=us)
      // In OpenZeppelin Cairo v3, token_id is a #[key] field, so it appears
      // in keys (not data): keys=[selector, from, to, token_id_low, token_id_high]
      const normalizedTo = num
        .toHex(num.toBigInt(account.address))
        .toLowerCase();

      for (const evt of receipt?.events || []) {
        const keys: string[] = evt?.keys || [];

        if (keys.length >= 5) {
          const isFromZero = num.toBigInt(keys[1]) === 0n;
          let isToUs = false;
          try {
            isToUs =
              num.toHex(num.toBigInt(keys[2])).toLowerCase() === normalizedTo;
          } catch {
            continue;
          }

          if (isFromZero && isToUs) {
            // Reconstruct felt252 from u256 (low, high) in keys[3], keys[4]
            const low = num.toBigInt(keys[3]);
            const high = num.toBigInt(keys[4]);
            const tokenId = high * (1n << 128n) + low;
            return num.toHex(tokenId);
          }
        }
      }

      throw new Error(
        "Mint succeeded but could not extract token_id from events",
      );
    },
    [GAME_TOKEN_SYSTEMS_ADDRESS, account, encodeNameToFelt, waitForTransaction],
  );

  /**
   * Factory function for move action
   *
   * @param gameId - The token_id hex string (e.g. "0xfb40...")
   * @param direction - Direction enum value (0-5 for hex directions)
   * @returns Contract call object
   */
  const move = (gameId: string, direction: number) => {
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
            .reduce((acc, char) => acc * 256n + BigInt(char.charCodeAt(0)), 0n),
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
          if (retries > 9) {
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
    [address, getPlayerMoves],
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
        const receipt: any = await account!.waitForTransaction(txHash, {
          retryInterval: 275,
          successStates: ["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
        });

        return receipt;
      } catch (error) {
        console.error("Error waiting for pre-confirmed transaction:", error);
        await delay(500);
        return waitForPreConfirmedTransaction(txHash, retries + 1);
      }
    },
    [account],
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
      successCallback: () => void,
    ): Promise<GameEvent[]> => {
      try {
        if (!account) {
          throw new Error("No account connected");
        }

        if (!calls || calls.length === 0) {
          throw new Error("No calls provided");
        }

        // Wait for global state sync before executing
        await waitForGlobalState(calls, 0);

        // Execute transaction
        const tx = await account.execute(calls);

        // Wait for pre-confirmed receipt (fast UX)
        const receipt: any = await waitForPreConfirmedTransaction(
          tx.transaction_hash,
          0,
        );

        // Check for revert
        if (receipt.execution_status === "REVERTED") {
          forceResetAction();

          throw new Error("Transaction reverted");
        }

        // Extract game events from receipt
        const gameEvents = extractGameEvents(receipt, manifest);

        // Call success callback
        successCallback();

        return gameEvents;
      } catch (error) {
        // Reset state on failure
        forceResetAction();

        throw error;
      }
    },
    [account, manifest, waitForPreConfirmedTransaction, waitForGlobalState],
  );

  return {
    // Contract call factories
    spawn,
    move,
    registerScore,
    mintGame,

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
