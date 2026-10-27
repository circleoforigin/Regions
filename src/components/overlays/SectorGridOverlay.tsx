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
  resolveWorldPointOnMap,
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
  const registeredWidth = imageSize.width * registration.scale;
  const registeredHeight = imageSize.height * registration.scale;

  const isAreaLinkedMap =
    Boolean(map.areaBoundaryLink) &&
    Boolean(map.parentMapId) &&
    (
        map.simulationScale === 'sprawl' ||
        map.simulationScale === 'local'
    );

  if (isAreaLinkedMap)
  {
  console.log('Area-linked grid entered', {
  map: map.name,
  parentMapId: map.parentMapId,
  areaBoundaryLink: map.areaBoundaryLink,
});

  const centerWorld = resolveWorldPosition(
    map.id,
    {
      x: registration.offsetX,
      y: registration.offsetY,
    },
    projectMaps,
    projectFeatures
  );

  const rootMap = centerWorld
    ? projectMaps.find(
        (candidate) =>
          candidate.id === centerWorld.mapId
      )
    : null;

  const rootDistanceScale =
    rootMap?.imageRegistration?.distanceScale;

  const rootSectorSize = rootDistanceScale
    ? getSectorSizeInMapUnits(
        rootDistanceScale,
        OVERWORLD_SECTOR_RESOLUTION
      )
    : null;

  if (
    !centerWorld ||
    !rootMap ||
    !rootSectorSize ||
    !Number.isFinite(rootSectorSize) ||
    rootSectorSize <= 0 ||
    registeredWidth <= 0 ||
    registeredHeight <= 0
  )
  {
    return null;
  }

  const halfWidth = registeredWidth / 2;
  const halfHeight = registeredHeight / 2;

  const imageCorners = [
    {
      x: registration.offsetX - halfWidth,
      y: registration.offsetY - halfHeight,
    },
    {
      x: registration.offsetX + halfWidth,
      y: registration.offsetY - halfHeight,
    },
    {
      x: registration.offsetX + halfWidth,
      y: registration.offsetY + halfHeight,
    },
    {
      x: registration.offsetX - halfWidth,
      y: registration.offsetY + halfHeight,
    },
  ];

  const worldCorners = imageCorners.map(
    (corner) =>
      resolveWorldPosition(
        map.id,
        corner,
        projectMaps,
        projectFeatures
      )
  );

  if (worldCorners.some((corner) => !corner))
  {
    return null;
  }

  const worldXs = worldCorners.map(
    (corner) => corner!.x
  );

  const worldYs = worldCorners.map(
    (corner) => corner!.y
  );

  const minimumX = Math.min(...worldXs);
  const maximumX = Math.max(...worldXs);
  const minimumY = Math.min(...worldYs);
  const maximumY = Math.max(...worldYs);

  const mapToScreen = (point: Point): Point =>
  {
    return {
      x:
        viewportSize.width / 2 +
        pan.x +
        point.x * scale,
      y:
        viewportSize.height / 2 +
        pan.y +
        point.y * scale,
    };
  };

  const worldToScreen = (
    x: number,
    y: number
  ): Point | null =>
  {
    const local = resolveWorldPointOnMap(
      rootMap.id,
      { x, y },
      map.id,
      projectMaps,
      projectFeatures
    );

    return local
      ? mapToScreen(local)
      : null;
  };

  const gridLines: {
    start: Point;
    end: Point;
    major: boolean;
  }[] = [];

const sectorStart = worldToScreen(
  centerWorld.x,
  centerWorld.y
);

const sectorEnd = worldToScreen(
  centerWorld.x + rootSectorSize,
  centerWorld.y
);

const sectorScreenWidth =
  sectorStart && sectorEnd
    ? Math.hypot(
        sectorEnd.x - sectorStart.x,
        sectorEnd.y - sectorStart.y
      )
    : 0;

const showSubdivisions =
  map.simulationScale === 'sprawl' &&
  sectorScreenWidth >= 100;

const subdivisionCount =
  showSubdivisions ? 5 : 1;

  const gridStep =
    rootSectorSize / subdivisionCount;

  const appendLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    major: boolean
  ) =>
  {
    const start = worldToScreen(x1, y1);
    const end = worldToScreen(x2, y2);

    if (!start || !end)
    {
      return;
    }

    gridLines.push({
      start,
      end,
      major,
    });
  };

  const firstX =
    Math.floor(minimumX / gridStep);

  const lastX =
    Math.ceil(maximumX / gridStep);

  const firstY =
    Math.floor(minimumY / gridStep);

  const lastY =
    Math.ceil(maximumY / gridStep);

  // Prevent excessive rendering when a Map
  // spans an unexpectedly large world area.
  if (
    lastX - firstX > 500 ||
    lastY - firstY > 500
  )
  {
    return null;
  }

  for (let index = firstX; index <= lastX; index++)
  {
    const x = index * gridStep;

    appendLine(
      x,
      minimumY,
      x,
      maximumY,
      index % subdivisionCount === 0
    );
  }

  for (let index = firstY; index <= lastY; index++)
  {
    const y = index * gridStep;

    appendLine(
      minimumX,
      y,
      maximumX,
      y,
      index % subdivisionCount === 0
    );
  }

  const screenCorners =
    imageCorners.map(mapToScreen);

  const clipId = `sector-grid-clip-${map.id}`;

  return (
    <svg
      className="sector-grid-overlay"
      width={viewportSize.width}
      height={viewportSize.height}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon
            points={screenCorners
              .map(
                (point) =>
                  `${point.x},${point.y}`
              )
              .join(' ')}
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {gridLines.map((line, index) => (
          <line
            key={index}
            x1={line.start.x}
            y1={line.start.y}
            x2={line.end.x}
            y2={line.end.y}
            vectorEffect="non-scaling-stroke"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={
              line.major && showSubdivisions
                ? 1.5
                : 1
            }
            strokeDasharray={
              line.major
                ? undefined
                : '6 6'
            }
          />
        ))}
      </g>
    </svg>
  );
}

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

  const isAreaScale =  map.simulationScale === 'sprawl';

  const subdivisionSize = sectorGridSize / 5;

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
                  strokeDasharray="6 6"
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