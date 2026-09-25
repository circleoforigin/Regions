import {
  useCallback,
  useState,
} from 'react';

import type {
  PathShapePoint,
  PathTerminalReference,
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

  const begin = useCallback(
    (
      terminal: PathTerminalReference
    ) => {
      setDraft({
        start: terminal,
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

  const takeDraft = useCallback(() => {
    let result: PathDraft | null = null;

    setDraft((current) => {
      result = current;
      return null;
    });

    return result;
  }, []);

  const cancel = useCallback(() => {
    setDraft(null);
  }, []);

  return {
    draft,

    begin,
    addShapePoint,
    moveShapePoint,
    removeShapePoint,

    takeDraft,
    cancel,
  };
}

export type PathAuthoringController =
  ReturnType<typeof usePathAuthoring>;