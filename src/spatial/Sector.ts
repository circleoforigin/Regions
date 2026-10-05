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

export const OVERWORLD_SECTOR_RESOLUTION: SectorResolution = {
  size: 10,
  unit: 'miles',
};

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

export interface SectorCrossing
{
  position: WorldPosition;
  fraction: number;
}

export function findSectorCrossings(
  start: WorldPosition,
  end: WorldPosition,
  distanceScale: {
    distance: number;
    pixels: number;
    unit: MapDistanceUnit;
  },
  resolution: SectorResolution
): SectorCrossing[]
{
  if (start.mapId !== end.mapId)
  {
    return [];
  }

  const sectorSize = getSectorSizeInMapUnits(
    distanceScale,
    resolution
  );

  if (!sectorSize)
  {
    return [];
  }

  const fractions = new Set<number>();

  const addCrossings = (
    startValue: number,
    endValue: number
  ) =>
  {
    const delta = endValue - startValue;

    if (Math.abs(delta) <= 0.000001)
    {
      return;
    }

    const minimum = Math.min(startValue, endValue);
    const maximum = Math.max(startValue, endValue);

    const firstBoundary =
      Math.floor(minimum / sectorSize) + 1;

    const lastBoundary =
      Math.floor(maximum / sectorSize);

    for (
      let boundaryIndex = firstBoundary;
      boundaryIndex <= lastBoundary;
      boundaryIndex += 1
    )
    {
      const boundary =
        boundaryIndex * sectorSize;

      const fraction =
        (boundary - startValue) / delta;

      if (
        fraction > 0.000001 &&
        fraction < 0.999999
      )
      {
        fractions.add(fraction);
      }
    }
  };

  addCrossings(start.x, end.x);
  addCrossings(start.y, end.y);

  return [...fractions]
    .sort((a, b) => a - b)
    .map((fraction) => ({
      position: {
        mapId: start.mapId,
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      },
      fraction,
    }));
}