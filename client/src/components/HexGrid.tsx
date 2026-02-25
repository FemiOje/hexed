import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createHexagonShape } from "../three/hexagon-geometry";
import { getWorldPositionForHex, type HexPosition } from "../three/utils";
import { HEX_SIZE } from "../three/constants";
import { calculateDirection } from "../utils/coordinateMapping";
import toast from "react-hot-toast";

// --- Color palette ---
const COLOR_PLAYER = new THREE.Color(0xf5a623);
const COLOR_HOVER_VALID = new THREE.Color(0x44cc44);
const COLOR_OCCUPIED_NEIGHBOR = new THREE.Color(0xe05555);

const BIOME_COLORS = [
  new THREE.Color(0x5a8c4a),
  new THREE.Color(0x4a7c59),
  new THREE.Color(0x6b9a5a),
  new THREE.Color(0x3d6b47),
  new THREE.Color(0x7aaa5a),
  new THREE.Color(0x4e7a3e),
];

const BIOME_ADJACENT = [
  new THREE.Color(0x7aac6a),
  new THREE.Color(0x6a9c79),
  new THREE.Color(0x8bba7a),
  new THREE.Color(0x5d8b67),
  new THREE.Color(0x9aca7a),
  new THREE.Color(0x6e9a5e),
];

const NEIGHBOR_DIST = Math.sqrt(3) * HEX_SIZE;
const NEIGHBOR_TOLERANCE = 2.0;

interface HexGridProps {
  width?: number;
  height?: number;
  playerPosition: HexPosition;
  onMove: (pos: HexPosition) => void;
  disabled?: boolean;
  occupiedNeighborsMask?: number;
}

function hexKey(pos: HexPosition): string {
  return `${pos.col},${pos.row}`;
}

function biomeIndex(hex: HexPosition): number {
  const hash = Math.sin(hex.col * 12.9898 + hex.row * 78.233) * 43758.5453;
  return Math.floor((hash - Math.floor(hash)) * BIOME_COLORS.length);
}

function isNeighbor(a: HexPosition, b: HexPosition): boolean {
  if (a.col === b.col && a.row === b.row) return false;
  const wa = getWorldPositionForHex(a);
  const wb = getWorldPositionForHex(b);
  const dist = Math.sqrt((wa.x - wb.x) ** 2 + (wa.z - wb.z) ** 2);
  return Math.abs(dist - NEIGHBOR_DIST) < NEIGHBOR_TOLERANCE;
}

/**
 * Calculate hex grid distance using proper axial coordinate math
 */
function hexDistance(a: HexPosition, b: HexPosition): number {
  const dq = Math.abs(a.col - b.col);
  const dr = Math.abs(a.row - b.row);
  const ds = Math.abs((a.col + a.row) - (b.col + b.row));
  return Math.max(dq, dr, ds);
}

/**
 * Calculate opacity based on distance from player with smooth falloff
 */
function calculateOpacity(distance: number): number {
  const FADE_START = 6; // Full opacity within 6 hexes
  const FADE_END = 9; // Minimum opacity at 9+ hexes

  if (distance <= FADE_START) return 1.0;
  if (distance >= FADE_END) return 0.15;

  // Smoothstep interpolation for natural falloff
  const t = (distance - FADE_START) / (FADE_END - FADE_START);
  const smoothT = t * t * (3 - 2 * t);
  return 1.0 - (0.85 * smoothT);
}

