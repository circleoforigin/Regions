import type {
  MapDistanceUnit,
} from '../../models/Map';

import type {
  SpatialPoint,
} from '../../spatial/SpatialAnchor';

export type DistanceAnchor =
  | {
      id: string;
      kind: 'temporary';
      position: SpatialPoint;
    }
  | {
      id: string;
      kind: 'feature';
      featureId: string;
    }
  | {
      id: string;
      kind: 'piece';
      pieceId: string;
    };

export interface ResolvedDistanceAnchor {
  anchor: DistanceAnchor;
  position: SpatialPoint;
}

export interface DistanceSegment {
  start: ResolvedDistanceAnchor;
  end: ResolvedDistanceAnchor;
  mapDistance: number;
}

export function getMapDistance(
  start: SpatialPoint,
  end: SpatialPoint
): number {
  return Math.hypot(
    end.x - start.x,
    end.y - start.y
  );
}

export function getDistanceSegments(
  anchors: ResolvedDistanceAnchor[]
): DistanceSegment[] {
  const segments: DistanceSegment[] = [];

  for (
    let index = 1;
    index < anchors.length;
    index += 1
  ) {
    const start = anchors[index - 1];
    const end = anchors[index];

    segments.push({
      start,
      end,
      mapDistance: getMapDistance(
        start.position,
        end.position
      ),
    });
  }

  return segments;
}

export function getTotalMapDistance(
  anchors: ResolvedDistanceAnchor[]
): number {
  return getDistanceSegments(anchors).reduce(
    (total, segment) =>
      total + segment.mapDistance,
    0
  );
}

export interface PhysicalDistance {
  value: number;
  unit: MapDistanceUnit;
}

export interface DistanceScale {
  distance: number;
  pixels: number;
  unit: MapDistanceUnit;
}

export function convertMapDistance(
  mapDistance: number,
  scale: DistanceScale | undefined
): PhysicalDistance | null {
  if (
    !scale ||
    !Number.isFinite(scale.distance) ||
    !Number.isFinite(scale.pixels) ||
    scale.distance <= 0 ||
    scale.pixels <= 0
  ) {
    return null;
  }

  return {
    value:
      mapDistance *
      (scale.distance / scale.pixels),
    unit: scale.unit,
  };
}

export function getTotalPhysicalDistance(
  anchors: ResolvedDistanceAnchor[],
  scale: DistanceScale | undefined
): PhysicalDistance | null {
  return convertMapDistance(
    getTotalMapDistance(anchors),
    scale
  );
}