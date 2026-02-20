import { Box, Button, Typography } from "@mui/material";
import {
  Target,
  Hexagon,
  Eye,
  Gift,
  Skull,
  Swords,
  Heart,
  Trophy,
  X,
} from "lucide-react";
import { useUIStore } from "../stores/uiStore";

interface TutorialSection {
  icon: any;
  title: string;
  description: string;
  details?: string[];
}

const tutorialSections: TutorialSection[] = [
  {
    icon: Target,
    title: "Objective",
    description:
      "Survive as long as possible while accumulating XP. Your XP becomes your final score when you die. Last as long as you can to dominate the leaderboard.",
  },
  {
    icon: Hexagon,
    title: "Movement",
    description:
      "Click any adjacent hex to move. Each move grants +10 XP automatically. Every move reveals what's nearby and triggers new events.",
  },
  {
    icon: Eye,
    title: "Fog of War",
    description:
      "You can only see adjacent tiles. Red hexes are occupied by other players. Green hexes are empty and safe to explore.",
  },
  {
    icon: Gift,
    title: "Gifts (65% chance)",
    description:
      "Moving to empty tiles triggers encounters. Most are gifts that help you:",
    details: [
      "Heal: +20 HP",
      "Empower: +25 XP",
      "Blessing: +10 HP, +15 XP",
    ],
  },
  {
    icon: Skull,
    title: "Curses (35% chance)",
    description: "Some encounters are curses that harm you:",
    details: ["Poison: -15 HP", "Drain: -5 XP", "Hex: -10 HP, -5 XP"],
  },
  {
    icon: Swords,
    title: "Combat",
    description:
      "Move onto a red hex to attack that player. Higher XP wins the battle. Loser takes 10 damage, winner gains +30 XP. You can attack even offline players!",
  },
  {
    icon: Heart,
    title: "Your Stats",
    description:
      "HP: You start with 100, max is 110. You die at 0 HP. XP: This is your score. Both stats are visible on your position tracker.",
  },
  {
    icon: Trophy,
    title: "Death & Glory",
    description:
      "Reach 0 HP and your game ends. Your final XP is your score. Register it to claim your spot on the leaderboard!",
  },
];

