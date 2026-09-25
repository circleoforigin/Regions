import {
  useCallback,
  useState,
} from 'react';

import type {
  PathShapePoint,
  PathTerminalReference,
  StandalonePathTerminal,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export interface PathDraft {
  start: PathTerminalReference;
  shapePoints: PathShapePoint[];
}

export function usePathAuthoring() {
  const [
    draft,
    setDraft,
  ] = useState<PathDraft | null>(null);

  const beginFromStandalone = useCallback(
    (
      terminalId: string
    ) => {
      setDraft({
        start: {
          kind: 'standalone',
          terminalId,
        },
        shapePoints: [],
      });
    },
    []
  );

  const beginFromFeature = useCallback(
    (
      featureId: string
    ) => {
      setDraft({
        start: {
          kind: 'feature',
          featureId,
        },
        shapePoints: [],
      });
    },
    []
  );

  const addShapePoint = useCallback(
    (
      position: SpatialPoint
    ) => {
      setDraft((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          shapePoints: [
            ...current.shapePoints,
            {
              id: crypto.randomUUID(),
              position,
            },
          ],
        };
      });
    },
    []
  );

  const moveShapePoint = useCallback(
    (
      pointId: string,
      position: SpatialPoint
    ) => {
      setDraft((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          shapePoints:
            current.shapePoints.map(
              (point) =>
                point.id === pointId
                  ? {
                      ...point,
                      position,
                    }
                  : point
            ),
        };
      });
    },
    []
  );

  const removeShapePoint = useCallback(
    (
      pointId: string
    ) => {
      setDraft((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          shapePoints:
            current.shapePoints.filter(
              (point) =>
                point.id !== pointId
            ),
        };
      });
    },
    []
  );

  const cancel = useCallback(() => {
    setDraft(null);
  }, []);

  return {
    draft,

    beginFromStandalone,
    beginFromFeature,

    addShapePoint,
    moveShapePoint,
    removeShapePoint,

    cancel,
  };
}

export type PathAuthoringController =
  ReturnType<typeof usePathAuthoring>;