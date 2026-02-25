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

    // Detect being attacked while idle (via polling state changes).
    // If HP or position changed while we're not moving, another player attacked us.
    const attackDetectionReady = useRef(false);
    const prevHpRef = useRef(0);
    const prevPosRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        // Not ready yet — wait for valid game state
        if (!ownershipValid || !isSpawned || isDead) {
            attackDetectionReady.current = false;
            return;
        }

        // First valid tick: seed refs with current values and skip detection
        if (!attackDetectionReady.current) {
            prevHpRef.current = hp;
            prevPosRef.current = blockchainPosition;
            attackDetectionReady.current = true;
            return;
        }

        // During our own move the changes are expected — just track and skip
        if (isMovingRef.current) {
            prevHpRef.current = hp;
            prevPosRef.current = blockchainPosition;
            return;
        }

        const prevHp = prevHpRef.current;
        const prevPos = prevPosRef.current;

        const hpDecreased = prevHp > 0 && hp < prevHp;
        const posChanged = prevPos && blockchainPosition &&
            (prevPos.x !== blockchainPosition.x || prevPos.y !== blockchainPosition.y);

        if (hpDecreased) {
            const hpLost = prevHp - hp;

            let title: string;
            let detail: string;

            if (posChanged) {
                // Defender lost: took full damage, got pushed to attacker's old tile
                title = "You were attacked!";
                detail = `An opponent overpowered you. -${hpLost} HP. Your position has changed.`;
            } else {
                // Defender won: took retaliation damage, stayed put (no XP reward)
                title = "You were attacked!";
                detail = `You fought off an attacker! -${hpLost} HP (retaliation).`;
            }

            toast.custom(
                (t) => (
                    <div
                        style={{
                            opacity: t.visible ? 1 : 0,
                            transition: "opacity 0.2s ease",
                            background: "rgba(10, 10, 30, 0.95)",
                            border: "1px solid #ff9800",
                            borderRadius: 8,
                            padding: "12px 16px",
                            color: "#e0e0e0",
                            fontFamily: "monospace",
                            fontSize: 13,
                            maxWidth: 300,
                        }}
                    >
                        <div style={{ fontWeight: 600, marginBottom: 6, color: "#ff9800" }}>
                            {title}
                        </div>
                        <div style={{ color: "#ccc", fontSize: 12, lineHeight: 1.4 }}>
                            {detail}
                        </div>
                    </div>
                ),
                { duration: 5000 }
            );
        }

        // Update refs
        prevHpRef.current = hp;
        prevPosRef.current = blockchainPosition;
    }, [hp, blockchainPosition, ownershipValid, isSpawned, isDead]);

    // URL validation and ownership check
    useEffect(() => {
        // Skip if already validated or currently validating
        if (ownershipValid) {
            return;
        }

        let timeoutId: NodeJS.Timeout | null = null;
        let isMounted = true;

        const validateOwnership = async () => {
            // First check: valid game_id in URL
            if (!gameId || gameId <= 0) {
                navigate("/");
                return;
            }

            // Wait for wallet connection
            if (!address) {
                if (isMounted) {
                    setIsValidatingOwnership(true);
                }
                return;
            }

            try {
                if (isMounted) {
                    setIsValidatingOwnership(true);
                }

                // Fetch game state with timeout to prevent infinite loading
                timeoutId = setTimeout(() => {
                    if (isMounted) {
                        setIsValidatingOwnership(false);
                        navigate("/");
                    }
                }, 10000); // 10 second timeout

                const gameState = await getGameState(gameId);

                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (!gameState) {
                    if (isMounted) {
                        setIsValidatingOwnership(false);
                        navigate("/");
                    }
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
                    if (isMounted) {
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
                    }
                } else {
                    if (isMounted) {
                        setIsValidatingOwnership(false);
                        navigate("/");
                    }
                }
            } catch (error) {
                console.error("Error validating ownership:", error);
                if (isMounted) {
                    setIsValidatingOwnership(false);
                    navigate("/");
                }
            }
        };

        validateOwnership();

        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
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
            return;
        }

        if (!canMove) {
            return;
        }

        // Calculate direction from current position to target
        const currentHexPos = vec2ToHexPosition(blockchainPosition);
        const direction = calculateDirection(currentHexPos, targetPos);

        if (direction === null) {
            return;
        }

        // Execute blockchain move
        handleBlockchainMove(direction);
    }, [blockchainPosition, canMove, isMoving, handleBlockchainMove, isSpawned]);

    // Loading state
    if (isValidatingOwnership || !ownershipValid) {
        return (
            <div style={{ width: "100%", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 40%, #1a2e1a 0%, #0a140a 100%)" }}>
                <div style={{ width: "24px", height: "24px", border: "2px solid rgba(68, 204, 68, 0.2)", borderTop: "2px solid rgba(68, 204, 68, 0.8)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (isDead) {
        return <DeathPage />;
    }

    if (!isSpawned || !blockchainPosition) {
        return (
            <div style={{ width: "100%", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 50% 40%, #1a2e1a 0%, #0a140a 100%)" }}>
                <div style={{ width: "24px", height: "24px", border: "2px solid rgba(68, 204, 68, 0.2)", borderTop: "2px solid rgba(68, 204, 68, 0.8)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: "100dvh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Header />
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                {/* Position Display */}
                <div style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    zIndex: 1000,
                    color: "#ffffff",
                    background: "rgba(10, 25, 15, 0.8)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    fontFamily: "monospace",
                    fontSize: "13px",
                    border: "1px solid rgba(68, 204, 68, 0.2)",
                    pointerEvents: "auto",
                }}>
                    <div style={{ marginBottom: 4, fontWeight: 600, color: "#44cc44" }}>
                        Position: ({playerPosition.col}, {playerPosition.row})
                    </div>
                    {/* HP Bar */}
                    <div style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: "#44cc44" }}>HP</span>
                            <span style={{ color: "#ffffff" }}>{hp}/{maxHp}</span>
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
                    <div style={{ fontSize: 11, color: "#ffffff", marginBottom: 6 }}>
                        <span style={{ color: "#44cc44" }}>XP</span>: {xp}
                    </div>
                    <div style={{ fontSize: 11, color: "#ffffff", marginBottom: 8 }}>
                        {isMoving ? (
                            <span style={{ color: "#44cc44" }}>Resolving move...</span>
                        ) : (
                            <><span style={{ color: "#44cc44" }}>Can Move:</span> {canMove ? "Yes" : "Wait..."}</>
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
