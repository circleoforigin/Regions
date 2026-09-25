import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import type {
  Feature,
} from '../models/Feature';

import type {
  Map,
} from '../models/Map';

import type {
  PathTerminalReference,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import {
  createPathSegment,
  createStandalonePathTerminal,
  splitPathSegment,
} from './PathAuthoring';

import {
  insertPathShapePoint,
} from './PathGeometry';

import {
  resolvePathSegment,
} from './PathMapState';

import {
  deletePathSegment,
  deletePathShapePoint,
  movePathTerminal,
  replacePathSegmentWithSplit,
  savePathSegment,
  savePathShapePointPosition,
  savePathTerminal,
  type PathNetwork,
} from './PathNetwork';

import {
  usePathAuthoring,
} from './usePathAuthoring';

interface UsePathInteractionOptions {
  active: boolean;
  mapId: string;
  network: PathNetwork;
  features: Feature[];

  onNetworkChange: (
    network: PathNetwork
  ) => void;

  onMapChange: (
    updater: (
      map: Map
    ) => Promise<Map>
  ) => Promise<void>;
}

export function usePathInteraction({
  active,
  mapId,
  network,
  features,
  onNetworkChange,
  onMapChange,
}: UsePathInteractionOptions) {
  const authoring =
    usePathAuthoring();

  const [
    movingTerminalId,
    setMovingTerminalId,
  ] = useState<string | null>(null);

  const [
    movingShapePoint,
    setMovingShapePoint,
  ] = useState<{
    segmentId: string;
    pointId: string;
  } | null>(null);

  useEffect(() => {
    if (active) {
      return;
    }

    authoring.cancel();
    setMovingTerminalId(null);
    setMovingShapePoint(null);
  }, [
    active,
    authoring.cancel,
  ]);

  const handleTerminalIntent =
    useCallback(
      async (
        position: SpatialPoint,
        feature?: Feature
      ) => {
        if (!active) {
          return;
        }

        let terminal:
          PathTerminalReference;

        let createdStandalone:
          ReturnType<
            typeof createStandalonePathTerminal
          > | null = null;

        if (feature) {
          terminal = {
            kind: 'feature',
            featureId: feature.id,
          };
        } else {
          createdStandalone =
            createStandalonePathTerminal(
              mapId,
              position
            );

          terminal = {
            kind: 'standalone',
            terminalId:
              createdStandalone.id,
          };
        }

        if (!authoring.draft) {
          if (createdStandalone) {
            await onMapChange(
              async (map) =>
                savePathTerminal(
                  map,
                  createdStandalone!
                )
            );

            onNetworkChange({
              ...network,

              terminals: [
                ...network.terminals,
                createdStandalone,
              ],
            });
          }

          authoring.begin(
            terminal
          );

          return;
        }

        const segment =
          createPathSegment(
            mapId,
            authoring.draft.start,
            terminal,
            authoring.draft.shapePoints
          );

        await onMapChange(
          async (map) => {
            let updatedMap = map;

            if (createdStandalone) {
              updatedMap =
                await savePathTerminal(
                  updatedMap,
                  createdStandalone
                );
            }

            return savePathSegment(
              updatedMap,
              segment
            );
          }
        );

        onNetworkChange({
          terminals:
            createdStandalone
              ? [
                  ...network.terminals,
                  createdStandalone,
                ]
              : network.terminals,

          segments: [
            ...network.segments,
            segment,
          ],
        });

        authoring.cancel();
      },
      [
        active,
        authoring,
        mapId,
        network,
        onMapChange,
        onNetworkChange,
      ]
    );

  const handleShapeIntent =
    useCallback(
      (
        position: SpatialPoint
      ) => {
        if (
          !active ||
          !authoring.draft
        ) {
          return;
        }

        authoring.addShapePoint(
          position
        );
      },
      [
        active,
        authoring,
      ]
    );

  const insertShapePoint =
    useCallback(
      async (
        segmentId: string,
        position: SpatialPoint
      ) => {
        if (!active) {
          return;
        }

        const segment =
          network.segments.find(
            (candidate) =>
              candidate.id ===
              segmentId
          );

        if (!segment) {
          return;
        }

        const resolved =
          resolvePathSegment(
            segment,
            network.terminals,
            features
          );

        if (!resolved) {
          return;
        }

        const updated =
          insertPathShapePoint(
            segment,
            resolved,
            position
          );

        await onMapChange(
          async (map) =>
            savePathSegment(
              map,
              updated
            )
        );

        onNetworkChange({
          ...network,

          segments:
            network.segments.map(
              (candidate) =>
                candidate.id ===
                updated.id
                  ? updated
                  : candidate
            ),
        });
      },
      [
        active,
        features,
        network,
        onMapChange,
        onNetworkChange,
      ]
    );

  const splitSegment =
    useCallback(
      async (
        segmentId: string,
        position: SpatialPoint
      ) => {
        if (!active) {
          return;
        }

        const segment =
          network.segments.find(
            (candidate) =>
              candidate.id ===
              segmentId
          );

        if (!segment) {
          return;
        }

        const resolved =
          resolvePathSegment(
            segment,
            network.terminals,
            features
          );

        if (!resolved) {
          return;
        }

        const split =
          splitPathSegment(
            resolved,
            position
          );

        await onMapChange(
          async (map) =>
            replacePathSegmentWithSplit(
              map,
              segment.id,
              split.terminal,
              split.first,
              split.second
            )
        );

        onNetworkChange({
          terminals: [
            ...network.terminals,
            split.terminal,
          ],

          segments: [
            ...network.segments.filter(
              (candidate) =>
                candidate.id !==
                segment.id
            ),

            split.first,
            split.second,
          ],
        });
      },
      [
        active,
        features,
        network,
        onMapChange,
        onNetworkChange,
      ]
    );

  const removeShapePoint =
    useCallback(
      async (
        segmentId: string,
        pointId: string
      ) => {
        if (!active) {
          return;
        }

        const segment =
          network.segments.find(
            (candidate) =>
              candidate.id ===
              segmentId
          );

        if (!segment) {
          return;
        }

        const updated =
          await deletePathShapePoint(
            segment,
            pointId
          );

        onNetworkChange({
          ...network,

          segments:
            network.segments.map(
              (candidate) =>
                candidate.id ===
                updated.id
                  ? updated
                  : candidate
            ),
        });
      },
      [
        active,
        network,
        onNetworkChange,
      ]
    );

  const removeSegment =
    useCallback(
      async (
        segmentId: string
      ) => {
        if (!active) {
          return;
        }

        await onMapChange(
          async (map) => {
            const result =
              await deletePathSegment(
                map,
                segmentId,
                network
              );

            const deletedTerminals =
              new Set(
                result.deletedTerminalIds
              );

            onNetworkChange({
              terminals:
                network.terminals.filter(
                  (terminal) =>
                    !deletedTerminals.has(
                      terminal.id
                    )
                ),

              segments:
                network.segments.filter(
                  (segment) =>
                    segment.id !==
                    segmentId
                ),
            });

            return result.map;
          }
        );
      },
      [
        active,
        network,
        onMapChange,
        onNetworkChange,
      ]
    );

  const beginTerminalMove =
    useCallback(
      (
        terminalId: string
      ) => {
        if (!active) {
          return;
        }

        setMovingTerminalId(
          terminalId
        );
      },
      [active]
    );

  const commitTerminalMove =
    useCallback(
      async (
        position: SpatialPoint
      ) => {
        if (!movingTerminalId) {
          return;
        }

        const terminal =
          network.terminals.find(
            (candidate) =>
              candidate.id ===
              movingTerminalId
          );

        setMovingTerminalId(null);

        if (!terminal) {
          return;
        }

        const updated =
          await movePathTerminal(
            terminal,
            position
          );

        onNetworkChange({
          ...network,

          terminals:
            network.terminals.map(
              (candidate) =>
                candidate.id ===
                updated.id
                  ? updated
                  : candidate
            ),
        });
      },
      [
        movingTerminalId,
        network,
        onNetworkChange,
      ]
    );

  const beginShapeMove =
    useCallback(
      (
        segmentId: string,
        pointId: string
      ) => {
        if (!active) {
          return;
        }

        setMovingShapePoint({
          segmentId,
          pointId,
        });
      },
      [active]
    );

  const commitShapeMove =
    useCallback(
      async (
        position: SpatialPoint
      ) => {
        const moving =
          movingShapePoint;

        setMovingShapePoint(null);

        if (!moving) {
          return;
        }

        const segment =
          network.segments.find(
            (candidate) =>
              candidate.id ===
              moving.segmentId
          );

        if (!segment) {
          return;
        }

        const updated =
          await savePathShapePointPosition(
            segment,
            moving.pointId,
            position
          );

        onNetworkChange({
          ...network,

          segments:
            network.segments.map(
              (candidate) =>
                candidate.id ===
                updated.id
                  ? updated
                  : candidate
            ),
        });
      },
      [
        movingShapePoint,
        network,
        onNetworkChange,
      ]
    );

  const cancelMove =
    useCallback(() => {
      setMovingTerminalId(null);
      setMovingShapePoint(null);
    }, []);

  return {
    draft:
      authoring.draft,

    movingTerminalId,
    movingShapePoint,

    handleTerminalIntent,
    handleShapeIntent,

    insertShapePoint,
    splitSegment,

    removeShapePoint,
    removeSegment,

    beginTerminalMove,
    commitTerminalMove,

    beginShapeMove,
    commitShapeMove,

    cancelMove,

    cancelDraft:
      authoring.cancel,
  };
}

export type PathInteractionController =
  ReturnType<
    typeof usePathInteraction
  >;