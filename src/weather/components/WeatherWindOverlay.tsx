import { useId, useMemo } from 'react';
import type { Map as RegionMap, MapImageRegistration } from '../../models/Map';
import { getSectorSizeInMapUnits, OVERWORLD_SECTOR_RESOLUTION } from '../../spatial/Sector';
import type { WeatherWindField } from '../generation/WeatherWindGenerator';
import { getWorldWindDirection } from '../generation/WeatherWindGenerator';
import type { WeatherMovementCycle } from '../WeatherMovementCycle';
import type { WeatherConfiguration } from '../models/WeatherConfiguration';

interface Point { x: number; y: number }
interface Size { width: number; height: number }

interface WeatherWindOverlayProps {
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;
  field: WeatherWindField;
  movementCycle: WeatherMovementCycle;
  configuration: WeatherConfiguration;
  movementStep: number;
}

/**
 * Renders one fixed-color, black-outlined arrow at each visible world
 * Sector center. Direction comes from the moving atmospheric wind field.
 * Wind strength/color mapping will be added when resolved strength exists.
 * The SVG never intercepts map interaction.
 */
export default function WeatherWindOverlay({
  map, registration, imageSize, viewportSize, scale, pan,
  field, movementCycle, configuration, movementStep,
}: WeatherWindOverlayProps) {
  const clipId = useId();
  const sectorSize = registration.distanceScale
    ? getSectorSizeInMapUnits(registration.distanceScale, OVERWORLD_SECTOR_RESOLUTION)
    : null;

  const geometry = useMemo(() => {
    if (map.simulationScale !== 'overworld' || !sectorSize ||
        !Number.isFinite(sectorSize) || sectorSize <= 0 ||
        !Number.isFinite(scale) || scale <= 0) return null;

    const stepPx = sectorSize * scale;
    const originX = viewportSize.width / 2 + pan.x;
    const originY = viewportSize.height / 2 + pan.y;
    const imageWidth = imageSize.width * registration.scale * scale;
    const imageHeight = imageSize.height * registration.scale * scale;
    const imageLeft = originX + (registration.offsetX * scale) - imageWidth / 2;
    const imageTop = originY + (registration.offsetY * scale) - imageHeight / 2;
    if (![imageWidth, imageHeight, imageLeft, imageTop].every(Number.isFinite) ||
        imageWidth <= 0 || imageHeight <= 0) return null;

    const minX = Math.max(0, imageLeft);
    const maxX = Math.min(viewportSize.width, imageLeft + imageWidth);
    const minY = Math.max(0, imageTop);
    const maxY = Math.min(viewportSize.height, imageTop + imageHeight);
    if (minX >= maxX || minY >= maxY) return null;

    const xStart = Math.ceil((minX - originX) / stepPx - 0.5);
    const xEnd = Math.floor((maxX - originX) / stepPx - 0.5);
    const yStart = Math.ceil((minY - originY) / stepPx - 0.5);
    const yEnd = Math.floor((maxY - originY) / stepPx - 0.5);
    const arrows: { x: number; y: number; angle: number }[] = [];
    // Cap rendering work at extreme zoom-out levels.
    const stride = Math.max(1, Math.ceil(Math.sqrt(
      Math.max(0, xEnd - xStart + 1) * Math.max(0, yEnd - yStart + 1) / 5000
    )));
    for (let y = yStart; y <= yEnd; y += stride) {
      for (let x = xStart; x <= xEnd; x += stride) {
        arrows.push({
          x: originX + (x + 0.5) * stepPx,
          y: originY + (y + 0.5) * stepPx,
          angle: getWorldWindDirection(
            field, movementCycle, movementStep, configuration, x, y
          ) * 45,
        });
      }
    }
    return {
      arrows,
      size: Math.min(15, Math.max(4, stepPx * 0.32)),
      imageLeft, imageTop, imageWidth, imageHeight,
    };
  }, [map.simulationScale, sectorSize, scale, pan.x, pan.y,
      viewportSize.width, viewportSize.height, imageSize.width, imageSize.height,
      registration.offsetX, registration.offsetY, registration.scale,
      field, movementCycle, configuration, movementStep]);

  if (!geometry) return null;

  return (
    <svg width={viewportSize.width} height={viewportSize.height}
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, top: 0,
        pointerEvents: 'none', overflow: 'hidden' }}>
      <defs>
        <clipPath id={clipId}>
          <rect x={geometry.imageLeft} y={geometry.imageTop}
            width={geometry.imageWidth} height={geometry.imageHeight} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {geometry.arrows.map((arrow, index) => (
          <g key={index} transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}>
            <path d={`M ${-geometry.size} 0 L ${geometry.size} 0 M ${geometry.size * 0.25} ${-geometry.size * 0.65} L ${geometry.size} 0 L ${geometry.size * 0.25} ${geometry.size * 0.65}`}
              fill="none" stroke="#111111" strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M ${-geometry.size} 0 L ${geometry.size} 0 M ${geometry.size * 0.25} ${-geometry.size * 0.65} L ${geometry.size} 0 L ${geometry.size * 0.25} ${geometry.size * 0.65}`}
              fill="none" stroke="#78c8ff" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}
