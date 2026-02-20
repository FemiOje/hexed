import { Box, Typography } from "@mui/material";
import { useController } from "../contexts/controller";
import WalletConnect from "../components/WalletConnect";
import MyGames from "../components/MyGames";
import { HighestScoreDisplay } from "../components/HighestScoreDisplay";

export default function StartPage() {
    const { address } = useController();

    return (
        <Box sx={styles.container}>
            {/* Background layers */}
            <Box sx={styles.backgroundGradient} />
            <Box sx={styles.hexPattern} />
            <Box sx={styles.fogOverlay} />
            <Box sx={styles.vignette} />

            {/* Subtle floating hexagons */}
            <Box sx={styles.floatingHex1} />
            <Box sx={styles.floatingHex2} />
            <Box sx={styles.floatingHex3} />
            <Box sx={styles.floatingHex4} />

            {/* Content */}
            <Box sx={styles.content}>
                <Box sx={styles.titleContainer}>
                    <Typography sx={styles.title}>HEXED</Typography>
                    <Box sx={styles.titleGlow} />
                </Box>

                <Typography sx={styles.subtitle}>
                    BATTLE ROYALE
                </Typography>

                <Typography sx={styles.tagline}>
                    Survive the Fog · Conquer the Grid
                </Typography>

                <Box sx={styles.divider} />

                <Box sx={styles.walletSection}>
                    <WalletConnect />
                </Box>

                {address ? (
                    <Box sx={styles.gamesSection}>
                        <MyGames />
                    </Box>
                ) : (
                    <Typography sx={styles.connectPrompt}>
                        Log in to enter the arena
                    </Typography>
                )}

                <Box sx={styles.leaderboardSection}>
                    <HighestScoreDisplay />
                </Box>

                <Typography sx={styles.footer}>
                    Powered by Dojo Engine · Built on Starknet
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
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    backgroundGradient: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "radial-gradient(ellipse at 50% 40%, #1a1535 0%, #0a0514 100%)",
        zIndex: 0,
    },
    hexPattern: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundImage: `
            linear-gradient(30deg, transparent 48%, rgba(0, 212, 255, 0.04) 49%, rgba(0, 212, 255, 0.04) 51%, transparent 52%),
            linear-gradient(90deg, transparent 48%, rgba(0, 212, 255, 0.04) 49%, rgba(0, 212, 255, 0.04) 51%, transparent 52%),
            linear-gradient(150deg, transparent 48%, rgba(0, 212, 255, 0.04) 49%, rgba(0, 212, 255, 0.04) 51%, transparent 52%)
        `,
        backgroundSize: "100px 173.2px",
        zIndex: 1,
        animation: "drift 40s linear infinite",
        "@keyframes drift": {
            "0%": { transform: "translate(0, 0)" },
            "100%": { transform: "translate(100px, 173.2px)" },
        },
    },
    fogOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "radial-gradient(circle at 50% 40%, rgba(0, 212, 255, 0.06) 0%, transparent 60%)",
        zIndex: 2,
        animation: "fogPulse 10s ease-in-out infinite",
        "@keyframes fogPulse": {
            "0%, 100%": { opacity: 0.4 },
            "50%": { opacity: 0.8 },
        },
    },
    vignette: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 0, 0, 0.7) 100%)",
        zIndex: 3,
    },
    // Refined floating hexagons — fewer, subtler, no rotation
    floatingHex1: {
        position: "absolute",
        top: "15%",
        left: "10%",
        width: "64px",
        height: "74px",
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: "rgba(0, 212, 255, 0.06)",
        zIndex: 4,
        animation: "float1 12s ease-in-out infinite",
        "@keyframes float1": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-20px)" },
        },
    },
    floatingHex2: {
        position: "absolute",
        top: "60%",
        right: "12%",
        width: "48px",
        height: "55px",
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: "rgba(139, 92, 246, 0.06)",
        zIndex: 4,
        animation: "float2 14s ease-in-out infinite",
        "@keyframes float2": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-24px)" },
        },
    },
    floatingHex3: {
        position: "absolute",
        bottom: "18%",
        left: "20%",
        width: "40px",
        height: "46px",
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: "rgba(0, 212, 255, 0.05)",
        zIndex: 4,
        animation: "float3 16s ease-in-out infinite",
        "@keyframes float3": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-18px)" },
        },
    },
    floatingHex4: {
        position: "absolute",
        top: "30%",
        right: "22%",
        width: "36px",
        height: "42px",
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        background: "rgba(139, 92, 246, 0.04)",
        zIndex: 4,
        animation: "float4 18s ease-in-out infinite",
        "@keyframes float4": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-16px)" },
        },
    },
    content: {
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        padding: { xs: "24px", sm: "48px" },
        maxWidth: "600px",
        width: "100%",
        animation: "fadeIn 0.6s ease-out",
        "@keyframes fadeIn": {
            "0%": { opacity: 0, transform: "translateY(16px)" },
            "100%": { opacity: 1, transform: "translateY(0)" },
        },
    },
    titleContainer: {
        position: "relative",
        marginBottom: "4px",
    },
    title: {
        fontSize: { xs: "3.5rem", sm: "5.5rem", md: "6.5rem" },
        fontWeight: 900,
        letterSpacing: { xs: "8px", sm: "14px", md: "18px" },
        textAlign: "center",
        color: "#e0f7ff",
        textShadow: `
            0 0 30px rgba(0, 212, 255, 0.5),
            0 0 80px rgba(0, 212, 255, 0.25)
        `,
        animation: "titleGlow 4s ease-in-out infinite",
        "@keyframes titleGlow": {
            "0%, 100%": {
                textShadow: "0 0 30px rgba(0, 212, 255, 0.5), 0 0 80px rgba(0, 212, 255, 0.25)",
            },
            "50%": {
                textShadow: "0 0 40px rgba(0, 212, 255, 0.7), 0 0 100px rgba(0, 212, 255, 0.35)",
            },
        },
    },
    titleGlow: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "120%",
        height: "120%",
        background: "radial-gradient(circle, rgba(0, 212, 255, 0.15), transparent 70%)",
        filter: "blur(40px)",
        zIndex: -1,
    },
    subtitle: {
        fontSize: { xs: "0.85rem", sm: "1rem" },
        fontWeight: 600,
        color: "rgba(255, 255, 255, 0.5)",
        letterSpacing: "6px",
        textAlign: "center",
        textTransform: "uppercase",
    },
    tagline: {
        fontSize: { xs: "0.75rem", sm: "0.85rem" },
        fontWeight: 400,
        color: "rgba(255, 255, 255, 0.3)",
        letterSpacing: "1.5px",
        textAlign: "center",
    },
    divider: {
        width: "80px",
        height: "1px",
        background: "rgba(255, 255, 255, 0.12)",
        marginTop: "8px",
        marginBottom: "8px",
    },
    walletSection: {
        marginTop: "4px",
        marginBottom: "4px",
    },
    gamesSection: {
        marginTop: "8px",
        width: "100%",
    },
    leaderboardSection: {
        marginTop: "24px",
        width: "100%",
        maxWidth: "400px",
    },
    connectPrompt: {
        fontSize: "0.85rem",
        color: "rgba(255, 255, 255, 0.35)",
        textAlign: "center",
        letterSpacing: "0.5px",
    },
    footer: {
        marginTop: "32px",
        fontSize: "0.7rem",
        color: "rgba(255, 255, 255, 0.2)",
        textAlign: "center",
        letterSpacing: "0.5px",
    },
};
