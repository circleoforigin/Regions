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

  const count = width * height;
  const pressures = new Int8Array(count);

  // -1 means no system has claimed the Node.
  const owners = new Int32Array(count);
  owners.fill(-1);

  // Protect temporary strong-pressure cores.
  const cores = new Uint8Array(count);

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

  const randomIndex = (length: number): number =>
    Math.floor(random() * length);

  interface PressureSystem {
    pressure: -1 | 1;
    frontier: number[];
  }

  const systems: PressureSystem[] = [];

  const claim = (
    index: number,
    systemId: number,
    isCore = false
  ): void => {
    owners[index] = systemId;

    const pressure = systems[systemId].pressure;

    pressures[index] = isCore
      ? pressure * 2
      : pressure;

    if (isCore) {
      cores[index] = 1;
    }
  };

  // PHASE 1: Place all pressure cores first.
  const targetSystems = Math.max(
    2,
    Math.floor(count / 14)
  );

  const placementAttempts = count * 4;

  for (
    let attempt = 0;
    attempt < placementAttempts &&
    systems.length < targetSystems;
    attempt++
  ) {
    const center = randomIndex(count);

    if (owners[center] !== -1) continue;

    if (
      neighborsOf(center).some(
        index => owners[index] !== -1
      )
    ) {
      continue;
    }

    const systemId = systems.length;

    systems.push({
      pressure: random() < 0.5 ? -1 : 1,
      frontier: [],
    });

    claim(center, systemId, true);

    const coreNodes = [center];
    const coreTarget = 1 + randomIndex(3);

    while (coreNodes.length < coreTarget) {
      const candidates = [
        ...new Set(
          coreNodes.flatMap(
            index => neighborsOf(index)
          )
        ),
      ].filter(
        index => owners[index] === -1
      );

      if (candidates.length === 0) break;

      const next = candidates[
        randomIndex(candidates.length)
      ];

      claim(next, systemId, true);
      coreNodes.push(next);
    }

    systems[systemId].frontier = [...coreNodes];
  }

  if (systems.length === 0) {
    throw new Error(
      'Unable to place Weather pressure cores.'
    );
  }

  // PHASE 2: Grow every system in alternating
  // rounds until all Nodes are claimed.
  let remaining = owners.reduce(
    (sum, owner) => sum + (owner === -1 ? 1 : 0),
    0
  );

  while (remaining > 0) {
    let claimedThisRound = 0;

    // Randomize the order each round so the
    // same system does not always move first.
    const order = systems.map((_, index) => index);

    for (let i = order.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);

      [order[i], order[j]] =
        [order[j], order[i]];
    }

    for (const systemId of order) {
      const system = systems[systemId];
      const candidates = new Set<number>();

      for (const source of system.frontier) {
        for (const neighbor of neighborsOf(source)) {
          if (owners[neighbor] === -1) {
            candidates.add(neighbor);
          }
        }
      }

      if (candidates.size === 0) continue;

      const available = [...candidates];

      // Prefer compact growth, but permit
      // irregular edges and protrusions.
      const weights = available.map(index => {
        const matching = neighborsOf(index)
          .filter(
            neighbor => owners[neighbor] === systemId
          ).length;

        return 1 + matching * 2;
      });

      let selection = random() * weights.reduce(
        (sum, weight) => sum + weight,
        0
      );

      let chosen = available[available.length - 1];

      for (let i = 0; i < available.length; i++) {
        selection -= weights[i];

        if (selection < 0) {
          chosen = available[i];
          break;
        }
      }

      claim(chosen, systemId);
      remaining--;
      claimedThisRound++;
    }

    // Refresh all frontiers after the complete
    // round. Growth is therefore simultaneous
    // at the round level, not system-by-system.
    for (let systemId = 0; systemId < systems.length; systemId++) {
      const system = systems[systemId];

      const nextFrontier: number[] = [];

      for (let index = 0; index < count; index++) {
        if (owners[index] !== systemId) continue;

        if (
          neighborsOf(index).some(
            neighbor => owners[neighbor] === -1
          )
        ) {
          nextFrontier.push(index);
        }
      }

      system.frontier = nextFrontier;
    }

    if (claimedThisRound === 0 && remaining > 0) {
      throw new Error(
        'Weather pressure growth stalled.'
      );
    }
  }

  // PHASE 3: Neutral smoothing.
  //
  // Only boundaries between opposing
  // pressure signs are neutralized.
  // Strong-pressure cores remain intact.
  const neutralized = new Int8Array(pressures);

  for (let index = 0; index < count; index++) {
    if (cores[index]) continue;

    const pressure = Math.sign(pressures[index]);
    const neighbors = neighborsOf(index);

    let opposing = 0;
    let matching = 0;

    for (const neighbor of neighbors) {
      const neighborPressure =
        Math.sign(pressures[neighbor]);

      if (neighborPressure === -pressure) {
        opposing++;
      } else if (neighborPressure === pressure) {
        matching++;
      }
    }

    // More conflicting neighbors produce a
    // higher chance of becoming neutral.
    const neutralChance =
      opposing >= 3 ? 0.95 :
      opposing === 2 ? 0.8 :
      opposing === 1 ? 0.45 :
      0;

    if (
      opposing > 0 &&
      random() < neutralChance
    ) {
      neutralized[index] = 0;
    } else if (
      matching <= 1 &&
      random() < 0.5
    ) {
      // Remove some thin isolated fragments.
      neutralized[index] = 0;
    }
  }

  // Apply a second, gentler neutral pass
  // to soften unusually sharp boundaries.
  const softened = new Int8Array(neutralized);

  for (let index = 0; index < count; index++) {
    if (cores[index]) continue;
    if (neutralized[index] === 0) continue;

    const neighbors = neighborsOf(index);

    const neutralNeighbors = neighbors.filter(
      neighbor => neutralized[neighbor] === 0
    ).length;

    const opposingNeighbors = neighbors.filter(
      neighbor =>
        Math.sign(neutralized[neighbor]) ===
        -Math.sign(neutralized[index])
    ).length;

    if (
      neutralNeighbors >= 2 &&
      opposingNeighbors >= 1 &&
      random() < 0.3
    ) {
      softened[index] = 0;
    }
  }

  // Permanent Nodes retain only -1, 0, +1.
  const nodePressures = new Int8Array(softened);

  for (let index = 0; index < count; index++) {
    if (nodePressures[index] === -2) {
      nodePressures[index] = -1;
    } else if (nodePressures[index] === 2) {
      nodePressures[index] = 1;
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
      pressures: softened,
    },
  };
}
