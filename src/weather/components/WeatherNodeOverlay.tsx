
import { useId } from 'react';

import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';

import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';

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

interface WeatherNodeOverlayProps
{
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;
}

export default function WeatherNodeOverlay({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
}: WeatherNodeOverlayProps)
{
  const patternId = useId();

  if (
    map.simulationScale !== 'overworld' ||
    !registration.distanceScale
  )
  {
    return null;
  }

  const sectorSize =
    getSectorSizeInMapUnits(
      registration.distanceScale,
      OVERWORLD_SECTOR_RESOLUTION
    );

  if (
    sectorSize === null ||
    !Number.isFinite(sectorSize) ||
    sectorSize <= 0 ||
    !Number.isFinite(scale) ||
    scale <= 0
  )
  {
    return null;
  }

  const registeredWidth =
    imageSize.width * registration.scale;

  const registeredHeight =
    imageSize.height * registration.scale;

  if (
    !Number.isFinite(registeredWidth) ||
    !Number.isFinite(registeredHeight) ||
    registeredWidth <= 0 ||
    registeredHeight <= 0
  )
  {
    return null;
  }

  const nodeSpacing =
    sectorSize * 2 * scale;

  const nodeRadius =
    sectorSize * scale * 0.35;

  const toScreen = (
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

  // Sector (0, 0) is bounded by
  // Map coordinates 0 and sectorSize.
  //
  // The first Weather Node occupies its
  // center, at half a Sector.
  const origin =
    toScreen(
      sectorSize / 2,
      sectorSize / 2
    );

  const imageTopLeft =
    toScreen(
      registration.offsetX -
        registeredWidth / 2,

      registration.offsetY -
        registeredHeight / 2
    );

  const imageWidth =
    registeredWidth * scale;

  const imageHeight =
    registeredHeight * scale;

  return (
    <svg
      width={viewportSize.width}
      height={viewportSize.height}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          x={origin.x - nodeSpacing / 2}
          y={origin.y - nodeSpacing / 2}
          width={nodeSpacing}
          height={nodeSpacing}
        >
          <circle
            cx={nodeSpacing / 2}
            cy={nodeSpacing / 2}
            r={nodeRadius}
            fill="#858D96"
            fillOpacity={0.55}
          />
        </pattern>
      </defs>

      <rect
        x={imageTopLeft.x}
        y={imageTopLeft.y}
        width={imageWidth}
        height={imageHeight}
        fill={`url(#${patternId})`}
      />
    </svg>
  );
}
