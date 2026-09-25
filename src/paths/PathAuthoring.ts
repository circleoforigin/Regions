import type {
  PathSegment,
  PathShapePoint,
  PathTerminalReference,
  StandalonePathTerminal,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export function createStandalonePathTerminal(
  mapId: string,
  position: SpatialPoint
): StandalonePathTerminal {
  return {
    id: crypto.randomUUID(),
    mapId,
    position,
  };
}

export function createPathSegment(
  mapId: string,
  start: PathTerminalReference,
  end: PathTerminalReference,
  shapePoints: PathShapePoint[]
): PathSegment {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    mapId,

    start,
    end,

    shapePoints: shapePoints.map(
      (point) => ({
        ...point,
        position: {
          ...point.position,
        },
      })
    ),

    createdAt: now,
    updatedAt: now,
  };
}