import type { WeatherConfiguration } from '../models/WeatherConfiguration';
import type {
  WeatherPressureField,
} from './WeatherPressureFieldGenerator';
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


const WIND_DIRECTION_VECTORS = Array.from(
  { length: 8 },
  (_, direction) => ({
    x: Math.cos(direction * Math.PI / 4),
    y: Math.sin(direction * Math.PI / 4),
  })
);

/**
 * Smooth the generated wind field using
 * circular averaging and local conflict detection.
 *
 * Every pass reads the previous complete field.
 * The original directions remain an anchor.
 */
function refineWeatherWindField(
  field: WeatherWindField,
  passCount = 2
): WeatherWindField {
  const width = field.widthInSectors;
  const height = field.heightInSectors;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    field.directions.length !== width * height ||
    !Number.isSafeInteger(passCount) ||
    passCount < 0
  ) {
    throw new Error(
      'Invalid wind refinement parameters.'
    );
  }

  const original = field.directions;
  let current = new Uint8Array(original);

  const indexAt = (x: number, y: number): number =>
    wrap(y, height) * width + wrap(x, width);

  for (let pass = 0; pass < passCount; pass++) {
    const next = new Uint8Array(current);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;

        const originalDirection = original[index];
        const currentDirection = current[index];

        const originalVector =
          WIND_DIRECTION_VECTORS[originalDirection];

        const currentVector =
          WIND_DIRECTION_VECTORS[currentDirection];

        // Anchor the average to the original
        // pressure-generated wind direction.
        let sumX = originalVector.x * 2;
        let sumY = originalVector.y * 2;

        let oppositionCount = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const neighborDirection = current[
              indexAt(x + offsetX, y + offsetY)
            ];

            const neighborVector =
              WIND_DIRECTION_VECTORS[neighborDirection];

            // Circular averaging handles the
            // transition between direction 7 and 0.
            sumX += neighborVector.x;
            sumY += neighborVector.y;

            const distance = Math.hypot(
              offsetX,
              offsetY
            );

            // Direction from this Sector
            // toward the neighboring Sector.
            const towardNeighborX =
              offsetX / distance;

            const towardNeighborY =
              offsetY / distance;

            const currentTowardNeighbor =
              currentVector.x * towardNeighborX +
              currentVector.y * towardNeighborY;

            const neighborTowardCurrent =
              neighborVector.x * -towardNeighborX +
              neighborVector.y * -towardNeighborY;

            if (
              currentTowardNeighbor > 0.7 &&
              neighborTowardCurrent > 0.7
            ) {
              oppositionCount++;
            }
          }
        }

        const magnitude = Math.hypot(sumX, sumY);

        if (magnitude < 0.001) {
          continue;
        }

        const agreement =
          (
            sumX * currentVector.x +
            sumY * currentVector.y
          ) / magnitude;

        // Preserve directions that already
        // agree with their surroundings.
        if (
          oppositionCount === 0 &&
          agreement >= 0.7
        ) {
          continue;
        }

        let bestDirection = currentDirection;
        let bestScore = -Infinity;

        for (
          let candidate = 0;
          candidate < 8;
          candidate++
        ) {
          const candidateVector =
            WIND_DIRECTION_VECTORS[candidate];

          const score =
            candidateVector.x * sumX +
            candidateVector.y * sumY +
            0.5 * (
              candidateVector.x * originalVector.x +
              candidateVector.y * originalVector.y
            );

          if (score > bestScore) {
            bestScore = score;
            bestDirection = candidate;
          }
        }

        next[index] = bestDirection;
      }
    }

    current = next;
  }

  return {
    widthInSectors: width,
    heightInSectors: height,
    directions: current,
  };
}


/**
 * Detect whether two neighboring Sectors
 * have winds pointing directly toward
 * one another.
 *
 * Only cardinally adjacent pairs are
 * considered for this targeted correction.
 */
function isHeadOnWindCollision(
  firstDirection: number,
  secondDirection: number,
  offsetX: number,
  offsetY: number
): boolean {
  const first = WIND_DIRECTION_VECTORS[firstDirection];
  const second = WIND_DIRECTION_VECTORS[secondDirection];

  const firstTowardSecond =
    first.x * offsetX +
    first.y * offsetY;

  const secondTowardFirst =
    second.x * -offsetX +
    second.y * -offsetY;

  return (
    firstTowardSecond > 0.7 &&
    secondTowardFirst > 0.7
  );
}


