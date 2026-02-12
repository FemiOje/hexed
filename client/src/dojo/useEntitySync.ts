/**
 * Entity Synchronization Hooks
 *
 * Real-time entity subscriptions using Dojo SDK
 * Following death-mountain pattern for entity sync
 */

import { useEffect, useCallback, useRef } from "react";
import { useDojoSDK } from "@dojoengine/sdk/react";
import { useGameStore } from "@/stores/gameStore";
import { useController } from "@/contexts/controller";
import { Position, Moves, Direction } from "@/types/game";
import { debugLog } from "@/utils/helpers";
import { isValidPositionObject } from "@/utils/position";

/**
 * Hook to subscribe to player position updates
 * Automatically syncs position changes from blockchain to game store
 */
export const usePlayerPositionSync = () => {
  const { address } = useController();
  const { useDojoStore } = useDojoSDK();
  const entities = useDojoStore((state) => state.entities);
  const { setPosition, setIsSpawned, setIsSyncing } = useGameStore();
  const lastSyncRef = useRef<number>(0);

  // Subscribe to Position entity for this player
  // useEntityQuery(
  //   new ToriiQueryBuilder()
  //     .withClause(
  //       KeysClause(
  //         ["untitled-Position"],
  //         [`${address || "0x0"}`],
  //         "FixedLen"
  //       ).build()
  //     )
  //     .includeHashedKeys()
  // );

  // Process entity updates
  useEffect(() => {
    if (!address || !entities) return;

    const processPositionUpdate = async () => {
      try {
        setIsSyncing(true);

        // Find position entity for this player
        const entityArray = Object.values(entities);
        const positionEntity = entityArray.find((entity: any) => {
          const models = entity?.models || {};
          const positionModel = Object.values(models).find(
            (model: any) =>
              model?.player?.toLowerCase() === address.toLowerCase() &&
              model?.vec !== undefined
          );
          return positionModel !== undefined;
        });

        if (positionEntity) {
          const models = (positionEntity as any).models || {};
          const positionModel: any = Object.values(models).find(
            (model: any) => model?.vec !== undefined
          );

          if (positionModel && positionModel.vec) {
            const position: Position = {
              player: address,
              vec: {
                x: positionModel.vec.x || 0,
                y: positionModel.vec.y || 0,
              },
            };

            // Only update if position is valid and different from last sync
            if (
              isValidPositionObject(position) &&
              Date.now() - lastSyncRef.current > 100
            ) {
              debugLog("Position synced from blockchain", position);
              setPosition(position);
              setIsSpawned(true);
              lastSyncRef.current = Date.now();
            }
          }
        }
      } catch (error) {
        console.error("Error syncing position:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    processPositionUpdate();
  }, [entities, address, setPosition, setIsSpawned, setIsSyncing]);
};

/**
 * Hook to subscribe to player moves updates
 * Automatically syncs moves state from blockchain to game store
 */
export const usePlayerMovesSync = () => {
  const { address } = useController();
  const { useDojoStore } = useDojoSDK();
  const entities = useDojoStore((state) => state.entities);
  const { setMoves, setIsSyncing } = useGameStore();
  const lastSyncRef = useRef<number>(0);

  // Subscribe to Moves entity for this player
  // useEntityQuery(
  //   new ToriiQueryBuilder()
  //     .withClause(
  //       KeysClause(
  //         ["untitled-Moves"],
  //         [address || "0x0"],
  //         "FixedLen"
  //       ).build()
  //     )
  //     .includeHashedKeys()
  // );

  // Process entity updates
  useEffect(() => {
    if (!address || !entities) return;

    const processMovesUpdate = async () => {
      try {
        setIsSyncing(true);

        // Find moves entity for this player
        const entityArray = Object.values(entities);
        // console.log("🔍 Searching for Moves entity. Total entities:", entityArray.length);

        const movesEntity = entityArray.find((entity: any) => {
          const models = entity?.models || {};
          const movesModel = Object.values(models).find(
            (model: any) =>
              model?.player?.toLowerCase() === address.toLowerCase() &&
              model?.can_move !== undefined
          );
          return movesModel !== undefined;
        });

        if (movesEntity) {
          const models = (movesEntity as any).models || {};
          const movesModel: any = Object.values(models).find(
            (model: any) => model?.can_move !== undefined
          );

          if (movesModel) {
            console.log("🔍 Raw movesModel from blockchain:", movesModel);

            const moves: Moves = {
              player: address,
              last_direction:
                typeof movesModel.last_direction === "number" &&
                movesModel.last_direction > 0
                  ? (movesModel.last_direction as Direction)
                  : null,
              can_move: movesModel.can_move === true,
            };

            // Only update if different from last sync
            if (Date.now() - lastSyncRef.current > 100) {
              console.log("✅ Moves synced from blockchain:", moves);
              debugLog("Moves synced from blockchain", moves);
              setMoves(moves);
              lastSyncRef.current = Date.now();
            }
          }
        } else {
          // console.warn("⚠️ No Moves entity found for player:", address);
        }
      } catch (error) {
        console.error("Error syncing moves:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    processMovesUpdate();
  }, [entities, address, setMoves, setIsSyncing]);
};

/**
 * Hook to sync all player entities
 * Combines position and moves syncing
 */
export const usePlayerEntitySync = () => {
  usePlayerPositionSync();
  usePlayerMovesSync();
};

/**
 * Hook to manually fetch and sync player state
 * Useful for force refreshing state
 */
export const useRefreshPlayerState = () => {
  const { address } = useController();
  const { useDojoStore } = useDojoSDK();
  const entities = useDojoStore((state) => state.entities);
  const { setPosition, setMoves, setIsSpawned, setIsSyncing } = useGameStore();

  const refreshState = useCallback(async () => {
    if (!address || !entities) {
      console.warn("Cannot refresh: no address or entities");
      return;
    }

    try {
      setIsSyncing(true);
      debugLog("Force refreshing player state");

      const entityArray = Object.values(entities);
      // console.log("🔍 Total entities in store:", entityArray.length);

      // Log first few entities to see structure
      // if (entityArray.length > 0) {
      //   console.log("📦 Sample entity:", entityArray[0]);
      //   console.log("📦 All entity keys:", Object.keys(entities));
      // }

      // Find and process all relevant entities
      let positionFound = false;
      let movesFound = false;

      for (const entity of entityArray) {
        const models = (entity as any)?.models || {};

        // Log all models in this entity
        const modelKeys = Object.keys(models);
        if (modelKeys.length > 0) {
          console.log("📋 Entity models:", modelKeys);
        }

        // Check for position model
        for (const model of Object.values(models)) {
          const m = model as any;

          // Log each model to see what we're comparing
          if (m?.player) {
            console.log("🔍 Found model with player:", {
              modelPlayer: m.player,
              targetPlayer: address,
              match: m.player.toLowerCase() === address.toLowerCase(),
              hasVec: m?.vec !== undefined,
              hasCanMove: m?.can_move !== undefined,
            });
          }

          if (
            m?.player?.toLowerCase() === address.toLowerCase() &&
            m?.vec !== undefined
          ) {
            const position: Position = {
              player: address,
              vec: {
                x: m.vec.x || 0,
                y: m.vec.y || 0,
              },
            };
            console.log("✅ Position found:", position);
            setPosition(position);
            setIsSpawned(true);
            positionFound = true;
          }

          if (
            m?.player?.toLowerCase() === address.toLowerCase() &&
            m?.can_move !== undefined
          ) {
            const moves: Moves = {
              player: address,
              last_direction:
                typeof m.last_direction === "number" && m.last_direction > 0
                  ? (m.last_direction as Direction)
                  : null,
              can_move: m.can_move === true,
            };
            console.log("✅ Moves found:", moves);
            setMoves(moves);
            movesFound = true;
          }
        }
      }

      if (positionFound || movesFound) {
        debugLog("Player state refreshed successfully", {
          positionFound,
          movesFound,
        });
      } else {
        // console.error("❌ No player state found in entities");
        // debugLog("No player state found in entities");
      }
    } catch (error) {
      console.error("Error refreshing player state:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [address, entities, setPosition, setMoves, setIsSpawned, setIsSyncing]);

  return { refreshState };
};
