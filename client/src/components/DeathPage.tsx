import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography, CircularProgress } from "@mui/material";
import { useDeathXp, useDeathReason, useGameStore } from "../stores/gameStore";
import { useController } from "../contexts/controller";
import { useSystemCalls } from "../dojo/useSystemCalls";
import { HighestScoreDisplay } from "./HighestScoreDisplay";
import toast, { Toaster } from "react-hot-toast";

export default function DeathPage() {
  const navigate = useNavigate();
  const deathXp = useDeathXp();
  const deathReason = useDeathReason();
  const { setIsDead, resetGameState } = useGameStore();
  const { address, playerName } = useController();
  const { registerScore, executeAction } = useSystemCalls();
  const [isRegisteringScore, setIsRegisteringScore] = useState(false);

  const handleBackToLobby = useCallback(() => {
    setIsDead(false);
    resetGameState();
    navigate("/");
  }, [setIsDead, resetGameState, navigate]);

  const handleRegisterScore = useCallback(async () => {
    if (!address) {
      toast.error("No account connected");
      return;
    }

    try {
      setIsRegisteringScore(true);

      const scoreCall = registerScore(
        address,
        playerName || address,
        deathXp
      );

      await executeAction(
        [scoreCall],
        () => {
          setIsRegisteringScore(false);
          toast.error("Failed to register score");
        },
        () => {
          setIsRegisteringScore(false);
          toast.success("Score registered on leaderboard!");
        }
      );
    } catch (error) {
      console.error("Error registering score:", error);
      setIsRegisteringScore(false);
      toast.error("Error registering score");
    }
  }, [address, playerName, deathXp, registerScore, executeAction]);

  return (
    <Box sx={styles.container}>
      <Toaster position="top-center" toastOptions={{ style: { zIndex: 10001 } }} />

      {/* Background */}
      <Box sx={styles.backgroundGradient} />
      <Box sx={styles.vignette} />

      {/* Subtle embers */}
      <Box sx={styles.ember1} />
      <Box sx={styles.ember2} />
      <Box sx={styles.ember3} />

      {/* Content */}
      <Box sx={styles.content}>
        <Typography sx={styles.prefixTitle}>You Died</Typography>

        <Box sx={styles.titleContainer}>
          <Typography sx={styles.title}>GAME OVER</Typography>
          <Box sx={styles.titleGlow} />
        </Box>

        <Box sx={styles.divider} />

        {deathReason && (
          <Box sx={styles.encounterSection}>
            <Typography sx={styles.sectionLabel}>CAUSE OF DEATH</Typography>
            <Typography sx={styles.encounterMessage}>
              {deathReason}
            </Typography>
          </Box>
        )}

        <Box sx={styles.divider} />

        <Box sx={styles.statsSection}>
          <Typography sx={styles.sectionLabel}>FINAL SCORE</Typography>
          <Box sx={styles.xpRow}>
            <Typography sx={styles.xpValue}>{deathXp}</Typography>
            <Typography sx={styles.xpUnit}>XP</Typography>
          </Box>
        </Box>

        <Box sx={styles.divider} />

        <Box sx={styles.leaderboardSection}>
          <HighestScoreDisplay />
        </Box>

        <Button
          variant="outlined"
          size="large"
          onClick={handleRegisterScore}
          disabled={isRegisteringScore}
          sx={styles.registerScoreButton}
        >
          {isRegisteringScore ? (
            <>
              <CircularProgress size={20} sx={styles.buttonSpinner} />
              Registering...
            </>
          ) : (
            "Register Score"
          )}
        </Button>

        <Button
          variant="outlined"
          size="large"
          onClick={handleBackToLobby}
          sx={styles.lobbyButton}
        >
          Return to Lobby
        </Button>
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
    height: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    overflow: "hidden",
  },
  backgroundGradient: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "radial-gradient(ellipse at 50% 40%, #1a0505 0%, #050000 100%)",
    zIndex: 0,
  },
  vignette: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "radial-gradient(circle at 50% 50%, transparent 20%, rgba(0, 0, 0, 0.8) 100%)",
    zIndex: 1,
  },
  // 3 subtle embers — small, quiet
  ember1: {
    position: "absolute" as const,
    width: "3px",
    height: "3px",
    background: "#dc2626",
    borderRadius: "50%",
    boxShadow: "0 0 6px #dc2626",
    top: "25%",
    left: "18%",
    zIndex: 2,
    animation: "ember1 10s ease-in-out infinite",
    "@keyframes ember1": {
      "0%, 100%": { transform: "translateY(0)", opacity: 0.2 },
      "50%": { transform: "translateY(-60px)", opacity: 0.6 },
    },
  },
  ember2: {
    position: "absolute" as const,
    width: "2px",
    height: "2px",
    background: "#ef4444",
    borderRadius: "50%",
    boxShadow: "0 0 4px #ef4444",
    bottom: "35%",
    right: "22%",
    zIndex: 2,
    animation: "ember2 14s ease-in-out infinite",
    "@keyframes ember2": {
      "0%, 100%": { transform: "translateY(0)", opacity: 0.15 },
      "50%": { transform: "translateY(-80px)", opacity: 0.5 },
    },
  },
  ember3: {
    position: "absolute" as const,
    width: "2px",
    height: "2px",
    background: "#dc2626",
    borderRadius: "50%",
    boxShadow: "0 0 5px #dc2626",
    top: "55%",
    left: "30%",
    zIndex: 2,
    animation: "ember3 12s ease-in-out infinite",
    "@keyframes ember3": {
      "0%, 100%": { transform: "translateY(0)", opacity: 0.1 },
      "50%": { transform: "translateY(-70px)", opacity: 0.4 },
    },
  },
  content: {
    position: "relative" as const,
    zIndex: 10,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "24px",
    padding: { xs: "40px 28px", sm: "56px 56px" },
    maxWidth: "480px",
    width: "90%",
    animation: "contentIn 0.5s ease-out",
    "@keyframes contentIn": {
      "0%": { opacity: 0, transform: "translateY(12px)" },
      "100%": { opacity: 1, transform: "translateY(0)" },
    },
  },
  prefixTitle: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "rgba(220, 38, 38, 0.7)",
    letterSpacing: "4px",
    textTransform: "uppercase" as const,
  },
  titleContainer: {
    position: "relative" as const,
  },
  title: {
    fontSize: { xs: "3.5rem", sm: "5rem" },
    fontWeight: 900,
    letterSpacing: { xs: "8px", sm: "14px" },
    textAlign: "center" as const,
    color: "#dc2626",
    textTransform: "uppercase" as const,
    textShadow: `
      0 0 30px rgba(220, 38, 38, 0.6),
      0 0 80px rgba(220, 38, 38, 0.3)
    `,
    animation: "titlePulse 3s ease-in-out infinite",
    "@keyframes titlePulse": {
      "0%, 100%": {
        textShadow: "0 0 30px rgba(220, 38, 38, 0.6), 0 0 80px rgba(220, 38, 38, 0.3)",
      },
      "50%": {
        textShadow: "0 0 40px rgba(220, 38, 38, 0.8), 0 0 100px rgba(220, 38, 38, 0.4)",
      },
    },
  },
  titleGlow: {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "120%",
    height: "120%",
    background: "radial-gradient(circle, rgba(220, 38, 38, 0.15), transparent 70%)",
    filter: "blur(40px)",
    zIndex: -1,
  },
  divider: {
    width: "60px",
    height: "1px",
    background: "rgba(220, 38, 38, 0.25)",
  },
  encounterSection: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "10px",
  },
  sectionLabel: {
    fontSize: "0.7rem",
    color: "rgba(220, 38, 38, 0.6)",
    letterSpacing: "3px",
    textTransform: "uppercase" as const,
    fontWeight: 700,
  },
  encounterMessage: {
    fontSize: { xs: "0.9rem", sm: "1rem" },
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
  statsSection: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: "10px",
  },
  xpRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  xpValue: {
    fontSize: { xs: "2.5rem", sm: "3rem" },
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.9)",
    fontFamily: "monospace",
  },
  xpUnit: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: "2px",
  },
  leaderboardSection: {
    width: "100%",
    maxWidth: "350px",
  },
  registerScoreButton: {
    marginTop: "12px",
    padding: "14px 40px",
    fontSize: "0.85rem",
    fontWeight: 600,
    letterSpacing: "3px",
    color: "rgba(59, 130, 246, 0.8)",
    borderColor: "rgba(59, 130, 246, 0.3)",
    borderWidth: "1px",
    borderRadius: "0",
    textTransform: "uppercase" as const,
    transition: "color 0.2s, border-color 0.2s, background-color 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    "&:hover": {
      borderColor: "rgba(59, 130, 246, 0.7)",
      color: "#3b82f6",
      backgroundColor: "rgba(59, 130, 246, 0.05)",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },
  buttonSpinner: {
    color: "rgba(59, 130, 246, 0.8)",
    marginRight: "4px",
  },
  lobbyButton: {
    marginTop: "8px",
    padding: "14px 40px",
    fontSize: "0.85rem",
    fontWeight: 600,
    letterSpacing: "3px",
    color: "rgba(220, 38, 38, 0.8)",
    borderColor: "rgba(220, 38, 38, 0.3)",
    borderWidth: "1px",
    borderRadius: "0",
    textTransform: "uppercase" as const,
    transition: "color 0.2s, border-color 0.2s",
    "&:hover": {
      borderColor: "rgba(220, 38, 38, 0.7)",
      color: "#dc2626",
      backgroundColor: "rgba(220, 38, 38, 0.05)",
    },
  },
};