export default function HowToPlayModal() {
  const { showHelpModal, setShowHelpModal } = useUIStore();

  if (!showHelpModal) return null;

  const handleClose = () => {
    setShowHelpModal(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem("hexed_tutorial_seen", "true");
    setShowHelpModal(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <Box sx={styles.overlay} onClick={handleBackdropClick}>
      {/* Background layers */}
      <Box sx={styles.backgroundGradient} />
      <Box sx={styles.vignette} />

      {/* Modal content */}
      <Box sx={styles.modal}>
        {/* Header */}
        <Box sx={styles.header}>
          <Typography sx={styles.headerTitle}>HOW TO PLAY</Typography>
          <Box sx={styles.closeButton} onClick={handleClose}>
            <X size={24} />
          </Box>
        </Box>

        {/* Scrollable content */}
        <Box sx={styles.scrollContainer}>
          {tutorialSections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <Box key={index} sx={styles.section}>
                <Box sx={styles.sectionHeader}>
                  <Box sx={styles.iconContainer}>
                    <IconComponent size={20} strokeWidth={2.5} />
                  </Box>
                  <Typography sx={styles.sectionTitle}>
                    {section.title}
                  </Typography>
                </Box>
                <Typography sx={styles.sectionDescription}>
                  {section.description}
                </Typography>
                {section.details && (
                  <Box sx={styles.detailsList}>
                    {section.details.map((detail, i) => (
                      <Typography key={i} sx={styles.detailItem}>
                        • {detail}
                      </Typography>
                    ))}
                  </Box>
                )}
                {index < tutorialSections.length - 1 && (
                  <Box sx={styles.divider} />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Footer */}
        <Box sx={styles.footer}>
          <Button
            variant="text"
            onClick={handleDontShowAgain}
            sx={styles.dontShowButton}
          >
            Don't show again
          </Button>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={styles.gotItButton}
          >
            Got It!
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    width: "100vw",
    height: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    animation: "fadeIn 0.3s ease-out",
    "@keyframes fadeIn": {
      "0%": { opacity: 0 },
      "100%": { opacity: 1 },
    },
  },
  backgroundGradient: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background:
      "radial-gradient(ellipse at 50% 40%, rgba(26, 21, 53, 0.95) 0%, rgba(10, 5, 20, 0.98) 100%)",
    backdropFilter: "blur(8px)",
    zIndex: 0,
  },
  vignette: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background:
      "radial-gradient(circle at 50% 50%, transparent 20%, rgba(0, 0, 0, 0.6) 100%)",
    zIndex: 1,
  },
  modal: {
    position: "relative" as const,
    zIndex: 10,
    width: "90%",
    maxWidth: "600px",
    maxHeight: "85vh",
    backgroundColor: "rgba(10, 10, 30, 0.95)",
    border: "1px solid rgba(0, 212, 255, 0.3)",
    borderRadius: 0,
    display: "flex",
    flexDirection: "column" as const,
    animation: "slideIn 0.4s ease-out",
    "@keyframes slideIn": {
      "0%": { opacity: 0, transform: "translateY(20px)" },
      "100%": { opacity: 1, transform: "translateY(0)" },
    },
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: { xs: "20px 24px", sm: "24px 32px" },
    borderBottom: "1px solid rgba(0, 212, 255, 0.2)",
  },
  headerTitle: {
    fontSize: { xs: "1.2rem", sm: "1.4rem" },
    fontWeight: 700,
    letterSpacing: "4px",
    color: "#00d4ff",
    textTransform: "uppercase" as const,
    textShadow: "0 0 20px rgba(0, 212, 255, 0.4)",
  },
  closeButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    color: "rgba(255, 255, 255, 0.5)",
    transition: "color 0.2s",
    "&:hover": {
      color: "#00d4ff",
    },
  },
  scrollContainer: {
    flex: 1,
    overflowY: "auto" as const,
    padding: { xs: "24px", sm: "32px" },
    "&::-webkit-scrollbar": {
      width: "8px",
    },
    "&::-webkit-scrollbar-track": {
      background: "rgba(0, 0, 0, 0.2)",
    },
    "&::-webkit-scrollbar-thumb": {
      background: "rgba(0, 212, 255, 0.3)",
      borderRadius: 0,
    },
    "&::-webkit-scrollbar-thumb:hover": {
      background: "rgba(0, 212, 255, 0.5)",
    },
  },
  section: {
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  iconContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#00d4ff",
  },
  sectionTitle: {
    fontSize: { xs: "0.9rem", sm: "1rem" },
    fontWeight: 700,
    letterSpacing: "2px",
    color: "#00d4ff",
    textTransform: "uppercase" as const,
  },
  sectionDescription: {
    fontSize: { xs: "0.85rem", sm: "0.9rem" },
    lineHeight: 1.7,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: "8px",
  },
  detailsList: {
    marginTop: "12px",
    marginLeft: "32px",
  },
  detailItem: {
    fontSize: { xs: "0.8rem", sm: "0.85rem" },
    lineHeight: 1.8,
    color: "rgba(255, 255, 255, 0.6)",
    fontFamily: "monospace",
  },
  divider: {
    width: "100%",
    height: "1px",
    background: "rgba(255, 255, 255, 0.1)",
    marginTop: "24px",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: { xs: "20px 24px", sm: "24px 32px" },
    borderTop: "1px solid rgba(0, 212, 255, 0.2)",
    gap: "16px",
  },
  dontShowButton: {
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "1px",
    color: "rgba(255, 255, 255, 0.4)",
    textTransform: "none" as const,
    "&:hover": {
      color: "rgba(255, 255, 255, 0.6)",
      backgroundColor: "transparent",
    },
  },
  gotItButton: {
    padding: "12px 32px",
    fontSize: "0.85rem",
    fontWeight: 600,
    letterSpacing: "3px",
    color: "#00d4ff",
    borderColor: "rgba(0, 212, 255, 0.4)",
    borderRadius: 0,
    textTransform: "uppercase" as const,
    transition: "all 0.2s",
    "&:hover": {
      borderColor: "#00d4ff",
      backgroundColor: "rgba(0, 212, 255, 0.1)",
    },
  },
};
