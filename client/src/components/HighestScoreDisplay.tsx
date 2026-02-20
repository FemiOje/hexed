/**
 * HighestScoreDisplay Component
 *
 * Displays the current highest scoring player on the leaderboard
 * Shows player username (or address) and XP
 */

import { useHighestScore } from "@/stores/gameStore";
import { shortAddress } from "@/utils/helpers";

export const HighestScoreDisplay = () => {
  const highestScore = useHighestScore();

  if (!highestScore) {
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid #666",
          borderRadius: 4,
          textAlign: "center",
          color: "#999",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        No scores yet
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px",
        border: "2px solid #ffd700",
        borderRadius: 4,
        background: "rgba(255, 215, 0, 0.05)",
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      <div style={{ marginBottom: 8, color: "#ffd700", fontWeight: 600 }}>
        HIGHEST SCORE
      </div>
      <div style={{ marginBottom: 6, color: "#e0e0e0" }}>
        <strong>{highestScore.username}</strong>
      </div>
      <div style={{ color: "#4caf50", fontWeight: 600 }}>
        {highestScore.xp} XP
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#666" }}>
        {shortAddress(highestScore.player)}
      </div>
    </div>
  );
};
