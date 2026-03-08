/**
 * Starknet API Utilities
 *
 * Direct RPC calls to fetch game state from contracts
 * Following death-mountain pattern for data fetching
 */

import { useDynamicConnector } from "@/starknet-provider";
import { getContractByName } from "@/utils/networkConfig";
import { Position, Moves, GameState } from "@/types/game";
import { hash } from "starknet";
import { feltHexToI32 } from "@/utils/helpers";

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
      const selector = hash.getSelectorFromName("get_player_position");

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
              entry_point_selector: selector,
              calldata: [playerAddress],
            },
            "pre_confirmed",
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
      const selector = hash.getSelectorFromName("get_player_moves");

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
              entry_point_selector: selector,
              calldata: [playerAddress],
            },
            "pre_confirmed",
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
   * @param gameId - The token_id (packed felt252 hex string)
   * @returns GameState object or null
   */
  const getGameState = async (gameId: string): Promise<GameState | null> => {
    try {
      // Get actions contract address from manifest
      const gameSystemsContract = getContractByName(
        currentNetworkConfig.manifest,
        currentNetworkConfig.namespace,
        "game_systems"
      );

      if (!gameSystemsContract) {
        console.error("Actions contract not found in manifest");
        return null;
      }

      // console.log("Fetching game state for gameId:", gameId, "from contract:", gameSystemsContract.address);

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
              contract_address: gameSystemsContract.address,
              entry_point_selector: selector,
              calldata: [gameId],
            },
            "pre_confirmed",
          ],
          id: 0,
        }),
      });

      const data = await response.json();

      if (!data?.result || data.result.length < 5) {
        console.warn("Invalid or empty response from get_game_state:", data);
        return null;
      }

      // Parse GameState struct:
      // GameState { token_id, position.x, position.y, last_direction (Option), can_move, is_active, hp, max_hp, xp, neighbor_occupancy }
      // Option<Direction> serializes as TWO felts: variant (0=Some, 1=None) + value if Some
      let idx = 0;
      const parsedGameId = data.result[idx++];  // token_id as hex string (packed felt252)

      // Position (Vec2 with i32 values stored as felt252)
      // Negative i32 values are stored as STARK_PRIME - |value|, so use BigInt
      const posX = feltHexToI32(data.result[idx++]);
      const posY = feltHexToI32(data.result[idx++]);

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
      const hp = parseInt(data.result[idx++], 16) || 0;
      const maxHp = parseInt(data.result[idx++], 16) || 0;
      const xp = parseInt(data.result[idx++], 16) || 0;

      // Neighbor occupancy bitmask (u8)
      const neighborOccupancy = parseInt(data.result[idx++], 16) || 0;

      return {
        game_id: parsedGameId,
        position: { x: posX, y: posY },
        last_direction: lastDirection,
        can_move: canMove,
        is_active: isActive,
        hp,
        max_hp: maxHp,
        xp,
        neighbor_occupancy: neighborOccupancy,
      };
    } catch (error) {
      console.error("Error fetching game state:", error);
      return null;
    }
  };

  /**
   * Resolve the current owner of an ERC721 token via Torii SQL.
   * Torii indexes all ERC721 transfers, so token_balances contains ownership data.
   *
   * @param tokenId - The token ID as a hex string (felt252)
   * @returns Owner address as hex string, or "0x0" on failure
   */
  const resolveTokenOwner = async (tokenId: string): Promise<string> => {
    try {
      // Torii stores token_id as "{contract}:{padded_token_hex}" in token_balances.
      // Search by suffix since we know the token ID but the padding may vary.
      const tokenIdClean = tokenId.replace(/^0x0*/, "");
      const query = `SELECT account_address FROM token_balances WHERE token_id LIKE '%${tokenIdClean}' AND balance != '0x0000000000000000000000000000000000000000000000000000000000000000' LIMIT 1`;
      const response = await fetch(
        `${currentNetworkConfig.toriiUrl}/sql?q=${encodeURIComponent(query)}`
      );
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return rows[0].account_address || "0x0";
      }
      return "0x0";
    } catch (error) {
      console.error("Error resolving token owner:", error);
      return "0x0";
    }
  };

  /**
   * Get highest score from leaderboard via Torii GraphQL query.
   * Reads the HighestScore model (singleton key=0) and resolves the
   * current owner of the scoring token via ERC721 owner_of.
   *
   * @returns Object with scoringTokenId, ownerAddress, xp or null
   */
  const getHighestScore = async () => {
    try {
      // Query Torii for the HighestScore model
      const toriiResponse = await fetch(
        `${currentNetworkConfig.toriiUrl}/graphql`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `{
              hexedHighestScoreModels {
                edges {
                  node {
                    scoring_token_id
                    xp
                  }
                }
              }
            }`,
          }),
        }
      );

      const toriiData = await toriiResponse.json();
      const edges =
        toriiData?.data?.hexedHighestScoreModels?.edges;
      if (!edges?.length) return null;

      const { scoring_token_id, xp } = edges[0].node;
      const scoringTokenId = String(scoring_token_id);
      const xpValue = Number(xp);

      // No score recorded yet
      if (!scoringTokenId || scoringTokenId === "0" || scoringTokenId === "0x0" || xpValue === 0) {
        return null;
      }

      // Resolve current owner of the scoring token
      const ownerAddress = await resolveTokenOwner(scoringTokenId);

      return {
        scoringTokenId,
        ownerAddress,
        xp: xpValue,
      };
    } catch (error) {
      console.error("Error fetching highest score:", error);
      return null;
    }
  };

  return {
    getPlayerPosition,
    getPlayerMoves,
    getPlayerState,
    getGameState,
    getHighestScore,
  };
};
