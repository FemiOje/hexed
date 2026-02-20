import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import toast from "react-hot-toast";

export default function GamePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { refreshGameState } = useGameDirector();
    const { address } = useController();
    const { getGameState } = useStarknetApi();

    // Get store actions for populating game state
    const { setPosition, setMoves, setIsSpawned, setIsDead, setGameId, setStats, setOccupiedNeighbors } = useGameStore();

    // Get game_id from URL
    const gameIdFromUrl = searchParams.get("id");
    const gameId = gameIdFromUrl ? parseInt(gameIdFromUrl, 10) : null;

    // Ownership validation state
    const [isValidatingOwnership, setIsValidatingOwnership] = useState(true);
    const [ownershipValid, setOwnershipValid] = useState(false);

    // Get blockchain state
    const blockchainPosition = useCurrentPosition();
    const isSpawned = useIsSpawned();
    const isDead = useIsDead();
    const canMove = useCanPlayerMove();
    const hp = usePlayerHp();
    const maxHp = usePlayerMaxHp();
    const xp = usePlayerXp();
    const occupiedNeighbors = useGameStore((state) => state.occupiedNeighbors);
    const { handleMove: handleBlockchainMove, isMoving } = useGameActions();

    // Track isMoving in a ref so the polling interval can read it
    // without restarting the interval on every isMoving change
    const isMovingRef = useRef(isMoving);
    useEffect(() => {
        isMovingRef.current = isMoving;
    }, [isMoving]);

    // Poll game state every 6 seconds (Torii indexer is down,
    // so we cannot subscribe to entities/events)
    useEffect(() => {
        if (!ownershipValid || isDead || !isSpawned) return;

        const intervalId = setInterval(async () => {
            if (isMovingRef.current) return;
            try {
                await refreshGameState();
            } catch (error) {
                console.error("Polling refresh failed:", error);
            }
        }, 4000);

        return () => clearInterval(intervalId);
    }, [ownershipValid, isDead, isSpawned, refreshGameState]);

    // Show death toast when killed while idle (detected by polling).
    // Skip if isMoving — handleMove shows its own death toast.
    const prevIsDeadRef = useRef(isDead);
    useEffect(() => {
        if (isDead && !prevIsDeadRef.current && !isMovingRef.current) {
            const reason = useGameStore.getState().deathReason || "Slain by another player";
            toast.custom(
                (t) => (
                    <div
                        style={{
                            opacity: t.visible ? 1 : 0,
                            transition: "opacity 0.2s ease",
                            background: "rgba(10, 10, 30, 0.95)",
                            border: "1px solid #f44336",
                            borderRadius: 8,
                            padding: "12px 16px",
                            color: "#e0e0e0",
                            fontFamily: "monospace",
                            fontSize: 13,
                            maxWidth: 280,
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 6, color: "#f44336" }}>
                            You were killed!
                        </div>
                        <div style={{ color: "#aaa", fontSize: 12 }}>
                            {reason}
                        </div>
                    </div>
                ),
                { duration: 4000 }
            );
        }
        prevIsDeadRef.current = isDead;
    }, [isDead]);

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
                    setOccupiedNeighbors(gameState.neighbor_occupancy);
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

        if (isMoving) {
            return;
        }

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
    }, [blockchainPosition, canMove, isMoving, handleBlockchainMove, isSpawned]);

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
                        {isMoving ? (
                            <span style={{ color: "#f5a623" }}>Resolving move...</span>
                        ) : (
                            <>Can Move: {canMove ? "Yes" : "Wait..."}</>
                        )}
                    </div>
                </div>

                <HexGrid
                    width={20}
                    height={20}
                    playerPosition={playerPosition}
                    onMove={handleMove}
                    disabled={isMoving}
                    occupiedNeighborsMask={occupiedNeighbors}
                />
            </div>
        </div>
    );
}
