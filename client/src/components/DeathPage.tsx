import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { useDeathXp, useGameStore } from "../stores/gameStore";
import { useGameActions } from "../dojo/useGameActions";

export default function DeathPage() {
  const navigate = useNavigate();
  const deathXp = useDeathXp();
  const { handleSpawn, isSpawning } = useGameActions();
  const { setIsDead, resetGameState } = useGameStore();

  const handlePlayAgain = useCallback(async () => {
    // Reset death state and game state before spawning
    resetGameState();
    await handleSpawn();

    // Navigate to game after spawn completes
    setTimeout(() => {
      const currentGameId = useGameStore.getState().gameId;
      if (currentGameId) {
        navigate(`/game?id=${currentGameId}`);
      } else {
        navigate("/");
      }
    }, 1500);
  }, [handleSpawn, resetGameState, navigate]);

  const handleBackToLobby = useCallback(() => {
    setIsDead(false);
    resetGameState();
    navigate("/");
  }, [setIsDead, resetGameState, navigate]);

  return (
    <Box sx={styles.container}>
      <Box sx={styles.overlay} />

      <Box sx={styles.content}>
        <Typography sx={styles.prefixTitle}>You Died</Typography>

        <Typography sx={styles.title}>GAME OVER</Typography>

        <Box sx={styles.statsCard}>
          <Typography sx={styles.statsLabel}>Final Score</Typography>
          <Typography sx={styles.statsValue}>{deathXp} XP</Typography>
        </Box>

        <Box sx={styles.actions}>
          <Button
            variant="contained"
            size="large"
            onClick={handlePlayAgain}
            disabled={isSpawning}
            sx={styles.playAgainButton}
          >
            {isSpawning ? "Spawning..." : "Play Again"}
          </Button>

          <Button
            variant="outlined"
            size="large"
            onClick={handleBackToLobby}
            sx={styles.lobbyButton}
          >
            Back to Lobby
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

const styles = {
  container: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  overlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "linear-gradient(135deg, #1a0000 0%, #0a0a1e 50%, #1a0000 100%)",
  },
  content: {
    position: "relative" as const,
    zIndex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "24px",
    padding: "48px",
    backgroundColor: "rgba(10, 10, 30, 0.9)",
    borderRadius: "16px",
    border: "2px solid rgba(244, 67, 54, 0.4)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 8px 32px rgba(244, 67, 54, 0.3)",
    minWidth: "400px",
  },
  prefixTitle: {
    fontSize: "1.2rem",
    fontWeight: 400,
    color: "#f44336",
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  title: {
    fontSize: "3.5rem",
    fontWeight: 700,
    letterSpacing: 6,
    textAlign: "center" as const,
    color: "#f44336",
    textShadow: "0 0 30px rgba(244, 67, 54, 0.5), 0 0 60px rgba(244, 67, 54, 0.2)",
  },
  statsCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "8px",
    padding: "20px 40px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    marginTop: "8px",
  },
  statsLabel: {
    fontSize: "0.9rem",
    color: "#aaa",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  statsValue: {
    fontSize: "2rem",
    fontWeight: 700,
    color: "#9c27b0",
    fontFamily: "monospace",
  },
  actions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
    width: "100%",
    marginTop: "16px",
  },
  playAgainButton: {
    padding: "14px",
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: 1,
    background: "linear-gradient(135deg, #4285f4 0%, #34a853 100%)",
    color: "#fff",
    borderRadius: "8px",
    textTransform: "uppercase" as const,
    "&:hover": {
      background: "linear-gradient(135deg, #5295ff 0%, #45b963 100%)",
    },
    "&:disabled": {
      background: "rgba(66, 133, 244, 0.3)",
      color: "rgba(255, 255, 255, 0.5)",
    },
  },
  lobbyButton: {
    padding: "12px",
    fontSize: "0.9rem",
    fontWeight: 500,
    letterSpacing: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    color: "#aaa",
    borderRadius: "8px",
    textTransform: "uppercase" as const,
    "&:hover": {
      borderColor: "rgba(255, 255, 255, 0.4)",
      color: "#fff",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
  },
};
