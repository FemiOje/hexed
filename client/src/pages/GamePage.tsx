import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeysClause, ToriiQueryBuilder } from "@dojoengine/sdk";
// import { useAccount } from "@starknet-react/core";
import { useEntityQuery } from "@dojoengine/sdk/react";
import { Button } from "@mui/material";
import { num } from "starknet";
import HexGrid from "../components/HexGrid";
import Header from "../components/Header";
import type { HexPosition } from "../three/utils";
import { useCurrentPosition, useIsSpawned, useIsDead, useCanPlayerMove, usePlayerHp, usePlayerMaxHp, usePlayerXp, useGameStore } from "../stores/gameStore";
import DeathPage from "../components/DeathPage";
import { useGameActions } from "../dojo/useGameActions";
import { useGameDirector } from "../contexts/GameDirector";
import { useController } from "../contexts/controller";
import { useStarknetApi } from "../api/starknet";
import { vec2ToHexPosition, calculateDirection } from "../utils/coordinateMapping";

export default function GamePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshGameState } = useGameDirector();
    const { address } = useController();
    const { getGameState } = useStarknetApi();

    // Get store actions for populating game state
    const { setPosition, setMoves, setIsSpawned, setIsDead, setGameId, setStats } = useGameStore();

    // Get game_id from URL
    const gameIdFromUrl = searchParams.get("id");
    const gameId = gameIdFromUrl ? parseInt(gameIdFromUrl, 10) : null;

    // Ownership validation state
    const [isValidatingOwnership, setIsValidatingOwnership] = useState(true);
    const [ownershipValid, setOwnershipValid] = useState(false);

    // Query all entities - for debugging/overview
    // Note: This can be expensive, use specific queries in production
    useEntityQuery(
        new ToriiQueryBuilder()
            .withClause(
                KeysClause([], [], "VariableLen").build()
            )
            .includeHashedKeys()
    );

    // Get blockchain state
    const blockchainPosition = useCurrentPosition();
    const isSpawned = useIsSpawned();
    const isDead = useIsDead();
    const canMove = useCanPlayerMove();
    const hp = usePlayerHp();
    const maxHp = usePlayerMaxHp();
    const xp = usePlayerXp();
    const { handleMove: handleBlockchainMove } = useGameActions();

    // Manual refresh handler
    const handleRefresh = useCallback(async () => {
        console.log("🔄 Manual refresh triggered");
        await refreshGameState();
    }, [refreshGameState]);

    // useEffect(() => {
    //     console.log("GamePage state:", {
    //         isSpawned,
    //         blockchainPosition,
    //         canMove,
    //         moves,
    //         isLoading
    //     });
    // }, [isSpawned, blockchainPosition, canMove, moves, isLoading]);

    // URL validation and ownership check
    useEffect(() => {
        // Skip if already validated or currently validating
        if (ownershipValid) {
            return;
        }

        const validateOwnership = async () => {
            // First check: valid game_id in URL
            if (!gameId || gameId <= 0) {
                console.log("No valid game ID in URL, redirecting to start page...");
                navigate("/");
                return;
            }

            // Wait for wallet connection
            if (!address) {
                setIsValidatingOwnership(true);
                return;
            }

            try {
                setIsValidatingOwnership(true);

                // Fetch game state to verify ownership
                const gameState = await getGameState(gameId);

                if (!gameState) {
                    console.warn("Game not found:", gameId);
                    navigate("/");
                    return;
                }

                // Check ownership - normalize addresses using starknet.js utilities
                // This handles different padding/formatting of Starknet addresses
                const normalizeAddress = (addr: string) => {
                    try {
                        // Convert to BigInt and back to hex to normalize
                        return num.toHex(num.toBigInt(addr));
                    } catch {
                        return addr.toLowerCase();
                    }
                };

                const gamePlayer = normalizeAddress(gameState.player);
                const connectedAddress = normalizeAddress(address);

                if (gamePlayer === connectedAddress) {
                    // Populate store with game state
                    setGameId(gameId);
                    setPosition({
                        player: address,
                        vec: gameState.position,
                    });
                    setMoves({
                        player: address,
                        last_direction: gameState.last_direction,
                        can_move: gameState.can_move,
                    });
                    setStats(gameState.hp, gameState.max_hp, gameState.xp);
                    setIsSpawned(gameState.is_active);

                    // Detect death
                    if (!gameState.is_active && gameState.hp === 0) {
                        setIsDead(true, gameState.xp);
                    }

                    setOwnershipValid(true);
                    setIsValidatingOwnership(false);
                } else {
                    console.warn("❌ Ownership mismatch");
                    console.warn("Game belongs to:", gameState.player, "→", gamePlayer);
                    console.warn("Connected wallet:", address, "→", connectedAddress);
                    navigate("/");
                }
            } catch (error) {
                console.error("Error validating ownership:", error);
                navigate("/");
            }
        };

        validateOwnership();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, address, ownershipValid]);

    // Convert blockchain Vec2 to HexPosition for display
    const playerPosition: HexPosition = blockchainPosition
        ? vec2ToHexPosition(blockchainPosition)
        : { col: 0, row: 0 };

    // Handle move from HexGrid
    const handleMove = useCallback((targetPos: HexPosition) => {

        if (!blockchainPosition) {
            console.warn("Cannot move: player position not available");
            return;
        }

        if (!canMove) {
            console.warn("Cannot move: waiting for cooldown");
            return;
        }

        // Calculate direction from current position to target
        const currentHexPos = vec2ToHexPosition(blockchainPosition);
        const direction = calculateDirection(currentHexPos, targetPos);

        if (direction === null) {
            console.warn("Invalid move: positions are not adjacent");
            return;
        }

        // Execute blockchain move
        handleBlockchainMove(direction);
    }, [blockchainPosition, canMove, handleBlockchainMove, isSpawned]);

    // Show loading state while validating ownership or waiting for blockchain sync
    if (isValidatingOwnership || !ownershipValid) {
        return (
            <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a0a1e 0%, #1a1a3e 50%, #0a0a1e 100%)" }}>
                <div style={{ textAlign: "center", color: "#e0e0e0" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Validating game ownership...</div>
                    <div style={{ fontSize: "0.9rem", color: "#aaa" }}>Checking blockchain</div>
                </div>
            </div>
        );
    }

    if (isDead) {
        return <DeathPage />;
    }

    if (!isSpawned || !blockchainPosition) {
        return (
            <div style={{ width: "100%", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a0a1e 0%, #1a1a3e 50%, #0a0a1e 100%)" }}>
                <div style={{ textAlign: "center", color: "#e0e0e0" }}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Loading game state...</div>
                    <div style={{ fontSize: "0.9rem", color: "#aaa" }}>Syncing with blockchain</div>
                </div>
            </div>
        );
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
                    pointerEvents: "auto",
                }}>
                    <div style={{ marginBottom: 4, fontWeight: 600, color: "#f5a623" }}>
                        Position: ({playerPosition.col}, {playerPosition.row})
                    </div>
                    {/* HP Bar */}
                    <div style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: "#ff6b6b" }}>HP</span>
                            <span style={{ color: "#aaa" }}>{hp}/{maxHp}</span>
                        </div>
                        <div style={{
                            width: "100%",
                            height: 6,
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: 3,
                            overflow: "hidden",
                        }}>
                            <div style={{
                                width: maxHp > 0 ? `${(hp / maxHp) * 100}%` : "0%",
                                height: "100%",
                                background: hp / maxHp > 0.5 ? "#4caf50" : hp / maxHp > 0.25 ? "#ff9800" : "#f44336",
                                borderRadius: 3,
                                transition: "width 0.3s ease, background 0.3s ease",
                            }} />
                        </div>
                    </div>
                    {/* XP */}
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 6 }}>
                        <span style={{ color: "#9c27b0" }}>XP</span>: {xp}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 8 }}>
                        Can Move: {canMove ? "Yes" : "Wait..."}
                    </div>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleRefresh}
                        sx={{
                            fontSize: "0.7rem",
                            padding: "4px 8px",
                            minWidth: "auto",
                            borderColor: "rgba(66, 133, 244, 0.5)",
                            color: "#4285f4",
                            "&:hover": {
                                borderColor: "#4285f4",
                                backgroundColor: "rgba(66, 133, 244, 0.1)",
                            }
                        }}
                    >
                        Refresh State
                    </Button>
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
