import type {
  PathSegment,
  PathShapePoint,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import type {
  PiecePathDock,
} from '../models/Piece';

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

export interface PathDockProjection
  extends PathProjection {
  fraction: number;
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

export function projectPointOntoPathDock(
  resolved: ResolvedPathSegment,
  position: SpatialPoint
): PathDockProjection {
  const points = [
    resolved.start.position,

    ...resolved.segment.shapePoints.map(
      (point) => point.position
    ),

    resolved.end.position,
  ];

  let bestPosition = points[0];
  let bestLegIndex = 0;
  let bestFraction = 0;
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

    const fraction =
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
      x: start.x + dx * fraction,
      y: start.y + dy * fraction,
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

      bestPosition = projected;
      bestLegIndex = index;
      bestFraction = fraction;
    }
  }

  return {
    position: bestPosition,
    legIndex: bestLegIndex,
    fraction: bestFraction,
  };
}

export function resolvePathDockPosition(
  dock: PiecePathDock,
  resolved: ResolvedPathSegment
): SpatialPoint | null {
  if (
    dock.segmentId !==
    resolved.segment.id
  ) {
    return null;
  }

  const points = [
    resolved.start.position,

    ...resolved.segment.shapePoints.map(
      (point) => point.position
    ),

    resolved.end.position,
  ];

  const start =
    points[dock.legIndex];

  const end =
    points[dock.legIndex + 1];

  if (!start || !end) {
    return null;
  }

  const fraction = Math.max(
    0,
    Math.min(
      1,
      dock.fraction
    )
  );

  return {
    x:
      start.x +
      (end.x - start.x) *
        fraction,

    y:
      start.y +
      (end.y - start.y) *
        fraction,
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

export interface PathCrossing {
  segmentId: string;
  position: SpatialPoint;
  fraction: number;
  terminal?: ResolvedPathSegment['start'];
}

const PATH_CROSSING_TERMINAL_SNAP_DISTANCE = 2;

export function findPathCrossings(
  start: SpatialPoint,
  end: SpatialPoint,
  segments: ResolvedPathSegment[]
): PathCrossing[]
{
  const crossings: PathCrossing[] = [];

  for (const resolved of segments)
  {
    const points = [
      resolved.start.position,

      ...resolved.segment.shapePoints.map(
        (point) => point.position
      ),

      resolved.end.position,
    ];

    for (
      let index = 0;
      index < points.length - 1;
      index += 1
    )
    {
      const crossing =
        findLineSegmentIntersection(
          start,
          end,
          points[index],
          points[index + 1]
        );

      if (!crossing)
      {
        continue;
      }

      const terminal =
        [
          resolved.start,
          resolved.end,
        ].find(
          (candidate) =>
            Math.hypot(
              candidate.position.x -
                crossing.position.x,
              candidate.position.y -
                crossing.position.y
            ) <=
              PATH_CROSSING_TERMINAL_SNAP_DISTANCE
        );

      const position =
        terminal?.position ??
        crossing.position;

      const duplicate =
        crossings.some(
          (candidate) =>
            Math.hypot(
              candidate.position.x -
                position.x,
              candidate.position.y -
                position.y
            ) < 0.000001
        );

      if (duplicate)
      {
        continue;
      }

      crossings.push({
        segmentId:
          resolved.segment.id,
        position,
        fraction:
          getLineFraction(
            start,
            end,
            position
          ),
        ...(terminal
          ? { terminal }
          : {}),
      });
    }
  }

  return crossings
    .filter(
      (crossing) =>
        crossing.fraction >
          0.000001 &&
        crossing.fraction <
          0.999999
    )
    .sort(
      (left, right) =>
        left.fraction -
        right.fraction
    );
}

function findLineSegmentIntersection(
  routeStart: SpatialPoint,
  routeEnd: SpatialPoint,
  pathStart: SpatialPoint,
  pathEnd: SpatialPoint
): {
  position: SpatialPoint;
} | null
{
  const routeDx =
    routeEnd.x - routeStart.x;

  const routeDy =
    routeEnd.y - routeStart.y;

  const pathDx =
    pathEnd.x - pathStart.x;

  const pathDy =
    pathEnd.y - pathStart.y;

  const denominator =
    routeDx * pathDy -
    routeDy * pathDx;

  if (Math.abs(denominator) < 0.000001)
  {
    return null;
  }

  const offsetX =
    pathStart.x - routeStart.x;

  const offsetY =
    pathStart.y - routeStart.y;

  const routeFraction =
    (
      offsetX * pathDy -
      offsetY * pathDx
    ) / denominator;

  const pathFraction =
    (
      offsetX * routeDy -
      offsetY * routeDx
    ) / denominator;

  if (
    routeFraction < 0 ||
    routeFraction > 1 ||
    pathFraction < 0 ||
    pathFraction > 1
  )
  {
    return null;
  }

  return {
    position: {
      x:
        routeStart.x +
        routeDx * routeFraction,
      y:
        routeStart.y +
        routeDy * routeFraction,
    },
  };
}

function getLineFraction(
  start: SpatialPoint,
  end: SpatialPoint,
  position: SpatialPoint
): number
{
  const dx =
    end.x - start.x;

  const dy =
    end.y - start.y;

  const lengthSquared =
    dx * dx + dy * dy;

  if (lengthSquared <= 0)
  {
    return 0;
  }

  return (
    (
      position.x - start.x
    ) * dx +
    (
      position.y - start.y
    ) * dy
  ) / lengthSquared;
}