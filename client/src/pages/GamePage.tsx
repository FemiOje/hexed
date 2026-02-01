import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KeysClause, ToriiQueryBuilder } from "@dojoengine/sdk";
// import { useAccount } from "@starknet-react/core";
import { useEntityQuery } from "@dojoengine/sdk/react";
import HexGrid from "../components/HexGrid";
import Header from "../components/Header";
import type { HexPosition } from "../three/utils";
import { useCurrentPosition, useIsSpawned, useCanPlayerMove } from "../stores/gameStore";
import { useGameActions } from "../dojo/useGameActions";
import { vec2ToHexPosition, calculateDirection } from "../utils/coordinateMapping";

export default function GamePage() {
    const navigate = useNavigate();
    // const { account } = useAccount();

    useEntityQuery(
        new ToriiQueryBuilder()
            .withClause(
                KeysClause([], [undefined], "VariableLen").build()
            )
            .includeHashedKeys()
    );

    // Get blockchain state
    const blockchainPosition = useCurrentPosition();
    const isSpawned = useIsSpawned();
    const canMove = useCanPlayerMove();
    const { handleMove: handleBlockchainMove, isLoading } = useGameActions();

    // Redirect to start page if not spawned
    useEffect(() => {
        if (!isSpawned && !isLoading) {
            navigate("/");
        }
    }, [isSpawned, isLoading, navigate]);

    // Convert blockchain Vec2 to HexPosition for display
    const playerPosition: HexPosition = blockchainPosition
        ? vec2ToHexPosition(blockchainPosition)
        : { col: 0, row: 0 };

    // Handle move from HexGrid
    const handleMove = useCallback((targetPos: HexPosition) => {
        if (!blockchainPosition || !canMove) {
            console.warn("Cannot move: player not spawned or cannot move yet");
            return;
        }

        // Calculate direction from current position to target
        const currentHexPos = vec2ToHexPosition(blockchainPosition);
        const direction = calculateDirection(currentHexPos, targetPos);

        if (!direction) {
            console.warn("Invalid move: positions are not adjacent");
            return;
        }

        // Execute blockchain move
        handleBlockchainMove(direction);
    }, [blockchainPosition, canMove, handleBlockchainMove]);

    // Don't render game if not spawned
    if (!isSpawned) {
        return null;
    }

    return (
        <div style={{ width: "100%", height: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Header />
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {/* Position Display */}
                <div style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 1000,
                    color: "#e0e0e0",
                    background: "rgba(10,10,30,0.8)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    pointerEvents: "none",
                }}>
                    <div style={{ marginBottom: 4, fontWeight: 600, color: "#f5a623" }}>
                        Position: ({playerPosition.col}, {playerPosition.row})
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>
                        Can Move: {canMove ? "Yes" : "Wait..."}
                    </div>
                </div>

                <HexGrid
                    width={20}
                    height={20}
                    playerPosition={playerPosition}
                    onMove={handleMove}
                />
            </div>
        </div>
    );
}
