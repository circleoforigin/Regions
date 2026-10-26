import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';
import type { Feature } from '../../models/Feature';
import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';
import {
  resolveWorldPosition,
} from '../../spatial/WorldPositionResolver';

interface Point
{
  x: number;
  y: number;
}

interface Size
{
  width: number;
  height: number;
}

interface SectorGridOverlayProps
{
  map: RegionMap;
  projectMaps: RegionMap[];
  projectFeatures: Feature[];
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;
}

export default function SectorGridOverlay({
  map,
  projectMaps,
  projectFeatures,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
}: SectorGridOverlayProps)
{
  const registeredWidth =
    imageSize.width * registration.scale;

  const registeredHeight =
    imageSize.height * registration.scale;

  const isLocationMap =
    (map.simulationScale === 'sprawl' ||
      map.simulationScale === 'local') &&
    !map.areaBoundaryLink &&
    Boolean(map.parentLocationId);

  if (
    !registration.distanceScale ||
    (
      map.simulationScale !== 'overworld' &&
      !isLocationMap
    ) ||
    registeredWidth <= 0 ||
    registeredHeight <= 0
  )
  {
    return null;
  }

  const sectorSizeInMapUnits =
    getSectorSizeInMapUnits(
      registration.distanceScale,
      OVERWORLD_SECTOR_RESOLUTION
    );

  if (
    sectorSizeInMapUnits === null ||
    !Number.isFinite(sectorSizeInMapUnits) ||
    sectorSizeInMapUnits <= 0
  )
  {
    return null;
  }

  const sectorGridSize = sectorSizeInMapUnits * scale;

  if (
    !Number.isFinite(sectorGridSize) ||
    sectorGridSize <= 0
  )
  {
    return null;
  }

  const worldPosition =
    isLocationMap
      ? resolveWorldPosition(
          map.id,
          {
            x: registration.offsetX,
            y: registration.offsetY,
          },
          projectMaps,
          projectFeatures
        )
      : null;

  const rootMap = worldPosition
    ? projectMaps.find(
        (candidate) =>
          candidate.id === worldPosition.mapId
      )
    : null;

  const rootSectorSize =
    rootMap?.imageRegistration?.distanceScale
      ? getSectorSizeInMapUnits(
          rootMap.imageRegistration.distanceScale,
          OVERWORLD_SECTOR_RESOLUTION
        )
      : null;

  const origin =
    map.simulationScale === 'overworld'
      ? { x: 0, y: 0 }
      : worldPosition &&
          rootSectorSize !== null &&
          rootSectorSize > 0
        ? {
            x:
              registration.offsetX -
              (
                worldPosition.x /
                rootSectorSize
              ) * sectorSizeInMapUnits,
            y:
              registration.offsetY -
              (
                worldPosition.y /
                rootSectorSize
              ) * sectorSizeInMapUnits,
          }
        : null;

  if (!origin)
  {
    return null;
  }

  const mapToScreen = (
    x: number,
    y: number
  ): Point =>
  {
    return {
      x:
        viewportSize.width / 2 +
        pan.x +
        x * scale,
      y:
        viewportSize.height / 2 +
        pan.y +
        y * scale,
    };
  };

  const isAreaScale =
    map.simulationScale === 'sprawl';

  const subdivisionSize =
    sectorGridSize / 5;

  return (
    <svg
      className="sector-grid-overlay"
      width={viewportSize.width}
      height={viewportSize.height}
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="sector-grid-pattern"
          patternUnits="userSpaceOnUse"
          x={mapToScreen(origin.x, 0).x}
          y={mapToScreen(0, origin.y).y}
          width={sectorGridSize}
          height={sectorGridSize}
        >
          {isAreaScale &&
            [1, 2, 3, 4].map((index) =>
            {
              const offset =
                subdivisionSize * index;

              return (
                <path
                  key={index}
                  d={
                    `M ${offset} 0 V ${sectorGridSize} ` +
                    `M 0 ${offset} H ${sectorGridSize}`
                  }
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.55)"
                  strokeWidth={1}
                />
              );
            })}

          <path
            d={
              `M 0 0 V ${sectorGridSize} ` +
              `M 0 0 H ${sectorGridSize}`
            }
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={isAreaScale ? 5 : 1}
          />
        </pattern>
      </defs>

      <rect
        x={
          mapToScreen(
            registration.offsetX -
              registeredWidth / 2,
            0
          ).x
        }
        y={
          mapToScreen(
            0,
            registration.offsetY -
              registeredHeight / 2
          ).y
        }
        width={registeredWidth * scale}
        height={registeredHeight * scale}
        fill="url(#sector-grid-pattern)"
      />
    </svg>
  );
}