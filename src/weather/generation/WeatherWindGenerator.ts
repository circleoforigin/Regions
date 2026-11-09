import type { WeatherConfiguration } from '../models/WeatherConfiguration';
import { generateWeatherNode } from './WeatherNodeGenerator';
import type { WeatherMovementCycle } from '../WeatherMovementCycle';
import { getWrappedWeatherDisplacement } from '../WeatherMovementCycle';

/**
 * Direction indices are clockwise in map coordinates (Y increases south):
 * E, SE, S, SW, W, NW, N, NE.
 * Directions describe where the wind travels, not where it originates.
 */
export type WeatherWindDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeatherWindField {
  widthInSectors: number;
  heightInSectors: number;
  directions: Uint8Array;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/**
 * Generates the fixed wind-direction field once per world/configuration.
 * Pressure is smoothly interpolated between 10-mile nodes; the resulting
 * pressure gradient is sampled at every 5-mile atmospheric Sector center.
 * This does NOT interpolate movement: the entire field moves in discrete
 * one-Sector steps through WeatherMovementCycle.
 */
export function generateWeatherWindField(
  worldSeed: number,
  configuration: WeatherConfiguration
): WeatherWindField {
  const width = configuration.plane.width;
  const height = configuration.plane.height;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width <= 0 || height <= 0 || width * height > 1_000_000) {
    throw new Error('Invalid Weather wind plane dimensions.');
  }

  const widthInSectors = width * 2;
  const heightInSectors = height * 2;
  const pressures = new Float64Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pressures[y * width + x] =
        generateWeatherNode(x, y, worldSeed, configuration).pressureInfluence;
    }
  }

  const pressureAt = (sectorX: number, sectorY: number): number => {
    // Node (0,0) is centered in Sector (0,0). Nodes are two Sectors apart.
    const nodeX = sectorX / 2;
    const nodeY = sectorY / 2;
    const x0 = Math.floor(nodeX);
    const y0 = Math.floor(nodeY);
    const tx = nodeX - x0;
    const ty = nodeY - y0;
    const at = (x: number, y: number) =>
      pressures[wrap(y, height) * width + wrap(x, width)];
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  const directions = new Uint8Array(widthInSectors * heightInSectors);

  for (let y = 0; y < heightInSectors; y++) {
    for (let x = 0; x < widthInSectors; x++) {
      // Wind travels down the pressure gradient.
      const dx = pressureAt(x - 1, y) - pressureAt(x + 1, y);
      const dy = pressureAt(x, y - 1) - pressureAt(x, y + 1);
      const angle = Math.atan2(dy, dx);
      const direction = wrap(Math.round(angle / (Math.PI / 4)), 8);
      directions[y * widthInSectors + x] = direction;
    }
  }

  return { widthInSectors, heightInSectors, directions };
}

/** Look up a fixed atmospheric Sector, with toroidal wrapping. */
export function getAtmosphericWindDirection(
  field: WeatherWindField,
  sectorX: number,
  sectorY: number
): WeatherWindDirection {
  if (!Number.isSafeInteger(sectorX) || !Number.isSafeInteger(sectorY)) {
    throw new Error('Wind Sector coordinates must be integers.');
  }
  const x = wrap(sectorX, field.widthInSectors);
  const y = wrap(sectorY, field.heightInSectors);
  return field.directions[y * field.widthInSectors + x] as WeatherWindDirection;
}

/** Resolve a world Sector using the plane's discrete movement step. */
export function getWorldWindDirection(
  field: WeatherWindField,
  cycle: WeatherMovementCycle,
  step: number,
  configuration: WeatherConfiguration,
  worldSectorX: number,
  worldSectorY: number
): WeatherWindDirection {
  const displacement = getWrappedWeatherDisplacement(cycle, step, configuration);
  return getAtmosphericWindDirection(
    field,
    worldSectorX - displacement.x,
    worldSectorY - displacement.y
  );
}
