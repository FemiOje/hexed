/**
 * Starknet API Utilities
 *
 * Direct RPC calls to fetch game state from contracts
 * Following death-mountain pattern for data fetching
 */

import { useDynamicConnector } from "@/starknet-provider";
import { getContractByName } from "@/utils/networkConfig";
import { Position, Moves, GameState } from "@/types/game";
import { num, hash } from "starknet";

/**
 * Hook for Starknet API calls
 */
export const useStarknetApi = () => {
  const { currentNetworkConfig } = useDynamicConnector();

  /**
   * Get player position from contract
   * Direct RPC call to fetch Position model
   *
   * @param playerAddress - Player's contract address
   * @returns Position object or null
   */
  const getPlayerPosition = async (
    playerAddress: string
  ): Promise<Position | null> => {
    try {
      const response = await fetch(currentNetworkConfig.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "starknet_call",
          params: [
            {
              contract_address: currentNetworkConfig.manifest.world.address,
              entry_point_selector: num.toHex(
                "0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e"
              ), // get selector
              calldata: [playerAddress],
            },
            "latest",
          ],
          id: 0,
        }),
      });

      const data = await response.json();

      if (!data?.result || data.result.length < 2) {
        return null;
      }

      return {
        player: playerAddress,
        vec: {
          x: parseInt(data.result[0], 16),
          y: parseInt(data.result[1], 16),
        },
      };
    } catch (error) {
      console.error("Error fetching player position:", error);
      return null;
    }
  };

  /**
   * Get player moves state from contract
   * Direct RPC call to fetch Moves model
   *
   * @param playerAddress - Player's contract address
   * @returns Moves object or null
   */
  const getPlayerMoves = async (
    playerAddress: string
  ): Promise<Moves | null> => {
    try {
      const response = await fetch(currentNetworkConfig.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "starknet_call",
          params: [
            {
              contract_address: currentNetworkConfig.manifest.world.address,
              entry_point_selector: num.toHex(
                "0x2e4263afad30923c891518314c3c95dbe830a16874e8abc5777a9a20b54c76e"
              ), // get selector
              calldata: [playerAddress],
            },
            "latest",
          ],
          id: 0,
        }),
      });

      const data = await response.json();

      if (!data?.result || data.result.length < 2) {
        return null;
      }

      const lastDirection = parseInt(data.result[0], 16);
      const canMove = parseInt(data.result[1], 16) === 1;

      return {
        player: playerAddress,
        last_direction: lastDirection > 0 ? lastDirection : null,
        can_move: canMove,
      };
    } catch (error) {
      console.error("Error fetching player moves:", error);
      return null;
    }
  };

  /**
   * Get complete player state
   * Fetches both position and moves in parallel
   *
   * @param playerAddress - Player's contract address
   * @returns Object with position and moves
   */
  const getPlayerState = async (playerAddress: string) => {
    try {
      const [position, moves] = await Promise.all([
        getPlayerPosition(playerAddress),
        getPlayerMoves(playerAddress),
      ]);

      return {
        position,
        moves,
      };
    } catch (error) {
      console.error("Error fetching player state:", error);
      return {
        position: null,
        moves: null,
      };
    }
  };

  /**
   * Get complete game state from contract view function
   * Single RPC call to actions.get_game_state(game_id)
   * Following death-mountain pattern for efficient state restoration
   *
   * @param gameId - The game ID (u32)
   * @returns GameState object or null
   */
  const getGameState = async (gameId: number): Promise<GameState | null> => {
    try {
      // Get actions contract address from manifest
      const actionsContract = getContractByName(
        currentNetworkConfig.manifest,
        currentNetworkConfig.namespace,
        "actions"
      );

      if (!actionsContract) {
        console.error("Actions contract not found in manifest");
        return null;
      }

      // console.log("Fetching game state for gameId:", gameId, "from contract:", actionsContract.address);

      // Calculate the correct entry point selector for get_game_state
      const selector = hash.getSelectorFromName("get_game_state");
      // console.log("Using selector for get_game_state:", selector);

      const response = await fetch(currentNetworkConfig.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "starknet_call",
          params: [
            {
              contract_address: actionsContract.address,
              entry_point_selector: selector,
              calldata: [num.toHex(gameId)],
            },
            "pre_confirmed",
          ],
          id: 0,
        }),
      });

      const data = await response.json();

      console.log("RPC response for getGameState:", JSON.stringify(data.result));

      if (!data?.result || data.result.length < 5) {
        console.warn("Invalid or empty response from get_game_state:", data);
        return null;
      }

      // Parse GameState struct:
      // GameState { game_id, player, position.x, position.y, last_direction (Option), can_move, is_active }
      // Option<Direction> serializes as TWO felts: variant (0=Some, 1=None) + value if Some
      let idx = 0;
      const parsedGameId = parseInt(data.result[idx++], 16);
      const player = data.result[idx++];

      // Position (Vec2 with i32 values - need to handle signed conversion)
      const posXRaw = parseInt(data.result[idx++], 16);
      const posYRaw = parseInt(data.result[idx++], 16);

      // Convert from unsigned to signed i32 if needed
      const posX = posXRaw > 0x7FFFFFFF ? posXRaw - 0x100000000 : posXRaw;
      const posY = posYRaw > 0x7FFFFFFF ? posYRaw - 0x100000000 : posYRaw;

      // Option<Direction>: TWO felts - variant (0=Some, 1=None) + value if Some
      const optionVariant = parseInt(data.result[idx++], 16);
      let lastDirection: number | null = null;
      if (optionVariant === 0) {
        // 0 = Some, read the direction value
        lastDirection = parseInt(data.result[idx++], 16);
      }
      // else: 1 = None, no additional value to read

      const canMove = parseInt(data.result[idx++], 16) === 1;
      const isActive = parseInt(data.result[idx++], 16) === 1;

      // Player stats (hp, max_hp, xp) — added with combat system
      console.log("Parsing stats at idx:", idx, "remaining fields:", data.result.slice(idx));
      const hp = parseInt(data.result[idx++], 16) || 0;
      const maxHp = parseInt(data.result[idx++], 16) || 0;
      const xp = parseInt(data.result[idx++], 16) || 0;
      console.log("Parsed stats:", { hp, maxHp, xp });

      return {
        game_id: parsedGameId,
        player,
        position: { x: posX, y: posY },
        last_direction: lastDirection,
        can_move: canMove,
        is_active: isActive,
        hp,
        max_hp: maxHp,
        xp,
      };
    } catch (error) {
      console.error("Error fetching game state:", error);
      return null;
    }
  };

  return {
    getPlayerPosition,
    getPlayerMoves,
    getPlayerState,
    getGameState,
  };
};
