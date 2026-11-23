
import { useEffect, useRef } from 'react';

import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';

import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface WeatherTemperatureOverlayProps {
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;

  getSectorTemperature: (
    sectorX: number,
    sectorY: number
  ) => number;
}


const TEMPERATURE_COLORS = [
  { temperature: 0, rgb: [245, 250, 255] },
  { temperature: 10, rgb: [213, 233, 255] },
  { temperature: 20, rgb: [141, 184, 255] },
  { temperature: 30, rgb: [50, 105, 216] },
  { temperature: 40, rgb: [16, 44, 155] },
  { temperature: 45, rgb: [22, 116, 236] },
  { temperature: 50, rgb: [18, 100, 45] },
  { temperature: 55, rgb: [73, 188, 97] },
  { temperature: 60, rgb: [159, 212, 73] },
  { temperature: 65, rgb: [245, 223, 58] },
  { temperature: 70, rgb: [255, 181, 41] },
  { temperature: 75, rgb: [245, 128, 41] },
  { temperature: 80, rgb: [217, 76, 57] },
  { temperature: 85, rgb: [227, 46, 36] },
  { temperature: 90, rgb: [241, 23, 18] },
  { temperature: 100, rgb: [176, 0, 0] },
] as const;


function getTemperatureColor(
  temperature: number
): string {
  if (!Number.isFinite(temperature)) {
    throw new Error('Invalid sector temperature.');
  }

const value = Math.max(
  0,
  Math.min(
    100,
    Math.floor(temperature / 5) * 5
  )
);

  for (
    let index = 1;
    index < TEMPERATURE_COLORS.length;
    index++
  ) {
    const lower = TEMPERATURE_COLORS[index - 1];
    const upper = TEMPERATURE_COLORS[index];

    if (value > upper.temperature) {
      continue;
    }

    const fraction =
      (value - lower.temperature) /
      (upper.temperature - lower.temperature);

    const channels = lower.rgb.map(
      (channel, channelIndex) =>
        Math.round(
          channel +
          (
            upper.rgb[channelIndex] - channel
          ) * fraction
        )
    );

    return `rgb(${channels.join(',')})`;
  }

  return 'rgb(255,23,8)';
}

export default function WeatherTemperatureOverlay({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
  getSectorTemperature,
}: WeatherTemperatureOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const width = viewportSize.width;
    const height = viewportSize.height;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    if (
      map.simulationScale !== 'overworld' ||
      !registration.distanceScale ||
      !Number.isFinite(scale) ||
      scale <= 0
    ) {
      return;
    }

    const sectorSize = getSectorSizeInMapUnits(
      registration.distanceScale,
      OVERWORLD_SECTOR_RESOLUTION
    );

    if (
      sectorSize === null ||
      !Number.isFinite(sectorSize) ||
      sectorSize <= 0
    ) {
      return;
    }

    const stepPx = sectorSize * scale;

    const originX = width / 2 + pan.x;
    const originY = height / 2 + pan.y;

    const imageWidth =
      imageSize.width * registration.scale * scale;

    const imageHeight =
      imageSize.height * registration.scale * scale;

    const imageLeft =
      originX +
      registration.offsetX * scale -
      imageWidth / 2;

    const imageTop =
      originY +
      registration.offsetY * scale -
      imageHeight / 2;

    const left = Math.max(0, imageLeft);
    const top = Math.max(0, imageTop);

    const right = Math.min(
      width,
      imageLeft + imageWidth
    );

    const bottom = Math.min(
      height,
      imageTop + imageHeight
    );

    if (right <= left || bottom <= top) {
      return;
    }

    // Sector addresses identify cells.
// Sector (0, 0) spans coordinates
// 0 through one sector width.

const startX = Math.floor(
  (left - originX) / stepPx
);

const endX = Math.ceil(
  (right - originX) / stepPx
) - 1;

const startY = Math.floor(
  (top - originY) / stepPx
);

const endY = Math.ceil(
  (bottom - originY) / stepPx
) - 1;

    context.save();

    context.beginPath();
    context.rect(
      left,
      top,
      right - left,
      bottom - top
    );
    context.clip();

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const temperature =
          getSectorTemperature(x, y);

        context.fillStyle =
          getTemperatureColor(temperature);

        context.fillRect(
            originX + x * stepPx,
            originY + y * stepPx,
            stepPx,
            stepPx
        );
      }
    }

    context.restore();
  }, [
    map.simulationScale,
    registration,
    imageSize.width,
    imageSize.height,
    viewportSize.width,
    viewportSize.height,
    scale,
    pan.x,
    pan.y,
    getSectorTemperature,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewportSize.width,
        height: viewportSize.height,
        opacity: 0.6,
        pointerEvents: 'none',
      }}
    />
  );
}
