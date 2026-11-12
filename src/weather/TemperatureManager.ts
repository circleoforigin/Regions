import {
  deriveSeed,
} from '@settingforge/module-sdk';

export const TEMPERATURE_SWING_LENGTH = 256;
export const MAX_TEMPERATURE_SWING = 10;

export interface TemperatureSwingCycle {
  values: number[];
}

function nextRandomState(state: number): number {
  return (
    Math.imul(state, 1664525) + 1013904223
  ) >>> 0;
}

function createTemperatureSwingCycle(
  seed: number
): TemperatureSwingCycle {
  let state = seed >>> 0;

  const random = (): number => {
    state = nextRandomState(state);
    return state / 0x100000000;
  };

  const randomInteger = (
    minimum: number,
    maximum: number
  ): number =>
    minimum + Math.floor(
      random() * (maximum - minimum + 1)
    );

  const generateChange = (): number => {
    const roll = random();

    const magnitude =
      roll < 0.85
        ? randomInteger(0, 2)
        : roll < 0.98
          ? randomInteger(3, 6)
          : randomInteger(7, 10);

    return magnitude === 0
      ? 0
      : random() < 0.5
        ? -magnitude
        : magnitude;
  };

  for (
    let attempt = 0;
    attempt < 100000;
    attempt++
  ) {
    const values: number[] = [
      randomInteger(-10, 10),
    ];

    while (
      values.length < TEMPERATURE_SWING_LENGTH
    ) {
      const previous =
        values[values.length - 1];

      let next: number;

      do {
        next = previous + generateChange();
      } while (
        next < -MAX_TEMPERATURE_SWING ||
        next > MAX_TEMPERATURE_SWING
      );

      values.push(next);
    }

    const sum = values.reduce(
      (total, value) => total + value,
      0
    );

    const boundaryChange = Math.abs(
      values[values.length - 1] -
      values[0]
    );

    if (
      sum === 0 &&
      boundaryChange <= MAX_TEMPERATURE_SWING
    ) {
      return { values };
    }
  }

  throw new Error(
    'Unable to generate TemperatureSwing cycle.'
  );
}

export function getTemperatureSwing(
  cycle: TemperatureSwingCycle,
  worldDay: number
): number {
  if (!Number.isSafeInteger(worldDay)) {
    throw new Error(
      'TemperatureSwing requires an integer World day.'
    );
  }

  const index =
    ((worldDay % cycle.values.length) +
      cycle.values.length) %
    cycle.values.length;

  return cycle.values[index];
}

export class TemperatureManager {
  private readonly cycles = new Map<number, TemperatureSwingCycle>();
  private readonly temperatureSeed: number;
  private readonly nodeCount: number;

  constructor(
    temperatureSeed: number,
    nodeCount: number
  ) {
    this.temperatureSeed = temperatureSeed;
    this.nodeCount = nodeCount;
  }

  private getCycle(
    nodeIndex: number
  ): TemperatureSwingCycle {
    if (
      !Number.isSafeInteger(nodeIndex) ||
      nodeIndex < 0 ||
      nodeIndex >= this.nodeCount
    ) {
      throw new Error(
        'Invalid Weather Node index.'
      );
    }

    let cycle = this.cycles.get(nodeIndex);

    if (!cycle) {
      const seed = deriveSeed(
        this.temperatureSeed,
        `weather.temperature.node.${nodeIndex}`
      );

      cycle = createTemperatureSwingCycle(seed);

      this.cycles.set(nodeIndex, cycle);
    }

    return cycle;
  }

  getDailySwing(
    nodeIndex: number,
    worldDay: number
  ): number {
    return getTemperatureSwing(
      this.getCycle(nodeIndex),
      worldDay
    );
  }
}