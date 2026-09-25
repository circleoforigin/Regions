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
      setAnchors((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          kind: 'temporary',
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
    addFeature,
    addPiece,
    removeAnchor,
    clear,
  };
}

export type DistanceMeasurementController =
  ReturnType<typeof useDistanceMeasurement>;