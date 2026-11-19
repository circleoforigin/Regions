
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
  { temperature: 0, rgb: [8, 28, 133] },
  { temperature: 20, rgb: [22, 116, 236] },
  { temperature: 40, rgb: [35, 217, 232] },
  { temperature: 55, rgb: [73, 188, 97] },
  { temperature: 70, rgb: [245, 223, 58] },
  { temperature: 85, rgb: [255, 139, 25] },
  { temperature: 100, rgb: [255, 23, 8] },
] as const;

function getTemperatureColor(
  temperature: number
): string {
  if (!Number.isFinite(temperature)) {
    throw new Error('Invalid sector temperature.');
  }

  const value = Math.max(
    0,
    Math.min(100, temperature)
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

    // Sector addresses identify centers.
    // Each sector extends half a sector
    // in every direction from its center.
    const startX = Math.floor(
      (left - originX) / stepPx + 0.5
    );

    const endX = Math.ceil(
      (right - originX) / stepPx + 0.5
    ) - 1;

    const startY = Math.floor(
      (top - originY) / stepPx + 0.5
    );

    const endY = Math.ceil(
      (bottom - originY) / stepPx + 0.5
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
          originX + (x - 0.5) * stepPx,
          originY + (y - 0.5) * stepPx,
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
        pointerEvents: 'none',
      }}
    />
  );
}
