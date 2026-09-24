import type {
  MapDistanceUnit,
  MapImageRegistration,
} from '../models/Map';

export interface MapScalePoint {
  x: number;
  y: number;
}

export interface MapScaleCalibration {
  distance: number;
  pixels: number;
  unit: MapDistanceUnit;
}

export function calculatePixelDistance(
  start: MapScalePoint,
  end: MapScalePoint
): number {
  return Math.hypot(
    end.x - start.x,
    end.y - start.y
  );
}

export function createMapScaleCalibration(
  start: MapScalePoint,
  end: MapScalePoint,
  distance: number,
  unit: MapDistanceUnit
): MapScaleCalibration | null {
  const pixels =
    calculatePixelDistance(
      start,
      end
    );

  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(pixels) ||
    pixels <= 0
  ) {
    return null;
  }

  return {
    distance,
    pixels,
    unit,
  };
}

export function applyMapScaleCalibration(
  registration:
    MapImageRegistration | undefined,
  calibration: MapScaleCalibration
): MapImageRegistration {
  return {
    scale:
      registration?.scale ?? 1,

    offsetX:
      registration?.offsetX ?? 0,

    offsetY:
      registration?.offsetY ?? 0,

    distanceScale: {
      ...calibration,
    },
  };
}