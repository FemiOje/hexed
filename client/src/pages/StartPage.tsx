import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import { useController } from "../contexts/controller";
import { useGameActions } from "../dojo/useGameActions";
import WalletConnect from "../components/WalletConnect";

export default function StartPage() {
    const navigate = useNavigate();
    const { address } = useController();
    const { handleSpawn, isLoading } = useGameActions();
    const [isSpawning, setIsSpawning] = useState(false);

    const handleStartGame = useCallback(async () => {
        if (!address) {
            console.warn("No wallet connected");
            return;
        }

        setIsSpawning(true);

        try {
            await handleSpawn();
            navigate("/game");
        } catch (error) {
            console.error("Spawn failed:", error);
            setIsSpawning(false);
        }
    }, [handleSpawn, address, navigate]);

    return (
        <Box sx={styles.container}>
            <Box sx={styles.background} />

            <Box sx={styles.content}>
                <Typography sx={styles.title}>
                    UNTITLED
                </Typography>
                <Typography sx={styles.subtitle}>
                    Battle Royale
                </Typography>

                <Box sx={styles.walletSection}>
                    <WalletConnect />
                </Box>

                {address && (
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleStartGame}
                        disabled={isLoading || isSpawning}
                        sx={styles.startButton}
                    >
                        {isSpawning ? "Spawning Player..." : "Start Game"}
                    </Button>
                )}

                {!address && (
                    <Typography sx={styles.connectPrompt}>
                        Connect your wallet to start playing
                    </Typography>
                )}

                {/* Footer */}
                <Typography sx={styles.footer}>
                    Built with Dojo Engine on Starknet
                </Typography>
            </Box>
        </Box>
    );
}

const styles = {
    container: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    background: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0a0a1e 0%, #1a1a3e 50%, #0a0a1e 100%)",
        zIndex: 0,
    },
    content: {
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: 4,
        backgroundColor: "rgba(10, 10, 30, 0.8)",
        borderRadius: "16px",
        border: "2px solid rgba(66, 133, 244, 0.3)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
        minWidth: "400px",
    },
    title: {
        fontSize: "3rem",
        fontWeight: 700,
        letterSpacing: 4,
        textAlign: "center",
        background: "linear-gradient(135deg, #4285f4 0%, #34a853 100%)",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 20px rgba(66, 133, 244, 0.3)",
    },
    subtitle: {
        fontSize: "1.2rem",
        fontWeight: 400,
        color: "#e0e0e0",
        letterSpacing: 2,
        textAlign: "center",
        opacity: 0.8,
    },
    walletSection: {
        marginTop: 2,
        marginBottom: 1,
    },
    startButton: {
        marginTop: 2,
        padding: "16px 48px",
        fontSize: "1.1rem",
        fontWeight: 600,
        letterSpacing: 1,
        background: "linear-gradient(135deg, #4285f4 0%, #34a853 100%)",
        color: "#fff",
        borderRadius: "8px",
        textTransform: "uppercase",
        boxShadow: "0 4px 16px rgba(66, 133, 244, 0.4)",
        transition: "all 0.3s ease",
        "&:hover": {
            background: "linear-gradient(135deg, #5295ff 0%, #45b963 100%)",
            boxShadow: "0 6px 24px rgba(66, 133, 244, 0.6)",
            transform: "translateY(-2px)",
        },
        "&:disabled": {
            background: "rgba(66, 133, 244, 0.3)",
            color: "rgba(255, 255, 255, 0.5)",
            boxShadow: "none",
        },
    },
    connectPrompt: {
        marginTop: 2,
        fontSize: "0.9rem",
        color: "#aaa",
        textAlign: "center",
        fontStyle: "italic",
    },
    footer: {
        marginTop: 3,
        fontSize: "0.8rem",
        color: "#666",
        textAlign: "center",
        letterSpacing: 0.5,
    },
};