/**
 * Resolve isolated head-on collisions.
 *
 * Uses surrounding wind agreement to select
 * a deflection, with the original generated
 * direction retained as an anchor.
 *
 * Changes are synchronous and accepted only
 * when they reduce local conflict.
 */
function resolveWindCollisions(
  field: WeatherWindField,
  originalDirections: Uint8Array
): WeatherWindField {
  const width = field.widthInSectors;
  const height = field.heightInSectors;

  const current = field.directions;
  const next = new Uint8Array(current);

  const indexAt = (x: number, y: number): number =>
    wrap(y, height) * width + wrap(x, width);

  const cardinalNeighbors = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  const collisionCount = (
    x: number,
    y: number,
    direction: number
  ): number => {
    let count = 0;

    for (const offset of cardinalNeighbors) {
      const neighborDirection = current[
        indexAt(x + offset.x, y + offset.y)
      ];

      if (
        isHeadOnWindCollision(
          direction,
          neighborDirection,
          offset.x,
          offset.y
        )
      ) {
        count++;
      }
    }

    return count;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const direction = current[index];

      const existingCollisions = collisionCount(
        x,
        y,
        direction
      );

      if (existingCollisions === 0) {
        continue;
      }

      let bestDirection = direction;
      let bestScore = -Infinity;

      // Limit corrections to a single 45-degree
      // rotation in either direction.
      for (const adjustment of [-1, 0, 1]) {
        const candidate = wrap(
          direction + adjustment,
          8
        );

        const candidateVector =
          WIND_DIRECTION_VECTORS[candidate];

        const originalVector =
          WIND_DIRECTION_VECTORS[
            originalDirections[index]
          ];

        const collisions = collisionCount(
          x,
          y,
          candidate
        );

        // Do not introduce additional collisions.
        if (collisions > existingCollisions) {
          continue;
        }

        let agreement = 0;

        for (let offsetY = -1; offsetY <= 1; offsetY++) {
          for (let offsetX = -1; offsetX <= 1; offsetX++) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const neighborDirection = current[
              indexAt(x + offsetX, y + offsetY)
            ];

            const neighborVector =
              WIND_DIRECTION_VECTORS[
                neighborDirection
              ];

            agreement +=
              candidateVector.x * neighborVector.x +
              candidateVector.y * neighborVector.y;
          }
        }

        const originalAgreement =
          candidateVector.x * originalVector.x +
          candidateVector.y * originalVector.y;

        const score =
          agreement +
          originalAgreement * 2 -
          collisions * 6;

        if (score > bestScore) {
          bestScore = score;
          bestDirection = candidate;
        }
      }

      next[index] = bestDirection;
    }
  }

  return {
    widthInSectors: width,
    heightInSectors: height,
    directions: next,
  };
}

// Tangential flow dominates, while a smaller
// pressure-gradient component produces spiraling.
const WIND_CIRCULATION_WEIGHT = 0.8;
const WIND_PRESSURE_FLOW_WEIGHT = 0.2;

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
  pressureField: WeatherPressureField,
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

if (
  pressureField.width !== width ||
  pressureField.height !== height ||
  pressureField.pressures.length !== width * height
) {
  throw new Error(
    'Weather pressure field dimensions do not match configuration.'
  );
}

const pressures = pressureField.pressures;

 
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

// Sample pressure 15 miles away in each
// direction instead of only 5 miles.
const gradientRadius = 3;

const dx =
  pressureAt(centerX - gradientRadius, centerY) -
  pressureAt(centerX + gradientRadius, centerY);

const dy =
  pressureAt(centerX, centerY - gradientRadius) -
  pressureAt(centerX, centerY + gradientRadius);
// dx and dy point from higher pressure
// toward lower pressure.
//
// In screen coordinates, Y increases south.
//
// Rotating the downhill gradient clockwise
// produces Northern Hemisphere circulation:
// clockwise around highs and
// counterclockwise around lows.
const circulationX = -dy;
const circulationY = dx;

// Combine circulation with a smaller
// high-to-low pressure component.
const windX =
  circulationX * WIND_CIRCULATION_WEIGHT +
  dx * WIND_PRESSURE_FLOW_WEIGHT;

const windY =
  circulationY * WIND_CIRCULATION_WEIGHT +
  dy * WIND_PRESSURE_FLOW_WEIGHT;

const angle = Math.atan2(
  windY,
  windX
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

const refinedField = refineWeatherWindField(
  {
    widthInSectors,
    heightInSectors,
    directions,
  },
  2
);

return resolveWindCollisions(
  refinedField,
  directions
);
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
