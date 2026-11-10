import { useMemo } from 'react';
import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';
import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';
import { generateWeatherNode } from '../generation/WeatherNodeGenerator';
import type { WeatherPressureField } from '../generation/WeatherPressureFieldGenerator';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface WeatherNodeOverlayProps {
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;
  pressureField: WeatherPressureField;
}

const LOW_COLOR = '#4A8FD4';
const NEUTRAL_COLOR = '#9299A1';
const HIGH_COLOR = '#DB7455';

function getPressureColor(
  pressure: number
): string {
  if (pressure === -1) {
    return LOW_COLOR;
  }

  if (pressure === 1) {
    return HIGH_COLOR;
  }

  return NEUTRAL_COLOR;
}

export default function WeatherNodeOverlay({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
  pressureField,
}: WeatherNodeOverlayProps) {
  const pressureColors = useMemo(() => {
  const {
    width,
    height,
  } = pressureField;

  const colors: string[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const node = generateWeatherNode(
        x,
        y,
        pressureField
      );

      colors.push(
        getPressureColor(
          node.pressureInfluence
        )
      );
    }
  }

  return colors;
}, [pressureField]);

  if (
    map.simulationScale !== 'overworld' ||
    !registration.distanceScale ||
    !Number.isFinite(scale) ||
    scale <= 0
  ) {
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
    sectorSize <= 0
  ) {
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
  ) {
    return null;
  }

  const sectorsPerNode = 4;

  if (
    !Number.isSafeInteger(sectorsPerNode) ||
    sectorsPerNode <= 0
  ) {
    return null;
  }

  const nodeSpacing =
    sectorSize * sectorsPerNode * scale;

  const sectorScreenSize =
    sectorSize * scale;

const originX =
  viewportSize.width / 2 + pan.x;

const originY =
  viewportSize.height / 2 + pan.y;

  const imageLeft =
    viewportSize.width / 2 +
    pan.x +
    (
      registration.offsetX -
      registeredWidth / 2
    ) * scale;

  const imageTop =
    viewportSize.height / 2 +
    pan.y +
    (
      registration.offsetY -
      registeredHeight / 2
    ) * scale;

  const imageRight =
    imageLeft + registeredWidth * scale;

  const imageBottom =
    imageTop + registeredHeight * scale;

  const left = Math.max(0, imageLeft);
  const top = Math.max(0, imageTop);

  const right = Math.min(
    viewportSize.width,
    imageRight
  );

  const bottom = Math.min(
    viewportSize.height,
    imageBottom
  );

  if (
    right <= left ||
    bottom <= top ||
    nodeSpacing <= 0
  ) {
    return null;
  }

  // Only render nodes within the visible
  // portion of the registered map.
  const startX = Math.ceil(
    (left - originX) / nodeSpacing
  );

  const endX = Math.floor(
    (right - originX) / nodeSpacing
  );

  const startY = Math.ceil(
    (top - originY) / nodeSpacing
  );

  const endY = Math.floor(
    (bottom - originY) / nodeSpacing
  );

const planeWidth = pressureField.width;
const planeHeight = pressureField.height;

  const wrap = (
    value: number,
    size: number
  ): number =>
    ((value % size) + size) % size;

  // Keep symbols small enough that the
  // underlying map remains readable.
  const radius = Math.min(
    5,
    Math.max(2, sectorScreenSize * 0.18)
  );

  const circles: React.ReactNode[] = [];

for (let y = startY; y <= endY; y++) {
  // Alternate rows are shifted east by
  // half the Weather Node spacing.
  const rowOffset =
    wrap(y, planeHeight) % 2 === 1
      ? nodeSpacing / 2
      : 0;

  for (let x = startX - 1; x <= endX; x++) {
    const planeX = wrap(
      x,
      planeWidth
    );

      const planeY = wrap(
        y,
        planeHeight
      );

      const color =
        pressureColors[
          planeY * planeWidth + planeX
        ];

      circles.push(
        <circle
          key={`${x}:${y}`}
cx={
  originX +
  x * nodeSpacing +
  rowOffset
}
          cy={originY + y * nodeSpacing}
          r={radius}
          fill={color}
          fillOpacity={0.85}
          stroke="#111827"
          strokeWidth={0.75}
        />
      );
    }
  }

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
      {circles}
    </svg>
  );
}