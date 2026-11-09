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

const sectorsPerNode =
  configuration.plane.nodeSpacingMiles / 5;

if (
  !Number.isSafeInteger(sectorsPerNode) ||
  sectorsPerNode <= 0
) {
  throw new Error(
    'Weather Node spacing must be a positive multiple of 5 miles.'
  );
}

const widthInSectors =
  width * sectorsPerNode;

const heightInSectors =
  height * sectorsPerNode;

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
  // Convert atmospheric Sector coordinates
  // into Weather Node row coordinates.
  const nodeY =
    sectorY / sectorsPerNode;

  const y0 = Math.floor(nodeY);
  const y1 = y0 + 1;

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

  // Sample a horizontal row while accounting
  // for its alternating 10-mile offset.
  const sampleRow = (
    row: number
  ): number => {
    const wrappedRow =
      wrap(row, height);

    const rowOffset =
      wrappedRow % 2 === 1
        ? sectorsPerNode / 2
        : 0;

    const nodeX =
      (sectorX - rowOffset) /
      sectorsPerNode;

    const x0 = Math.floor(nodeX);
    const tx = nodeX - x0;

    const left = at(x0, row);
    const right = at(x0 + 1, row);

    return (
      left * (1 - tx) +
      right * tx
    );
  };

  const upperPressure =
    sampleRow(y0);

  const lowerPressure =
    sampleRow(y1);

  // Interpolate between the two
  // staggered rows.
  return (
    upperPressure * (1 - ty) +
    lowerPressure * ty
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

// Calculate the pressure gradient around
// the center of the atmospheric Sector.
const centerX = x + 0.5;
const centerY = y + 0.5;

const dx =
  pressureAt(centerX - 1, centerY) -
  pressureAt(centerX + 1, centerY);

const dy =
  pressureAt(centerX, centerY - 1) -
  pressureAt(centerX, centerY + 1);

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
