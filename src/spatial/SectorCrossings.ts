import type { SpatialPoint } from './SpatialAnchor';
import type { SectorAddress } from './Sector';

export interface SectorCrossing
{
  position: SpatialPoint;
  from: SectorAddress;
  to: SectorAddress;
  segmentIndex: number;
  fraction: number;
}

function getSectorCoordinate(
  value: number,
  sectorSize: number
): number
{
  return Math.floor(value / sectorSize);
}

function getBoundaryFractions(
  start: number,
  end: number,
  sectorSize: number
): number[]
{
  const delta = end - start;

  if (Math.abs(delta) <= 0.000001)
  {
    return [];
  }

  const firstSector = getSectorCoordinate(
    start,
    sectorSize
  );

  const lastSector = getSectorCoordinate(
    end,
    sectorSize
  );

  if (firstSector === lastSector)
  {
    return [];
  }

  const fractions: number[] = [];
  const direction = delta > 0 ? 1 : -1;

  let sector = firstSector;

  while (sector !== lastSector)
  {
    const boundary =
      direction > 0
        ? (sector + 1) * sectorSize
        : sector * sectorSize;

    const fraction =
      (boundary - start) / delta;

    if (
      fraction > 0.000001 &&
      fraction <= 1
    ) {
      fractions.push(fraction);
    }

    sector += direction;
  }

  return fractions;
}

export function findSectorCrossings(
  worldMapId: string,
  points: SpatialPoint[],
  sectorSize: number
): SectorCrossing[]
{
  if (
    points.length < 2 ||
    !Number.isFinite(sectorSize) ||
    sectorSize <= 0
  ) {
    return [];
  }

  const crossings: SectorCrossing[] = [];

  for (
    let segmentIndex = 0;
    segmentIndex < points.length - 1;
    segmentIndex += 1
  ) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];

    const fractions = [
      ...getBoundaryFractions(
        start.x,
        end.x,
        sectorSize
      ),
      ...getBoundaryFractions(
        start.y,
        end.y,
        sectorSize
      ),
    ]
      .sort((a, b) => a - b)
      .filter(
        (fraction, index, values) =>
          index === 0 ||
          Math.abs(
            fraction - values[index - 1]
          ) > 0.000001
      );

    for (const fraction of fractions)
    {
      const position = {
        x:
          start.x +
          (end.x - start.x) * fraction,
        y:
          start.y +
          (end.y - start.y) * fraction,
      };

      const epsilon = 0.000001;

      const before = {
        x:
          start.x +
          (end.x - start.x) *
            Math.max(0, fraction - epsilon),
        y:
          start.y +
          (end.y - start.y) *
            Math.max(0, fraction - epsilon),
      };

      const after = {
        x:
          start.x +
          (end.x - start.x) *
            Math.min(1, fraction + epsilon),
        y:
          start.y +
          (end.y - start.y) *
            Math.min(1, fraction + epsilon),
      };

      const from: SectorAddress = {
        worldMapId,
        x: getSectorCoordinate(
          before.x,
          sectorSize
        ),
        y: getSectorCoordinate(
          before.y,
          sectorSize
        ),
      };

      const to: SectorAddress = {
        worldMapId,
        x: getSectorCoordinate(
          after.x,
          sectorSize
        ),
        y: getSectorCoordinate(
          after.y,
          sectorSize
        ),
      };

      if (
        from.x === to.x &&
        from.y === to.y
      ) {
        continue;
      }

      crossings.push({
        position,
        from,
        to,
        segmentIndex,
        fraction,
      });
    }
  }

  return crossings;
}