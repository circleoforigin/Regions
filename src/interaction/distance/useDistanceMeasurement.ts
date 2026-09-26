import {
  useCallback,
  useState,
} from 'react';

import type {
  SpatialPoint,
} from '../../spatial/SpatialAnchor';

import type {
  DistanceAnchor,
} from './DistanceMeasurement';

export function useDistanceMeasurement() {
  const [anchors, setAnchors] =
    useState<DistanceAnchor[]>([]);

  const addPoint = useCallback(
  (position: SpatialPoint) => {
    const pointId = crypto.randomUUID();

    setAnchors((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: 'temporary',
        pointId,
        position,
      },
    ]);
  },
  []
);

const addExistingPoint = useCallback(
  (
    pointId: string,
    position: SpatialPoint
  ) => {
    setAnchors((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        kind: 'temporary',
        pointId,
        position,
      },
    ]);
  },
  []
);

  const addFeature = useCallback(
    (featureId: string) => {
      setAnchors((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: 'feature',
          featureId,
        },
      ]);
    },
    []
  );

  const addPiece = useCallback(
    (pieceId: string) => {
      setAnchors((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: 'piece',
          pieceId,
        },
      ]);
    },
    []
  );

    const addPath = useCallback(
    (
      segmentId: string,
      position: SpatialPoint,
      usePathFromPrevious: boolean
    ) => {
      setAnchors((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: 'path',
          segmentId,
          position,
          usePathFromPrevious,
        },
      ]);
    },
    []
  );

    const removeFeature = useCallback(
    (featureId: string) => {
      setAnchors((current) => {
        const index =
          current.findLastIndex(
            (anchor) =>
              anchor.kind ===
                'feature' &&
              anchor.featureId ===
                featureId
          );

        if (index < 0) {
          return current;
        }

        return current.filter(
          (_, anchorIndex) =>
            anchorIndex !== index
        );
      });
    },
    []
  );

  const removeAnchor = useCallback(
    (anchorId: string) => {
      setAnchors((current) =>
        current.filter(
          (anchor) => anchor.id !== anchorId
        )
      );
    },
    []
  );

  const clear = useCallback(() => {
    setAnchors([]);
  }, []);

  return {
    anchors,
    addPoint,
    addExistingPoint,
    addFeature,
    addPiece,
    addPath,
    removeAnchor,
    clear,
  };
}

export type DistanceMeasurementController =
  ReturnType<typeof useDistanceMeasurement>;