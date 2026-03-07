/**
 * HighestScoreDisplay Component
 *
 * Displays the current highest scoring player on the leaderboard.
 * Resolves the owner of the scoring token and highlights when
 * the connected player holds the leading token.
 */

import { useHighestScore } from "@/stores/gameStore";
import { useController } from "@/contexts/controller";
import { shortAddress } from "@/utils/helpers";
import { num } from "starknet";

/** Normalize a Starknet address for reliable comparison. */
const normalizeAddress = (addr: string): string => {
  try {
    return num.toHex(num.toBigInt(addr)).toLowerCase();
  } catch {
    return addr.toLowerCase();
  }
};

export const HighestScoreDisplay = () => {
  const highestScore = useHighestScore();
  const { address } = useController();

  if (!highestScore) {
    return (
      <div
        style={{
          padding: "16px",
          border: "1px solid rgba(68, 204, 68, 0.3)",
          borderRadius: 4,
          textAlign: "center",
          color: "rgba(68, 204, 68, 0.6)",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        No scores yet
      </div>
    );
  }

  const isCurrentPlayer =
    address &&
    highestScore.ownerAddress &&
    highestScore.ownerAddress !== "0x0" &&
    normalizeAddress(address) ===
      normalizeAddress(highestScore.ownerAddress);

  const borderColor = isCurrentPlayer ? "#fbbf24" : "#44cc44";
  const bgColor = isCurrentPlayer
    ? "rgba(251, 191, 36, 0.06)"
    : "rgba(68, 204, 68, 0.05)";

  return (
    <div
      style={{
        padding: "16px",
        border: `2px solid ${borderColor}`,
        borderRadius: 4,
        background: bgColor,
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      <div
        style={{
          marginBottom: 8,
          color: borderColor,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        HIGHEST SCORE
      </div>
      <div style={{ color: "#44cc44", fontWeight: 600, marginBottom: 6 }}>
        {highestScore.xp} XP
      </div>
      <div
        style={{
          fontSize: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: isCurrentPlayer ? "#44cc44" : "rgba(68, 204, 68, 0.7)" }}>
          {highestScore.ownerAddress && highestScore.ownerAddress !== "0x0"
            ? shortAddress(highestScore.ownerAddress)
            : `Token ${shortAddress(highestScore.scoringTokenId)}`}
        </span>
        {isCurrentPlayer && (
          <span style={{ color: "#fbbf24", fontWeight: 600 }}>(you)</span>
        )}
      </div>
    </div>
  );
};
