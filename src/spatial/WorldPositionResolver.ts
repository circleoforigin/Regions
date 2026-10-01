import type { Feature } from '../models/Feature';
import type {
  Map as RegionMap,
  MapDistanceUnit,
} from '../models/Map';
import type { SpatialPoint } from './SpatialAnchor';
import type { WorldPosition } from './WorldPosition';
import { transformBoundaryPoint } from '../sections/BoundaryTransform';
export interface WorldPositionFrame
{
  mapId: string;
  position: SpatialPoint;
}

const METERS_PER_UNIT: Record<MapDistanceUnit, number> = {
  feet: 0.3048,
  miles: 1609.344,
  meters: 1,
  kilometers: 1000,
};

function transformLocationPoint(
  position: SpatialPoint,
  child: RegionMap,
  parent: RegionMap,
  location: Feature
): SpatialPoint | null
{
  const childRegistration = child.imageRegistration;
  const parentRegistration = parent.imageRegistration;
  const childScale = childRegistration?.distanceScale;
  const parentScale = parentRegistration?.distanceScale;

  if (
    !childRegistration ||
    !childScale ||
    !parentScale ||
    childScale.distance <= 0 ||
    childScale.pixels <= 0 ||
    parentScale.distance <= 0 ||
    parentScale.pixels <= 0
  ) {
    return null;
  }

  const childUnitsPerMapUnit =
    childScale.distance / childScale.pixels;

  const parentMapUnitsPerUnit =
    parentScale.pixels / parentScale.distance;

  const unitConversion =
    METERS_PER_UNIT[childScale.unit] /
    METERS_PER_UNIT[parentScale.unit];

  const scale =
    childUnitsPerMapUnit *
    unitConversion *
    parentMapUnitsPerUnit;

  return {
    x:
      location.position.x +
      (position.x - childRegistration.offsetX) * scale,
    y:
      location.position.y +
      (position.y - childRegistration.offsetY) * scale,
  };
}

export function resolveWorldPositionFrames(
  mapId: string,
  position: SpatialPoint,
  maps: RegionMap[],
  features: Feature[]
): WorldPositionFrame[] | null
{
  const mapsById = new Map(
    maps.map((map) => [map.id, map])
  );

  const featuresById = new Map(
    features.map((feature) => [feature.id, feature])
  );

  let map = mapsById.get(mapId);
  if (!map) return null;

  let resolved: SpatialPoint = position;
  const visited = new Set<string>();

  const frames: WorldPositionFrame[] = [
    {
      mapId: map.id,
      position: resolved,
    },
  ];

  while (map.parentMapId)
  {
    if (visited.has(map.id)) return null;
    visited.add(map.id);

    if (map.simulationScale === 'special')
    {
      return null;
    }

    const parent = mapsById.get(map.parentMapId);
    if (!parent) return null;

    if (map.areaBoundaryLink)
    {
      resolved = transformBoundaryPoint(
        resolved,
        map.areaBoundaryLink.alignment,
        true
      );
    }
    else if (map.simulationScale === 'local')
    {
      if (!map.parentLocationId) return null;

      const location = featuresById.get(map.parentLocationId);

      if (
        !location ||
        location.type !== 'location' ||
        location.targetMapId !== map.id
      ) {
        return null;
      }

      const transformed = transformLocationPoint(
        resolved,
        map,
        parent,
        location
      );

      if (!transformed) return null;

      resolved = transformed;
    }
    else
    {
      return null;
    }

    map = parent;

    frames.push({
      mapId: map.id,
      position: resolved,
    });
  }

  if (map.simulationScale === 'special')
  {
    return null;
  }

  return frames;
}

export function resolveWorldPosition(
  mapId: string,
  position: SpatialPoint,
  maps: RegionMap[],
  features: Feature[]
): WorldPosition | null
{
  const frames = resolveWorldPositionFrames(
    mapId,
    position,
    maps,
    features
  );

  if (!frames || frames.length === 0)
  {
    return null;
  }

  const world = frames[frames.length - 1];

  return {
    mapId: world.mapId,
    x: world.position.x,
    y: world.position.y,
  };
}