/**
 * MyGames Component
 *
 * Displays the player's active game status and provides Resume/Start options
 * Implements Phase 1 of the persistence pattern with localStorage for game_id tracking
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Card, CardContent, Typography, CircularProgress } from "@mui/material";
import { useController } from "../contexts/controller";
import { useGameActions } from "../dojo/useGameActions";
import { useIsSpawned, useCurrentPosition, useGameId, useGameStore } from "../stores/gameStore";

const STORAGE_KEY_PREFIX = "hexed_game_id_";

export default function MyGames() {
  const navigate = useNavigate();
  const { address } = useController();
  const { handleSpawn, isSpawning } = useGameActions();
  const isSpawned = useIsSpawned();
  const currentPosition = useCurrentPosition();
  const gameId = useGameId(); // Get from store

  const [savedGameId, setSavedGameId] = useState<number | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  // Load saved game_id from localStorage on mount, or use store value
  useEffect(() => {
    if (address) {
      // First check store
      if (gameId) {
        setSavedGameId(gameId);
        setIsLoadingSaved(false);
        return;
      }

      // Fall back to localStorage
      const storageKey = `${STORAGE_KEY_PREFIX}${address}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedId = parseInt(saved, 10);
        if (!isNaN(savedId) && savedId > 0) {
          setSavedGameId(savedId);
        }
      }
    }
    setIsLoadingSaved(false);
  }, [address, gameId]);

  // Handle spawn and navigate
  const handleStartGame = useCallback(async () => {
    if (!address) {
      console.warn("No wallet connected");
      return;
    }

    try {
      console.log("🎮 Starting spawn process via MyGames...");

      // Call spawn - this will capture game_id and save to store + localStorage
      await handleSpawn();

      // Wait a bit for the store to update, then navigate with game_id
      setTimeout(() => {
        const currentGameId = useGameStore.getState().gameId;
        if (currentGameId) {
          console.log(`✅ Spawn complete! Navigating to game #${currentGameId}`);
          navigate(`/game?id=${currentGameId}`);
        } else {
          console.warn("⚠️ Game ID not captured, navigating without ID");
          navigate("/game");
        }
      }, 1500);

    } catch (error) {
      console.error("❌ Start game failed:", error);
    }
  }, [handleSpawn, address, navigate]);

  // Handle resume
  const handleResume = useCallback(() => {
    if (savedGameId) {
      console.log(`Resuming game #${savedGameId}`);
      navigate(`/game?id=${savedGameId}`);
    }
  }, [savedGameId, navigate]);

  // Loading state
  if (isLoadingSaved) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Has saved game - show resume option
  if (savedGameId && isSpawned) {
    return (
      <Card sx={styles.card}>
        <CardContent>
          <Typography sx={styles.cardTitle}>Active Game</Typography>

          <Box sx={styles.gameInfo}>
            <Typography sx={styles.infoLabel}>Game ID:</Typography>
            <Typography sx={styles.infoValue}>#{savedGameId}</Typography>
          </Box>

          {currentPosition && (
            <Box sx={styles.gameInfo}>
              <Typography sx={styles.infoLabel}>Position:</Typography>
              <Typography sx={styles.infoValue}>
                ({currentPosition.x}, {currentPosition.y})
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            size="large"
            onClick={handleResume}
            sx={styles.resumeButton}
          >
            Resume Game
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No active game - show start button
  return (
    <Box sx={{ marginTop: 2, display: "flex", justifyContent: "center" }}>
      <Button
        variant="outlined"
        size="large"
        onClick={handleStartGame}
        disabled={isSpawning}
        sx={styles.startButton}
      >
        {isSpawning ? "Spawning Player..." : "Start Game"}
      </Button>
    </Box>
  );
}

const styles = {
  card: {
    marginTop: 2,
    backgroundColor: "rgba(10, 10, 30, 0.8)",
    border: "1px solid rgba(0, 212, 255, 0.2)",
    borderRadius: 0,
    minWidth: "300px",
  },
  cardTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "rgba(0, 212, 255, 0.7)",
    letterSpacing: "3px",
    textTransform: "uppercase",
    marginBottom: 2,
    textAlign: "center",
  },
  gameInfo: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 1,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  },
  infoLabel: {
    fontSize: "0.8rem",
    color: "rgba(255, 255, 255, 0.35)",
    letterSpacing: "0.5px",
  },
  infoValue: {
    fontSize: "0.8rem",
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: 500,
    fontFamily: "monospace",
  },
  resumeButton: {
    marginTop: 2,
    width: "100%",
    padding: "14px",
    fontSize: "0.85rem",
    fontWeight: 600,
    letterSpacing: "3px",
    background: "rgba(0, 212, 255, 0.15)",
    color: "rgba(0, 212, 255, 0.9)",
    border: "1px solid rgba(0, 212, 255, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase",
    transition: "color 0.2s, border-color 0.2s, background 0.2s",
    "&:hover": {
      background: "rgba(0, 212, 255, 0.25)",
      borderColor: "rgba(0, 212, 255, 0.5)",
      color: "#00d4ff",
    },
  },
  startButton: {
    padding: "16px 48px",
    fontSize: "0.9rem",
    fontWeight: 600,
    letterSpacing: "3px",
    background: "rgba(0, 212, 255, 0.15)",
    color: "rgba(0, 212, 255, 0.9)",
    border: "1px solid rgba(0, 212, 255, 0.3)",
    borderRadius: 0,
    textTransform: "uppercase",
    boxShadow: "none",
    transition: "color 0.2s, border-color 0.2s, background 0.2s",
    "&:hover": {
      background: "rgba(0, 212, 255, 0.25)",
      borderColor: "rgba(0, 212, 255, 0.5)",
      color: "#00d4ff",
      boxShadow: "none",
    },
    "&:disabled": {
      background: "rgba(0, 212, 255, 0.05)",
      color: "rgba(255, 255, 255, 0.3)",
      borderColor: "rgba(255, 255, 255, 0.1)",
      boxShadow: "none",
    },
  },
};
