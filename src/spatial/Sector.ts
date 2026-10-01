import type { MapDistanceUnit } from '../models/Map';
import type { WorldPosition } from './WorldPosition';

export interface SectorAddress
{
  worldMapId: string;
  x: number;
  y: number;
}

export interface SectorResolution
{
  size: number;
  unit: MapDistanceUnit;
}

const METERS_PER_UNIT: Record<MapDistanceUnit, number> = {
  feet: 0.3048,
  miles: 1609.344,
  meters: 1,
  kilometers: 1000,
};

export function getSectorSizeInMapUnits(
  distanceScale: {
    distance: number;
    pixels: number;
    unit: MapDistanceUnit;
  },
  resolution: SectorResolution
): number | null
{
  if (
    !Number.isFinite(distanceScale.distance) ||
    !Number.isFinite(distanceScale.pixels) ||
    distanceScale.distance <= 0 ||
    distanceScale.pixels <= 0 ||
    !Number.isFinite(resolution.size) ||
    resolution.size <= 0
  ) {
    return null;
  }

  return (
    resolution.size *
    (
      METERS_PER_UNIT[resolution.unit] /
      METERS_PER_UNIT[distanceScale.unit]
    ) *
    (
      distanceScale.pixels /
      distanceScale.distance
    )
  );
}

export function getSectorAddress(
  position: WorldPosition,
  distanceScale: {
    distance: number;
    pixels: number;
    unit: MapDistanceUnit;
  },
  resolution: SectorResolution
): SectorAddress | null
{
  const sectorSizeInMapUnits = getSectorSizeInMapUnits(
    distanceScale,
    resolution
    );

    if (!sectorSizeInMapUnits)
    {
        return null;
    }

  return {
    worldMapId: position.mapId,
    x: Math.floor(
      position.x / sectorSizeInMapUnits
    ),
    y: Math.floor(
      position.y / sectorSizeInMapUnits
    ),
  };
}