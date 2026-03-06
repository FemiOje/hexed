/**
 * MyGames Component
 *
 * Displays all of the player's game tokens in a tabbed list (Active / Dead).
 * Uses the Denshokan SDK to discover tokens, following the death-mountain pattern.
 */

import { useState, useCallback } from "react";
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

/** Truncate a hex token_id for display: "0xfb40...0003" */
function truncateTokenId(tokenId: string): string {
  if (tokenId.length <= 14) return tokenId;
  return `${tokenId.slice(0, 8)}...${tokenId.slice(-4)}`;
}

export default function MyGames() {
  const navigate = useNavigate();
  const { address } = useController();
  const { handleSpawn, isSpawning } = useGameActions();
  const { currentNetworkConfig } = useDynamicConnector();

  const [activeTab, setActiveTab] = useState(0);

  // Get game_token_systems address from manifest
  const gameAddress = getContractByName(
    currentNetworkConfig.manifest,
    currentNetworkConfig.namespace,
    "game_token_systems",
  )?.address;

  // Fetch player's tokens from Denshokan
  const { data: tokensData, isLoading } = useTokens(
    address
      ? {
          owner: addAddressPadding(address),
          gameAddress: gameAddress ? addAddressPadding(gameAddress) : undefined,
        }
      : undefined,
  );

  const tokens = tokensData?.data || [];

  // Filter and sort by tab
  const filteredTokens = tokens
    .filter((token) => (activeTab === 0 ? !token.gameOver : token.gameOver))
    .sort(
      (a, b) =>
        new Date(b.mintedAt).getTime() - new Date(a.mintedAt).getTime(),
    );

  // Handle start game
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

  // Handle resume
  const handleResumeGame = useCallback(
    (tokenId: string) => {
      navigate(`/game?id=${encodeURIComponent(tokenId)}`);
    },
    [navigate],
  );

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
            <CircularProgress size={24} sx={{ color: "rgba(68, 204, 68, 0.6)" }} />
          </Box>
        ) : filteredTokens.length === 0 ? (
          <Typography sx={styles.emptyText}>
            No {activeTab === 0 ? "active" : "dead"} games
          </Typography>
        ) : (
          filteredTokens.map((token) => (
            <Box key={token.tokenId} sx={styles.listItem}>
              <Box sx={styles.tokenInfo}>
                <Typography sx={styles.tokenName}>
                  {token.playerName || truncateTokenId(token.tokenId)}
                </Typography>
                <Typography sx={styles.tokenId}>
                  {truncateTokenId(token.tokenId)}
                </Typography>
              </Box>

              <Typography sx={styles.score}>
                XP: {token.score}
              </Typography>

              {activeTab === 0 ? (
                <Button
                  variant="contained"
                  size="small"
                  sx={styles.resumeButton}
                  onClick={() => handleResumeGame(token.tokenId)}
                >
                  Resume
                </Button>
              ) : (
                <Typography sx={styles.deadLabel}>
                  Dead
                </Typography>
              )}
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
  score: {
    fontSize: "0.75rem",
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  deadLabel: {
    fontSize: "0.7rem",
    color: "rgba(255, 80, 80, 0.7)",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
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
