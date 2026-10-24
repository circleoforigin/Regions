import type { Map } from './Map';
import type { Section } from './Section';
import type { ExposureLevel } from './ExposureLevel';

export function resolveExposureLevel(
  map: Map,
  area?: Section
): ExposureLevel
{
  return area?.exposureLevel ??
    map.exposureLevel ??
    0;
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
  return {
    exposureLevel: resolveExposureLevel(
      map,
      area
    ),

    canBurn:
      area?.canBurn ??
      map.canBurn ??
      false,

    canFlood:
      area?.canFlood ??
      map.canFlood ??
      false,
  };
}