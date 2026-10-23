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