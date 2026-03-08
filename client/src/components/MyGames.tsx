/**
 * MyGames Component
 *
 * Displays all of the player's game tokens in a tabbed list (Active / Dead).
 * Uses the Denshokan SDK to discover tokens, enriched with actual game state
 * from the contract via getGameState().
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useTokens } from "@provable-games/denshokan-sdk/react";
import { useController } from "../contexts/controller";
import { useGameActions } from "../dojo/useGameActions";
import { useGameStore } from "../stores/gameStore";
import { useDynamicConnector } from "../starknet-provider";
import { getContractByName } from "../utils/networkConfig";
import { addAddressPadding } from "starknet";
import { useStarknetApi } from "../api/starknet";

interface EnrichedGame {
  tokenId: string;
  playerName: string;
  hp: number;
  maxHp: number;
  xp: number;
  isActive: boolean;
  isDead: boolean;
  isUnspawned: boolean;
}

/** Truncate a hex token_id for display: "0xfb40...0003" */
function truncateTokenId(tokenId: string): string {
  if (tokenId.length <= 14) return tokenId;
  return `${tokenId.slice(0, 8)}...${tokenId.slice(-4)}`;
}

export default function MyGames() {
  const navigate = useNavigate();
  const { address } = useController();
  const { handleSpawn, handleSpawnExisting, isSpawning } = useGameActions();
  const { currentNetworkConfig } = useDynamicConnector();
  const { getGameState } = useStarknetApi();

  const [activeTab, setActiveTab] = useState(0);
  const [games, setGames] = useState<EnrichedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [spawningTokenId, setSpawningTokenId] = useState<string | null>(null);

  // Get game_token_systems address from manifest
  const gameAddress = getContractByName(
    currentNetworkConfig.manifest,
    currentNetworkConfig.namespace,
    "game_token_systems",
  )?.address;

  // Fetch player's tokens from Denshokan
  const { data: tokensData, isLoading: isLoadingTokens } = useTokens(
    address
      ? {
          owner: addAddressPadding(address),
          gameAddress: gameAddress ? addAddressPadding(gameAddress) : undefined,
        }
      : undefined,
  );

  // Enrich tokens with actual game state from contract
  useEffect(() => {
    if (!tokensData?.data) return;

    const tokens = tokensData.data;
    if (tokens.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function enrichTokens() {
      const enriched: EnrichedGame[] = [];

      for (const token of tokens) {
        if (cancelled) return;

        const state = await getGameState(token.tokenId);

        if (!state) {
          // State unavailable — skip
          continue;
        }

        // Distinguish unspawned from dead: spawn sets max_hp to 110,
        // so max_hp === 0 means spawn() was never called for this token.
        const isUnspawned = !state.is_active && state.max_hp === 0;

        enriched.push({
          tokenId: token.tokenId,
          playerName: token.playerName || "",
          hp: state.hp,
          maxHp: state.max_hp,
          xp: state.xp,
          isActive: state.is_active,
          isDead: !isUnspawned && !state.is_active && state.hp === 0,
          isUnspawned,
        });
      }

      if (!cancelled) {
        setGames(enriched);
        setLoading(false);
      }
    }

    enrichTokens();

    return () => {
      cancelled = true;
    };
    // Intentionally omit getGameState from deps to avoid infinite loop
    // (same pattern as death-mountain's fetchAdventurerData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensData, address]);

  // Filter and sort by tab
  const filteredGames = games
    .filter((game) => (activeTab === 0 ? !game.isDead : game.isDead))
    .sort((a, b) => b.xp - a.xp);

  // Handle start game (mint + spawn)
  const handleStartGame = useCallback(async () => {
    if (!address) return;
    try {
      await handleSpawn();
      setTimeout(() => {
        const tokenId = useGameStore.getState().gameId;
        if (tokenId) {
          navigate(`/game?id=${encodeURIComponent(tokenId)}`);
        }
      }, 500);
    } catch (error) {
      console.error("Start game failed:", error);
    }
  }, [handleSpawn, address, navigate]);

  // Handle spawning an already-minted but unspawned game
  const handleSpawnGame = useCallback(
    async (tokenId: string) => {
      if (!address) return;
      try {
        setSpawningTokenId(tokenId);
        await handleSpawnExisting(tokenId);
        navigate(`/game?id=${encodeURIComponent(tokenId)}`);
      } catch (error) {
        console.error("Spawn game failed:", error);
      } finally {
        setSpawningTokenId(null);
      }
    },
    [handleSpawnExisting, address, navigate],
  );

  // Handle resume
  const handleResumeGame = useCallback(
    (tokenId: string) => {
      navigate(`/game?id=${encodeURIComponent(tokenId)}`);
    },
    [navigate],
  );

  const isLoading = isLoadingTokens || loading;

  return (
    <Box sx={{ width: "100%" }}>
      {/* Tabs */}
      <Box sx={styles.tabsContainer}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={styles.tabs}
        >
          <Tab label="Active" sx={styles.tab} />
          <Tab label="Dead" sx={styles.tab} />
        </Tabs>
      </Box>

      {/* List */}
      <Box sx={styles.listContainer}>
        {isLoading ? (
          <Box sx={styles.centered}>
            <CircularProgress
              size={24}
              sx={{ color: "rgba(68, 204, 68, 0.6)" }}
            />
          </Box>
        ) : filteredGames.length === 0 ? (
          <Typography sx={styles.emptyText}>
            No {activeTab === 0 ? "active" : "dead"} games
          </Typography>
        ) : (
          filteredGames.map((game) => (
            <Box key={game.tokenId} sx={styles.listItem}>
              <Box sx={styles.tokenInfo}>
                <Typography sx={styles.tokenName}>
                  {game.playerName || truncateTokenId(game.tokenId)}
                </Typography>
                <Typography sx={styles.tokenId}>
                  {truncateTokenId(game.tokenId)}
                </Typography>
              </Box>

              <Box sx={styles.statsContainer}>
                {game.isUnspawned ? (
                  <Typography sx={styles.unspawnedLabel}>
                    Not spawned
                  </Typography>
                ) : game.isDead ? (
                  <Typography sx={styles.score}>XP: {game.xp}</Typography>
                ) : (
                  <>
                    <Typography sx={styles.stat}>
                      HP: {game.hp}/{game.maxHp}
                    </Typography>
                    <Typography sx={styles.score}>XP: {game.xp}</Typography>
                  </>
                )}
              </Box>

              {activeTab === 0 ? (
                game.isUnspawned ? (
                  <Button
                    variant="contained"
                    size="small"
                    sx={styles.spawnButton}
                    onClick={() => handleSpawnGame(game.tokenId)}
                    disabled={spawningTokenId === game.tokenId}
                  >
                    {spawningTokenId === game.tokenId ? "Spawning..." : "Spawn"}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    sx={styles.resumeButton}
                    onClick={() => handleResumeGame(game.tokenId)}
                  >
                    Resume
                  </Button>
                )
              ) : (
                <Typography sx={styles.deadLabel}>Dead</Typography>
              )}
              <span>
                <Button
                  variant="contained"
                  size="small"
                  sx={styles.viewTokenButton}
                  onClick={() =>
                    window.open(
                      "https://funfactory.gg/portfolio",
                      "_blank",
                      "noopener noreferrer",
                    )
                  }
                >
                  View Token
                </Button>
              </span>
            </Box>
          ))
        )}
      </Box>

      {/* Start Game button */}
      <Box sx={styles.startContainer}>
        <Button
          variant="outlined"
          size="large"
          onClick={handleStartGame}
          disabled={isSpawning}
          sx={styles.startButton}
        >
          {isSpawning ? "Spawning..." : "Start New Game"}
        </Button>
      </Box>
    </Box>
  );
}

const styles = {
  tabsContainer: {
    width: "100%",
    mb: 1,
  },
  tabs: {
    minHeight: "32px",
    "& .MuiTabs-indicator": {
      backgroundColor: "#44cc44",
    },
  },
  tab: {
    padding: "6px 0",
    minHeight: "32px",
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "2px",
    textTransform: "uppercase" as const,
    "&.Mui-selected": {
      color: "#44cc44",
    },
  },
  listContainer: {
    width: "100%",
    maxHeight: "240px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    overflowY: "auto" as const,
    mb: 2,
  },
  centered: {
    display: "flex",
    justifyContent: "center",
    py: 3,
  },
  emptyText: {
    textAlign: "center",
    py: 3,
    fontSize: "0.8rem",
    color: "rgba(255, 255, 255, 0.3)",
    letterSpacing: "0.5px",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    padding: "8px 12px",
    backgroundColor: "rgba(10, 25, 15, 0.6)",
    border: "1px solid rgba(68, 204, 68, 0.12)",
    transition: "border-color 0.2s",
    "&:hover": {
      borderColor: "rgba(68, 204, 68, 0.3)",
    },
  },
  tokenInfo: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  tokenName: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "rgba(68, 204, 68, 0.9)",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tokenId: {
    fontSize: "0.65rem",
    color: "rgba(255, 255, 255, 0.3)",
    fontFamily: "monospace",
    lineHeight: 1.2,
  },
  statsContainer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    minWidth: "70px",
  },
  stat: {
    fontSize: "0.7rem",
    color: "rgba(255, 255, 255, 0.5)",
    lineHeight: 1.3,
  },
  score: {
    fontSize: "0.7rem",
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: 500,
    lineHeight: 1.3,
  },
  unspawnedLabel: {
    fontSize: "0.7rem",
    color: "rgba(251, 191, 36, 0.7)",
    fontWeight: 500,
    lineHeight: 1.3,
  },
  deadLabel: {
    fontSize: "0.7rem",
    color: "rgba(255, 80, 80, 0.7)",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
    minWidth: "70px",
    textAlign: "right" as const,
  },
  spawnButton: {
    minWidth: "70px",
    height: "28px",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "1px",
    background: "rgba(251, 191, 36, 0.15)",
    color: "rgba(251, 191, 36, 0.9)",
    border: "1px solid rgba(251, 191, 36, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase" as const,
    boxShadow: "none",
    "&:hover": {
      background: "rgba(251, 191, 36, 0.25)",
      borderColor: "rgba(251, 191, 36, 0.5)",
      boxShadow: "none",
    },
    "&:disabled": {
      background: "rgba(251, 191, 36, 0.05)",
      color: "rgba(255, 255, 255, 0.3)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      boxShadow: "none",
    },
  },
  resumeButton: {
    minWidth: "70px",
    height: "28px",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "1px",
    background: "rgba(68, 204, 68, 0.15)",
    color: "rgba(68, 204, 68, 0.9)",
    border: "1px solid rgba(68, 204, 68, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase" as const,
    boxShadow: "none",
    "&:hover": {
      background: "rgba(68, 204, 68, 0.25)",
      borderColor: "rgba(68, 204, 68, 0.5)",
      boxShadow: "none",
    },
  },
  viewTokenButton: {
    minWidth: "70px",
    height: "28px",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "1px",
    background: "rgba(68, 204, 68, 0.15)",
    color: "rgba(68, 204, 68, 0.9)",
    border: "1px solid rgba(68, 204, 68, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase" as const,
    boxShadow: "none",
    "&:hover": {
      background: "rgba(68, 204, 68, 0.25)",
      borderColor: "rgba(68, 204, 68, 0.5)",
      boxShadow: "none",
    },
  },
  startContainer: {
    display: "flex",
    justifyContent: "center",
  },
  startButton: {
    width: "100%",
    padding: "12px",
    fontSize: "0.8rem",
    fontWeight: 600,
    letterSpacing: "3px",
    background: "rgba(68, 204, 68, 0.15)",
    color: "rgba(68, 204, 68, 0.9)",
    border: "1px solid rgba(68, 204, 68, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase" as const,
    boxShadow: "none",
    transition: "color 0.2s, border-color 0.2s, background 0.2s",
    "&:hover": {
      background: "rgba(68, 204, 68, 0.25)",
      borderColor: "rgba(68, 204, 68, 0.5)",
      color: "#44cc44",
      boxShadow: "none",
    },
    "&:disabled": {
      background: "rgba(68, 204, 68, 0.05)",
      color: "rgba(255, 255, 255, 0.3)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      boxShadow: "none",
    },
  },
};
