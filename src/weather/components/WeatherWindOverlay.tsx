import { useEffect, useMemo, useRef } from 'react';

import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';

import {
  getSectorSizeInMapUnits,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../../spatial/Sector';

import {
  getWorldWindDirection,
  type WeatherWindField,
} from '../generation/WeatherWindGenerator';

import type {
  WeatherMovementCycle,
} from '../WeatherMovementCycle';

import type {
  WeatherConfiguration,
} from '../models/WeatherConfiguration';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface WeatherWindOverlayProps {
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;

  windField: WeatherWindField;
  movementCycle: WeatherMovementCycle;
  configuration: WeatherConfiguration;
  movementStep: number;
}

export default function WeatherWindOverlay({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
  windField,
  movementCycle,
  configuration,
  movementStep,
}: WeatherWindOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const sectorSize = registration.distanceScale
    ? getSectorSizeInMapUnits(
        registration.distanceScale,
        OVERWORLD_SECTOR_RESOLUTION
      )
    : null;

  const geometry = useMemo(() => {
    if (
      map.simulationScale !== 'overworld' ||
      sectorSize === null ||
      !Number.isFinite(sectorSize) ||
      sectorSize <= 0 ||
      !Number.isFinite(scale) ||
      scale <= 0
    ) {
      return null;
    }

    const stepPx = sectorSize * scale;

    const originX =
      viewportSize.width / 2 + pan.x;

    const originY =
      viewportSize.height / 2 + pan.y;

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

    if (
      !Number.isFinite(imageWidth) ||
      !Number.isFinite(imageHeight) ||
      imageWidth <= 0 ||
      imageHeight <= 0
    ) {
      return null;
    }

    const minX = Math.max(0, imageLeft);
    const maxX = Math.min(
      viewportSize.width,
      imageLeft + imageWidth
    );

    const minY = Math.max(0, imageTop);
    const maxY = Math.min(
      viewportSize.height,
      imageTop + imageHeight
    );

    if (minX >= maxX || minY >= maxY) {
      return null;
    }

    const xStart = Math.ceil(
      (minX - originX) / stepPx - 0.5
    );

    const xEnd = Math.floor(
      (maxX - originX) / stepPx - 0.5
    );

    const yStart = Math.ceil(
      (minY - originY) / stepPx - 0.5
    );

    const yEnd = Math.floor(
      (maxY - originY) / stepPx - 0.5
    );

    const arrows: {
      x: number;
      y: number;
      angle: number;
    }[] = [];

// Fixed density based on zoom and viewport size,
// independent of the currently visible map area.
const MAX_VISIBLE_ARROWS = 600;

const viewportSectorCount =
  Math.ceil(viewportSize.width / stepPx) *
  Math.ceil(viewportSize.height / stepPx);

//const stride = Math.max(
  //1,
  //Math.ceil(
    //Math.sqrt(
      //viewportSectorCount / MAX_VISIBLE_ARROWS
    //)
  //),
  //Math.ceil(12 / stepPx)
//);

// Diagnostic mode: one arrow per 5-mile Sector.
const stride = 1;

const alignedStartX =
  Math.ceil(xStart / stride) * stride;

const alignedStartY =
  Math.ceil(yStart / stride) * stride;

for (
  let y = alignedStartY;
  y <= yEnd;
  y += stride
) {
  for (
    let x = alignedStartX;
    x <= xEnd;
    x += stride
  ) {
        const direction = getWorldWindDirection(
          windField,
          movementCycle,
          movementStep,
          configuration,
          x,
          y
        );

        arrows.push({
          x: originX + (x + 0.5) * stepPx,
          y: originY + (y + 0.5) * stepPx,
          angle: direction * 45,
        });
      }
    }

    return {
      arrows,
// Smaller arrows for the full-density
// diagnostic overlay.
arrowSize: Math.min(
  5.5,
  Math.max(2.5, stepPx * 0.18)
),
      imageLeft,
      imageTop,
      imageWidth,
      imageHeight,
    };
  }, [
    map.simulationScale,
    sectorSize,
    scale,
    pan.x,
    pan.y,
    viewportSize.width,
    viewportSize.height,
    imageSize.width,
    imageSize.height,
    registration.offsetX,
    registration.offsetY,
    registration.scale,
    windField,
    movementCycle,
    configuration,
    movementStep,
  ]);

  
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    const pixelRatio =
      window.devicePixelRatio || 1;

    const width = viewportSize.width;
    const height = viewportSize.height;

    canvas.width = Math.round(
      width * pixelRatio
    );

    canvas.height = Math.round(
      height * pixelRatio
    );

    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0
    );

    context.clearRect(
      0,
      0,
      width,
      height
    );

    if (!geometry) {
      return;
    }

    context.save();

    // Keep arrows inside the registered
    // map image.
    context.beginPath();
    context.rect(
      geometry.imageLeft,
      geometry.imageTop,
      geometry.imageWidth,
      geometry.imageHeight
    );
    context.clip();

    const size = geometry.arrowSize;

    // Draw all arrows using one Canvas,
    // rather than thousands of SVG elements.
    for (const arrow of geometry.arrows) {
      context.save();

      context.translate(
        arrow.x,
        arrow.y
      );

      context.rotate(
        arrow.angle * Math.PI / 180
      );

      context.beginPath();

      context.moveTo(-size, 0);
      context.lineTo(size, 0);

      context.moveTo(
        size * 0.25,
        -size * 0.65
      );

      context.lineTo(size, 0);

      context.lineTo(
        size * 0.25,
        size * 0.65
      );

      context.lineJoin = 'round';
      context.lineCap = 'round';

      context.strokeStyle = '#111111';
      context.lineWidth = 2;
      context.stroke();

      context.strokeStyle = '#78c8ff';
      context.lineWidth = 1;
      context.stroke();

      context.restore();
    }

    context.restore();
  }, [
    geometry,
    viewportSize.width,
    viewportSize.height,
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
