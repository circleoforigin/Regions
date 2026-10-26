import type { Map } from './Map';
import type { Section } from './Section';
import type { ExposureLevel } from './ExposureLevel';

export function resolveExposureLevel(
  map: Map,
  area?: Section
): ExposureLevel
{
  if (area)
  {
    return area.exposureLevel ?? 0;
  }

  return map.exposureLevel ?? 0;
}

export interface ResolvedEnvironment
{
  exposureLevel: ExposureLevel;
  canBurn: boolean;
  canFlood: boolean;
}

export function resolveEnvironment(
  map: Map,
  area?: Section
): ResolvedEnvironment
{
  if (area)
  {
    return {
      exposureLevel: area.exposureLevel ?? 0,
      canBurn: area.canBurn ?? false,
      canFlood: area.canFlood ?? false,
    };
  }

  return {
    exposureLevel: map.exposureLevel ?? 0,
    canBurn: map.canBurn ?? false,
    canFlood: map.canFlood ?? false,
  };
}