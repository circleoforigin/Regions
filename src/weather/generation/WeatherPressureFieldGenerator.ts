import type { WeatherConfiguration } from '../models/WeatherConfiguration';

export type WeatherPressure = -1 | 0 | 1;

export interface WeatherPressureField {
  width: number;
  height: number;
  pressures: Int8Array;
}

export interface WeatherGenerationFields {
  nodeField: WeatherPressureField;
  windPressureField: WeatherPressureField;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function generateWeatherPressureField(
  configuration: WeatherConfiguration,
  random: () => number = Math.random
): WeatherPressureField {
  const { width, height } = configuration.plane;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 2 ||
    height < 2 ||
    height % 2 !== 0
  ) {
    throw new Error(
      'Invalid Weather pressure plane dimensions.'
    );
  }

  const pressures = new Int8Array(width * height);

  const indexAt = (x: number, y: number): number =>
    wrap(y, height) * width + wrap(x, width);

  // A staggered Node has six neighbors.
  // Odd rows are offset east by half a spacing.
  const neighborsOf = (
    x: number,
    y: number
  ): number[] => {
    const offsets = y % 2 === 0
      ? [
          [-1, 0], [1, 0],
          [-1, -1], [0, -1],
          [-1, 1], [0, 1],
        ]
      : [
          [-1, 0], [1, 0],
          [0, -1], [1, -1],
          [0, 1], [1, 1],
        ];

    return offsets.map(
      ([dx, dy]) => indexAt(x + dx, y + dy)
    );
  };

  const available = new Uint8Array(
    pressures.length
  );
  available.fill(1);

  let remaining = pressures.length;

  const pickAvailable = (): number => {
    const target = Math.floor(random() * remaining);
    let seen = 0;

    for (let i = 0; i < available.length; i++) {
      if (!available[i]) continue;

      if (seen === target) return i;
      seen++;
    }

    throw new Error(
      'Unable to select an available Weather Node.'
    );
  };

  const claim = (
    index: number,
    pressure: WeatherPressure
  ): void => {
    pressures[index] = pressure;
    available[index] = 0;
    remaining--;
  };

  while (remaining > 0) {
    const start = pickAvailable();

    // Neutral clusters are generated explicitly,
    // not just left between high and low systems.
    const roll = random();
    const pressure: WeatherPressure =
      roll < 1 / 3 ? -1 :
      roll < 2 / 3 ? 0 : 1;

    // Mostly small clusters, with occasional
    // larger irregular formations.
    const sizeRoll = random();
    const targetSize =
      sizeRoll < 0.15
        ? 1 + Math.floor(random() * 3)
        : sizeRoll < 0.75
          ? 4 + Math.floor(random() * 5)
          : sizeRoll < 0.95
            ? 9 + Math.floor(random() * 8)
            : 17 + Math.floor(random() * 9);

    claim(start, pressure);

    const frontier = [start];
    let claimed = 1;

    while (
      frontier.length > 0 &&
      claimed < targetSize
    ) {
      const sourceIndex = frontier[
        Math.floor(random() * frontier.length)
      ];

      const x = sourceIndex % width;
      const y = Math.floor(sourceIndex / width);

      const candidates = neighborsOf(x, y)
        .filter(index => available[index] === 1);

      if (candidates.length === 0) {
        const position = frontier.indexOf(sourceIndex);
        frontier.splice(position, 1);
        continue;
      }

// Prefer candidates that touch several
// Nodes already belonging to this cluster.
// This discourages long, narrow branches.
const weightedCandidates = candidates.map(
  (index) => {
    const candidateX = index % width;
    const candidateY = Math.floor(
      index / width
    );

    const connectedNeighbors = neighborsOf(
      candidateX,
      candidateY
    ).filter(
      neighbor => frontier.includes(neighbor)
    ).length;

    return {
      index,
      weight: 1 + connectedNeighbors * 2,
    };
  }
);

const totalWeight = weightedCandidates.reduce(
  (sum, candidate) =>
    sum + candidate.weight,
  0
);

let selection = random() * totalWeight;

let next =
  weightedCandidates[
    weightedCandidates.length - 1
  ].index;

for (const candidate of weightedCandidates) {
  selection -= candidate.weight;

  if (selection < 0) {
    next = candidate.index;
    break;
  }
}

      claim(next, pressure);
      frontier.push(next);
      claimed++;
    }
  }

  // Smooth isolated Nodes that disagree
// with nearly all six neighbors.
const smoothed = new Int8Array(pressures);

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = y * width + x;

    const neighbors = neighborsOf(x, y);

    let low = 0;
    let neutral = 0;
    let high = 0;

    for (const neighbor of neighbors) {
      const pressure = pressures[neighbor];

      if (pressure === -1) low++;
      else if (pressure === 0) neutral++;
      else high++;
    }

    const current = pressures[index];

    if (low >= 5 && current !== -1) {
      smoothed[index] = -1;
    } else if (
      neutral >= 5 &&
      current !== 0
    ) {
      smoothed[index] = 0;
    } else if (
      high >= 5 &&
      current !== 1
    ) {
      smoothed[index] = 1;
    }
  }
}

