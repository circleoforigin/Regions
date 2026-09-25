import type {
  PathSegment,
  PathShapePoint,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import type {
  ResolvedPathSegment,
} from './PathMapState';

function distanceSquared(
  a: SpatialPoint,
  b: SpatialPoint
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  return dx * dx + dy * dy;
}

export function distanceToLineSegment(
  point: SpatialPoint,
  start: SpatialPoint,
  end: SpatialPoint
): number {
  const lengthSquared =
    distanceSquared(start, end);

  if (lengthSquared === 0) {
    return Math.sqrt(
      distanceSquared(point, start)
    );
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      (
        (point.x - start.x) *
          (end.x - start.x) +
        (point.y - start.y) *
          (end.y - start.y)
      ) / lengthSquared
    )
  );

  const closest = {
    x:
      start.x +
      t * (end.x - start.x),

    y:
      start.y +
      t * (end.y - start.y),
  };

  return Math.sqrt(
    distanceSquared(point, closest)
  );
}

export interface PathProjection {
  position: SpatialPoint;
  legIndex: number;
}

export function projectPointOntoPath(
  resolved: ResolvedPathSegment,
  position: SpatialPoint
): PathProjection {
  const points = [
    resolved.start.position,

    ...resolved.segment.shapePoints.map(
      (point) => point.position
    ),

    resolved.end.position,
  ];

  let bestPosition = points[0];
  let bestLegIndex = 0;
  let bestDistanceSquared = Infinity;

  for (
    let index = 0;
    index < points.length - 1;
    index += 1
  ) {
    const start = points[index];
    const end = points[index + 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const lengthSquared =
      dx * dx + dy * dy;

    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              (
                (position.x - start.x) * dx +
                (position.y - start.y) * dy
              ) / lengthSquared
            )
          );

    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };

    const projectedDistanceSquared =
      distanceSquared(
        position,
        projected
      );

    if (
      projectedDistanceSquared <
      bestDistanceSquared
    ) {
      bestDistanceSquared =
        projectedDistanceSquared;

      bestPosition =
        projected;

      bestLegIndex =
        index;
    }
  }

  return {
    position: bestPosition,
    legIndex: bestLegIndex,
  };
}

export function findPathLegIndex(
  resolved: ResolvedPathSegment,
  position: SpatialPoint
): number {
  const points = [
    resolved.start.position,

    ...resolved.segment.shapePoints.map(
      (point) => point.position
    ),

    resolved.end.position,
  ];

  let closestLeg = 0;
  let closestDistance = Infinity;

  for (
    let index = 0;
    index < points.length - 1;
    index += 1
  ) {
    const distance =
      distanceToLineSegment(
        position,
        points[index],
        points[index + 1]
      );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestLeg = index;
    }
  }

  return closestLeg;
}

export function insertPathShapePoint(
  segment: PathSegment,
  resolved: ResolvedPathSegment,
  position: SpatialPoint
): PathSegment {
  const shapePoint: PathShapePoint = {
    id: crypto.randomUUID(),
    position,
  };

  const insertionIndex =
    findPathLegIndex(
      resolved,
      position
    );

  const shapePoints = [
    ...segment.shapePoints,
  ];

  shapePoints.splice(
    insertionIndex,
    0,
    shapePoint
  );

  return {
    ...segment,
    shapePoints,
    updatedAt: new Date(),
  };
}