export default function HexGrid({
  width = 10,
  height = 10,
  playerPosition,
  onMove,
  disabled = false,
  occupiedNeighborsMask = 0,
}: HexGridProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const hexesRef = useRef<HexPosition[]>([]);
  const hoveredRef = useRef<number>(-1);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const playerPositionRef = useRef<HexPosition>(playerPosition);
  const userIsInteractingRef = useRef(false);


  // Mobile double-tap refs
  const isMobileDeviceRef = useRef(false);
  const pendingMobileHexRef = useRef<HexPosition | null>(null);
  const mobileToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileToastIdRef = useRef<string | null>(null);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const onMoveRef = useRef(onMove);
  const occupiedNeighborsMaskRef = useRef(occupiedNeighborsMask);
  const disabledRef = useRef(disabled);

  // Detect mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      isMobileDeviceRef.current = mountRef.current ? mountRef.current.clientWidth < 900 : false;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Update player position ref when it changes (without recreating scene)
  useEffect(() => {
    playerPositionRef.current = playerPosition;
  }, [playerPosition]);

  // Sync prop refs for use in event handlers
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => { occupiedNeighborsMaskRef.current = occupiedNeighborsMask; }, [occupiedNeighborsMask]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const updateColors = useCallback(
    (hoverIndex: number) => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const hexes = hexesRef.current;
      const playerKey = hexKey(playerPosition);

      for (let i = 0; i < hexes.length; i++) {
        const key = hexKey(hexes[i]);
        const bi = biomeIndex(hexes[i]);

        // Calculate distance-based opacity for edge blending
        const distance = hexDistance(hexes[i], playerPosition);
        const opacity = calculateOpacity(distance);

        let baseColor: THREE.Color;
        if (key === playerKey) {
          baseColor = COLOR_PLAYER;
        } else if (isNeighbor(hexes[i], playerPosition)) {
          if (i === hoverIndex) {
            baseColor = COLOR_HOVER_VALID;
          } else {
            // Check if this neighbor direction is occupied
            const dir = calculateDirection(playerPosition, hexes[i]);
            const isOccupied = dir !== null && occupiedNeighborsMask > 0 && ((occupiedNeighborsMask >> dir) & 1) === 1;
            if (isOccupied) {
              baseColor = COLOR_OCCUPIED_NEIGHBOR;
            } else {
              baseColor = BIOME_ADJACENT[bi];
            }
          }
        } else {
          baseColor = BIOME_COLORS[bi];
        }

        // Apply opacity by fading to darker, muted version of biome color
        const fadedColor = baseColor.clone();
        if (opacity < 1.0) {
          // Create darker, desaturated version of the base color
          const mutedColor = baseColor.clone();
          mutedColor.multiplyScalar(0.4); // Darken to 40%
          mutedColor.lerp(new THREE.Color(0x606060), 0.3); // Desaturate with gray

          fadedColor.lerp(mutedColor, 1.0 - opacity);
        }

        mesh.setColorAt(i, fadedColor);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    [playerPosition, occupiedNeighborsMask]
  );

  // --- Scene setup ---
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a140a); // Dark, murky green
    scene.fog = new THREE.Fog(0x0a1a0a, 120, 350); // Thicker, spookier fog

    // Initialize camera at player position
    const playerWorldPos = getWorldPositionForHex(playerPosition);

    // Adjust camera distance based on actual container width (more reliable than window.innerWidth)
    const isMobile = container.clientWidth < 900;  // Check actual container width
    const cameraHeight = isMobile ? 75 : 40;  // Higher on mobile
    const cameraZOffset = isMobile ? 95 : 50;  // Further back on mobile
    const fov = isMobile ? 75 : 45;  // Much wider field of view on mobile

    const camera = new THREE.PerspectiveCamera(
      fov,
      container.clientWidth / container.clientHeight,
      0.1,
      500
    );
    camera.position.set(playerWorldPos.x, cameraHeight, playerWorldPos.z + cameraZOffset);
    camera.lookAt(playerWorldPos.x, 0, playerWorldPos.z);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(playerWorldPos.x, 0, playerWorldPos.z);
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = isMobile ? 25 : 15;  // Larger minimum distance on mobile
    controls.maxDistance = 120;
    controls.panSpeed = 2.0;
    controlsRef.current = controls;

    // Track user interaction with controls
    controls.addEventListener('start', () => {
      userIsInteractingRef.current = true;
    });
    controls.addEventListener('end', () => {
      userIsInteractingRef.current = false;
    });

    // Lighting - darker, spookier atmosphere
    const hemiLight = new THREE.HemisphereLight(0x4a6741, 0x1a2e1a, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0x8faf7f, 4.1);
    sunLight.position.set(-10, 25, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.002;
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.37);
    scene.add(ambientLight);

    // Hex grid
    const hexagonShape = createHexagonShape(HEX_SIZE);
    const hexagonGeometry = new THREE.ShapeGeometry(hexagonShape);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.7,
      metalness: 0.0,
    });

    const hexes: HexPosition[] = [];
    for (
      let row = -Math.floor(height / 2);
      row <= Math.floor(height / 2);
      row++
    ) {
      for (
        let col = -Math.floor(width / 2);
        col <= Math.floor(width / 2);
        col++
      ) {
        hexes.push({ col, row });
      }
    }
    hexesRef.current = hexes;

    const instancedMesh = new THREE.InstancedMesh(
      hexagonGeometry,
      material,
      hexes.length
    );
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    meshRef.current = instancedMesh;

    const borderShape = createHexagonShape(HEX_SIZE * 1.04);
    const borderGeometry = new THREE.ShapeGeometry(borderShape);
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      flatShading: true,
      roughness: 1.0,
      metalness: 0.0,
    });
    const borderMesh = new THREE.InstancedMesh(
      borderGeometry,
      borderMaterial,
      hexes.length
    );
    borderMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    hexes.forEach((hex, index) => {
      const position = getWorldPositionForHex(hex);

      dummy.position.set(position.x, 0.05, position.z);
      dummy.rotation.x = -Math.PI / 2;
      const rotationSeed =
        Math.sin(hex.col * 12.9898 + hex.row * 78.233) * 43758.5453;
      const rotationIndex = Math.floor(
        (rotationSeed - Math.floor(rotationSeed)) * 6
      );
      dummy.rotation.z = (rotationIndex * Math.PI) / 3;
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);

      const bi = biomeIndex(hex);
      instancedMesh.setColorAt(index, BIOME_COLORS[bi]);

      dummy.position.set(position.x, 0.0, position.z);
      dummy.updateMatrix();
      borderMesh.setMatrixAt(index, dummy.matrix);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor)
      instancedMesh.instanceColor.needsUpdate = true;
    borderMesh.instanceMatrix.needsUpdate = true;

    scene.add(borderMesh);
    scene.add(instancedMesh);

    // Smooth camera tracking
    const CAMERA_LERP_SPEED = 0.08; // Smooth but responsive
    const targetCameraPos = new THREE.Vector3();
    const targetControlsTarget = new THREE.Vector3();

    // Store initial camera offset relative to player
    const initialPlayerWorldPos = getWorldPositionForHex(playerPosition);
    const initialOffset = camera.position.clone().sub(new THREE.Vector3(initialPlayerWorldPos.x, 0, initialPlayerWorldPos.z));

    // Animation loop — updates camera tracking and controls
    const animate = () => {
      requestAnimationFrame(animate);

      // Only apply smooth camera tracking when user is NOT interacting
      if (!userIsInteractingRef.current) {
        // Smooth camera tracking: follow player position using ref
        const currentPlayerWorldPos = getWorldPositionForHex(playerPositionRef.current);

        // Calculate target camera position (maintain initial offset)
        targetCameraPos.set(
          currentPlayerWorldPos.x + initialOffset.x,
          initialOffset.y,
          currentPlayerWorldPos.z + initialOffset.z
        );

        // Calculate target controls target (player position at y=0)
        targetControlsTarget.set(
          currentPlayerWorldPos.x,
          0,
          currentPlayerWorldPos.z
        );

        // Smooth lerp camera and controls
        camera.position.lerp(targetCameraPos, CAMERA_LERP_SPEED);
        controls.target.lerp(targetControlsTarget, CAMERA_LERP_SPEED);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      hexagonGeometry.dispose();
      material.dispose();
      borderGeometry.dispose();
      borderMaterial.dispose();
      controls.dispose();
    };
  }, [width, height]);

  // Re-color when player moves or disabled changes
  useEffect(() => {
    if (disabled) {
      hoveredRef.current = -1;
    }

    // Clear mobile pending state on position change or disable
    pendingMobileHexRef.current = null;
    if (mobileToastIdRef.current) {
      toast.dismiss(mobileToastIdRef.current);
      mobileToastIdRef.current = null;
    }
    if (mobileToastTimeoutRef.current) {
      clearTimeout(mobileToastTimeoutRef.current);
      mobileToastTimeoutRef.current = null;
    }

    updateColors(hoveredRef.current);
  }, [playerPosition, disabled, occupiedNeighborsMask, updateColors]);

  // Mouse/touch interaction
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const camera = cameraRef.current;
      const mesh = meshRef.current;
      if (!camera || !mesh) return;

      raycaster.current.setFromCamera(pointer.current, camera);
      const intersects = raycaster.current.intersectObject(mesh);

      let newHover = -1;
      if (!disabled && intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const idx = intersects[0].instanceId;
        const hex = hexesRef.current[idx];
        if (hex && isNeighbor(hex, playerPosition)) {
          newHover = idx;
          container.style.cursor = "pointer";
        } else {
          container.style.cursor = "default";
        }
      } else {
        container.style.cursor = "default";
      }

      if (newHover !== hoveredRef.current) {
        hoveredRef.current = newHover;
        updateColors(newHover);

        // Tooltip suppressed — double-click/tap flow handles move confirmation via toast

      }
    };

    // Track pointer start position to distinguish taps from drags
    const onPointerDown = (e: PointerEvent) => {
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    // Double-tap/click handler for move confirmation
    const onPointerUp = (e: PointerEvent) => {
      if (disabledRef.current) return;

      // Distinguish tap from drag/pan — ignore if pointer moved > 10px
      const down = pointerDownPosRef.current;
      if (down) {
        const dist = Math.sqrt((e.clientX - down.x) ** 2 + (e.clientY - down.y) ** 2);
        if (dist > 10) return;
      }

      const rect = container.getBoundingClientRect();
      pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const cam = cameraRef.current;
      const mesh = meshRef.current;
      if (!cam || !mesh) return;

      raycaster.current.setFromCamera(pointer.current, cam);
      const intersects = raycaster.current.intersectObject(mesh);

      if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
        const idx = intersects[0].instanceId;
        const hex = hexesRef.current[idx];
        if (hex && isNeighbor(hex, playerPositionRef.current)) {
          const pending = pendingMobileHexRef.current;

          if (pending && pending.col === hex.col && pending.row === hex.row) {
            // Second click on same hex → execute move
            onMoveRef.current(hex);

            // Clear pending state and highlight
            pendingMobileHexRef.current = null;
            hoveredRef.current = -1;
            updateColors(-1);

            // Dismiss toast and clear timeout
            if (mobileToastIdRef.current) {
              toast.dismiss(mobileToastIdRef.current);
              mobileToastIdRef.current = null;
            }
            if (mobileToastTimeoutRef.current) {
              clearTimeout(mobileToastTimeoutRef.current);
              mobileToastTimeoutRef.current = null;
            }
          } else {
            // First click (or different hex) → set as pending, highlight it, show toast
            pendingMobileHexRef.current = hex;
            hoveredRef.current = idx;
            updateColors(idx);

            // Dismiss previous toast
            if (mobileToastIdRef.current) {
              toast.dismiss(mobileToastIdRef.current);
            }
            if (mobileToastTimeoutRef.current) {
              clearTimeout(mobileToastTimeoutRef.current);
            }

            const mask = occupiedNeighborsMaskRef.current;
            const dir = calculateDirection(playerPositionRef.current, hex);
            const isOccupied = dir !== null && mask > 0 && ((mask >> dir) & 1) === 1;
            const message = isOccupied
              ? `⚔ Click again to attack (${hex.col}, ${hex.row})`
              : `Click again to move to (${hex.col}, ${hex.row})`;
            const borderColor = isOccupied ? "#e05555" : "#44cc44";

            const toastId = toast.custom(
              (t) => (
                <div
                  style={{
                    opacity: t.visible ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    background: "rgba(10, 10, 30, 0.95)",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: "12px 16px",
                    color: "#e0e0e0",
                    fontFamily: "monospace",
                    fontSize: 14,
                    maxWidth: 280,
                  }}
                >
                  <div style={{ fontWeight: 600, color: borderColor }}>
                    {message}
                  </div>
                </div>
              ),
              { duration: 3000, position: "top-center" }
            );
            mobileToastIdRef.current = toastId;

            // Auto-clear pending hex after timeout
            mobileToastTimeoutRef.current = setTimeout(() => {
              pendingMobileHexRef.current = null;
              mobileToastIdRef.current = null;
              mobileToastTimeoutRef.current = null;
            }, 3000);
          }
        }
      }
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", onPointerUp);
      // Clean up mobile toast timeout on unmount
      if (mobileToastTimeoutRef.current) {
        clearTimeout(mobileToastTimeoutRef.current);
      }
    };
  }, [playerPosition, disabled, updateColors]);


  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100vh",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {disabled && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(10, 25, 15, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              background: "rgba(10, 25, 15, 0.85)",
              border: "2px solid rgba(68, 204, 68, 0.6)",
              borderRadius: 8,
              padding: "12px 24px",
              fontFamily: "monospace",
              fontSize: 14,
              color: "#44cc44",
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            Resolving move...
          </div>
        </div>
      )}
    </div>
  );
}