pressures.set(smoothed);

  return {
    width,
    height,
    pressures,
  };
}

export function getWeatherNodePressure(
  field: WeatherPressureField,
  x: number,
  y: number
): WeatherPressure {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y)
  ) {
    throw new Error(
      'Weather Node coordinates must be integers.'
    );
  }

  return field.pressures[
    wrap(y, field.height) * field.width +
    wrap(x, field.width)
  ] as WeatherPressure;
}



export interface WeatherGenerationFields {
  nodeField: WeatherPressureField;
  windPressureField: WeatherPressureField;
}

/**
 * Generate pressure systems from their centers.
 *
 * Strong cores exist only in windPressureField.
 * nodeField contains normalized -1, 0, +1.
 */
export function generateWeatherPressureFields(
  configuration: WeatherConfiguration,
  random: () => number = Math.random
): WeatherGenerationFields {
  const { width, height } = configuration.plane;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 2 ||
    height < 2 ||
    height % 2 !== 0
  ) {
    throw new Error(
      'Invalid Weather pressure plane dimensions.'
    );
  }

  const pressures = new Int8Array(width * height);
  const occupied = new Uint8Array(width * height);

  const indexAt = (x: number, y: number): number =>
    wrap(y, height) * width + wrap(x, width);

  const neighborsOf = (index: number): number[] => {
    const x = index % width;
    const y = Math.floor(index / width);

    const offsets = y % 2 === 0
      ? [
          [-1, 0], [1, 0],
          [-1, -1], [0, -1],
          [-1, 1], [0, 1],
        ]
      : [
          [-1, 0], [1, 0],
          [0, -1], [1, -1],
          [0, 1], [1, 1],
        ];

    return offsets.map(
      ([dx, dy]) => indexAt(x + dx, y + dy)
    );
  };

  const claim = (
    index: number,
    pressure: number
  ): void => {
    occupied[index] = 1;
    pressures[index] = pressure;
  };

  const randomIndex = (length: number): number =>
    Math.floor(random() * length);

  // Target roughly one potential system center
  // per twelve Weather Nodes.
  const attempts = Math.ceil(
    pressures.length / 12
  );

  for (let attempt = 0; attempt < attempts; attempt++) {
    const center = randomIndex(pressures.length);

    if (occupied[center]) continue;

    // Reserve some separation between systems.
    // This also leaves neutral pressure regions.
    if (
      neighborsOf(center).some(
        index => occupied[index] === 1
      )
    ) {
      continue;
    }

    const pressure = random() < 0.5 ? -1 : 1;
    const strongPressure = pressure * 2;

    // Begin with a small strong-pressure core.
    claim(center, strongPressure);

    const core: number[] = [center];
    const coreTarget = 1 + randomIndex(3);

    while (core.length < coreTarget) {
      const candidates = core.flatMap(
        index => neighborsOf(index)
      ).filter(index => occupied[index] === 0);

      if (candidates.length === 0) break;

      const next = candidates[
        randomIndex(candidates.length)
      ];

      claim(next, strongPressure);
      core.push(next);
    }

    // Grow an irregular surrounding region.
    // Most systems remain relatively small.
    const sizeRoll = random();

    const outerTarget =
      sizeRoll < 0.7
        ? 4 + randomIndex(7)
        : sizeRoll < 0.95
          ? 11 + randomIndex(8)
          : 19 + randomIndex(8);

    const region = [...core];
    let outerClaimed = 0;

    while (outerClaimed < outerTarget) {
      const candidates = new Set<number>();

      for (const index of region) {
        for (const neighbor of neighborsOf(index)) {
          if (occupied[neighbor] === 0) {
            candidates.add(neighbor);
          }
        }
      }

      if (candidates.size === 0) break;

      const available = [...candidates];

      // Favor filling indentations, but retain
      // randomness for irregular boundaries.
      const weights = available.map(index => {
        const adjacent = neighborsOf(index)
          .filter(neighbor =>
            pressures[neighbor] === pressure ||
            pressures[neighbor] === strongPressure
          ).length;

        return 1 + adjacent * 2;
      });

      const total = weights.reduce(
        (sum, weight) => sum + weight,
        0
      );

      let selection = random() * total;
      let chosen = available[available.length - 1];

      for (let i = 0; i < available.length; i++) {
        selection -= weights[i];

        if (selection < 0) {
          chosen = available[i];
          break;
        }
      }

      claim(chosen, pressure);
      region.push(chosen);
      outerClaimed++;
    }
  }

  // Unclaimed Nodes remain neutral.
  // The strong cores are normalized only
  // for the permanent Weather Node field.
  const nodePressures = new Int8Array(pressures);

  for (let i = 0; i < nodePressures.length; i++) {
    if (nodePressures[i] === -2) {
      nodePressures[i] = -1;
    } else if (nodePressures[i] === 2) {
      nodePressures[i] = 1;
    }
  }

  return {
    nodeField: {
      width,
      height,
      pressures: nodePressures,
    },
    windPressureField: {
      width,
      height,
      pressures,
    },
  };
}

