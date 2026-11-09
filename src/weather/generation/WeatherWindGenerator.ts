import type { WeatherConfiguration } from '../models/WeatherConfiguration';
import { generateWeatherNode } from './WeatherNodeGenerator';
import {
  getWrappedWeatherDisplacement,
  type WeatherMovementCycle,
} from '../WeatherMovementCycle';

/**
 * Wind direction represents the direction
 * the wind is traveling toward.
 *
 * Map coordinates:
 * X increases east.
 * Y increases south.
 *
 * 0 = East
 * 1 = Southeast
 * 2 = South
 * 3 = Southwest
 * 4 = West
 * 5 = Northwest
 * 6 = North
 * 7 = Northeast
 */
export type WeatherWindDirection =
  | 0 | 1 | 2 | 3
  | 4 | 5 | 6 | 7;

export interface WeatherWindField {
  widthInSectors: number;
  heightInSectors: number;

  directions: Uint8Array;
}

function wrap(
  value: number,
  size: number
): number {
  return ((value % size) + size) % size;
}

/**
 * Generate a permanent wind-direction field
 * from the Weather Nodes' pressure influences.
 *
 * Each Weather Node is 10 miles apart.
 * Each atmospheric Sector is 5 miles wide.
 *
 * Pressure is interpolated to calculate
 * a smooth spatial pressure gradient.
 *
 * This does NOT interpolate movement.
 */
export function generateWeatherWindField(
  worldSeed: number,
  configuration: WeatherConfiguration
): WeatherWindField {
  const width = configuration.plane.width;
  const height = configuration.plane.height;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 2 ||
    height < 2
  ) {
    throw new Error(
      'Invalid Weather wind plane dimensions.'
    );
  }

  const widthInSectors = width * 2;
  const heightInSectors = height * 2;

  const pressures = new Float64Array(
    width * height
  );

  // Generate the permanent pressure grid.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const node = generateWeatherNode(
        x,
        y,
        worldSeed,
        configuration
      );

      pressures[y * width + x] =
        node.pressureInfluence;
    }
  }

  const pressureAt = (
    sectorX: number,
    sectorY: number
  ): number => {
    // Node (0,0) is centered in Sector (0,0).
    // Adjacent Nodes are two Sectors apart.
    const nodeX = sectorX / 2;
    const nodeY = sectorY / 2;

    const x0 = Math.floor(nodeX);
    const y0 = Math.floor(nodeY);

    const tx = nodeX - x0;
    const ty = nodeY - y0;

    const at = (
      x: number,
      y: number
    ): number => {
      return pressures[
        wrap(y, height) * width +
        wrap(x, width)
      ];
    };

    const top =
      at(x0, y0) * (1 - tx) +
      at(x0 + 1, y0) * tx;

    const bottom =
      at(x0, y0 + 1) * (1 - tx) +
      at(x0 + 1, y0 + 1) * tx;

    return (
      top * (1 - ty) +
      bottom * ty
    );
  };

  const directions = new Uint8Array(
    widthInSectors * heightInSectors
  );

  // Calculate the pressure gradient at
  // each atmospheric Sector center.
  for (
    let y = 0;
    y < heightInSectors;
    y++
  ) {
    for (
      let x = 0;
      x < widthInSectors;
      x++
    ) {
      // Wind flows from higher pressure
      // toward lower pressure.
      const dx =
        pressureAt(x - 1, y) -
        pressureAt(x + 1, y);

      const dy =
        pressureAt(x, y - 1) -
        pressureAt(x, y + 1);

      const angle = Math.atan2(
        dy,
        dx
      );

      // Quantize to the eight compass
      // directions.
      const direction = wrap(
        Math.round(
          angle / (Math.PI / 4)
        ),
        8
      );

      directions[
        y * widthInSectors + x
      ] = direction;
    }
  }

  return {
    widthInSectors,
    heightInSectors,
    directions,
  };
}

/**
 * Retrieve the permanent wind direction
 * at an atmospheric Sector coordinate.
 */
export function getAtmosphericWindDirection(
  field: WeatherWindField,
  sectorX: number,
  sectorY: number
): WeatherWindDirection {
  if (
    !Number.isSafeInteger(sectorX) ||
    !Number.isSafeInteger(sectorY)
  ) {
    throw new Error(
      'Wind Sector coordinates must be integers.'
    );
  }

  const x = wrap(
    sectorX,
    field.widthInSectors
  );

  const y = wrap(
    sectorY,
    field.heightInSectors
  );

  return field.directions[
    y * field.widthInSectors + x
  ] as WeatherWindDirection;
}

/**
 * Resolve wind at a world Sector after
 * applying discrete atmospheric movement.
 */
export function getWorldWindDirection(
  field: WeatherWindField,
  cycle: WeatherMovementCycle,
  step: number,
  configuration: WeatherConfiguration,
  worldSectorX: number,
  worldSectorY: number
): WeatherWindDirection {
  const displacement =
    getWrappedWeatherDisplacement(
      cycle,
      step,
      configuration
    );

  return getAtmosphericWindDirection(
    field,
    worldSectorX - displacement.x,
    worldSectorY - displacement.y
  );
}
