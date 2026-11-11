import { useEffect, useRef } from 'react';
import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';
import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';
import type { WeatherPressureField } from '../generation/WeatherPressureFieldGenerator';
import {
  getWrappedWeatherDisplacement,
  type WeatherMovementCycle,
} from '../WeatherMovementCycle';
import type { WeatherConfiguration } from '../models/WeatherConfiguration';

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
  movementCycle: WeatherMovementCycle;
  configuration: WeatherConfiguration;
  movementStep: number;
}

const PRESSURE_COLORS = [
  '#4A8FD4', // Low
  '#9299A1', // Neutral
  '#DB7455', // High
];

function wrap(
  value: number,
  size: number
): number {
  return ((value % size) + size) % size;
}

export default function WeatherNodeOverlay({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
  pressureField,
  movementCycle,
  configuration,
  movementStep,
}: WeatherNodeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const viewportWidth = viewportSize.width;
  const viewportHeight = viewportSize.height;
  const panX = pan.x;
  const panY = pan.y;

  const imageWidth = imageSize.width;
  const imageHeight = imageSize.height;

  const registrationScale = registration.scale;
  const offsetX = registration.offsetX;
  const offsetY = registration.offsetY;
  const distanceScale = registration.distanceScale;

  const isOverworld =
    map.simulationScale === 'overworld';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(viewportWidth * dpr);
    canvas.height = Math.round(viewportHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    context.clearRect(
      0, 0,
      viewportWidth,
      viewportHeight
    );

    if (
      !isOverworld ||
      !distanceScale ||
      !Number.isFinite(scale) ||
      scale <= 0
    ) {
      return;
    }

    const sectorSize = getSectorSizeInMapUnits(
      distanceScale,
      OVERWORLD_SECTOR_RESOLUTION
    );

    if (
      sectorSize === null ||
      !Number.isFinite(sectorSize) ||
      sectorSize <= 0
    ) {
      return;
    }

    const registeredWidth = imageWidth * registrationScale;
    const registeredHeight = imageHeight * registrationScale;

    if (
      !Number.isFinite(registeredWidth) ||
      !Number.isFinite(registeredHeight) ||
      registeredWidth <= 0 ||
      registeredHeight <= 0
    ) {
      return;
    }

    // 20-mile Node spacing / 5-mile Sectors.
    const sectorsPerNode = 4;
    const nodeSpacing = sectorSize * sectorsPerNode * scale;
    const sectorScreenSize = sectorSize * scale;

    const displacement =
        getWrappedWeatherDisplacement(
            movementCycle,
            movementStep,
            configuration
        );

    const movementOffsetX = displacement.x * sectorScreenSize;
    const movementOffsetY = displacement.y * sectorScreenSize;

    if (
      !Number.isFinite(nodeSpacing) ||
      nodeSpacing <= 0
    ) {
      return;
    }

    const originX = viewportWidth / 2 + panX;
    const originY = viewportHeight / 2 + panY;
    const weatherOriginX = originX + movementOffsetX;
    const weatherOriginY = originY + movementOffsetY;

    const imageLeft =
      originX +
      (offsetX - registeredWidth / 2) * scale;

    const imageTop =
      originY +
      (offsetY - registeredHeight / 2) * scale;

    const imageRight = imageLeft + registeredWidth * scale;
    const imageBottom = imageTop + registeredHeight * scale;

    const left = Math.max(0, imageLeft);
    const top = Math.max(0, imageTop);

    const right = Math.min(
      viewportWidth,
      imageRight
    );

    const bottom = Math.min(
      viewportHeight,
      imageBottom
    );

    if (right <= left || bottom <= top) {
      return;
    }

    const startX = Math.floor(
      (left - weatherOriginX) / nodeSpacing
    ) - 1;

    const endX = Math.ceil(
      (right - weatherOriginX) / nodeSpacing
    ) + 1;

    const startY = Math.floor(
      (top - weatherOriginY) / nodeSpacing
    ) - 1;

    const endY = Math.ceil(
      (bottom - weatherOriginY) / nodeSpacing
    ) + 1;

    const planeWidth = pressureField.width;
    const planeHeight = pressureField.height;

    // 50% larger than the previous SVG symbols.
    const radius = Math.min(
      7.5,
      Math.max(
        3,
        sectorScreenSize * 0.27
      )
    );

    context.save();

    // Restrict drawing to the registered map.
    context.beginPath();
    context.rect(
      left,
      top,
      right - left,
      bottom - top
    );
    context.clip();

    context.globalAlpha = 0.85;
    context.lineWidth = 0.75;
    context.strokeStyle = '#111827';

    for (let y = startY; y <= endY; y++) {
      const planeY = wrap(y, planeHeight);

      const rowOffset =
        planeY % 2 === 1
          ? nodeSpacing / 2
          : 0;

      const cy = weatherOriginY + y * nodeSpacing;

      if (
        cy + radius < top ||
        cy - radius > bottom
      ) {
        continue;
      }

      for (let x = startX; x <= endX; x++) {
        const cx =
          weatherOriginX +
          x * nodeSpacing +
          rowOffset;

        if (
          cx + radius < left ||
          cx - radius > right
        ) {
          continue;
        }

        const planeX = wrap(x, planeWidth);

        const pressure =
          pressureField.pressures[
            planeY * planeWidth + planeX
          ];

        const color = PRESSURE_COLORS[pressure + 1];

        context.beginPath();
        context.arc(
          cx,
          cy,
          radius,
          0,
          Math.PI * 2
        );

        context.fillStyle = color;
        context.fill();
        context.stroke();
      }
    }

    context.restore();

  }, [
    pressureField,
    isOverworld,
    distanceScale,
    scale,
    viewportWidth,
    viewportHeight,
    panX,
    panY,
    imageWidth,
    imageHeight,
    registrationScale,
    offsetX,
    offsetY,
    movementCycle,
    movementStep,
    configuration,
  ]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewportWidth,
        height: viewportHeight,
        pointerEvents: 'none',
      }}
    />
  );
}
