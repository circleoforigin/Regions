import { hostedCollectionRepository } from '../host/HostedCollectionRepository';

export const TEMPERATURE_SWING_LENGTH = 1024;
export const MAX_TEMPERATURE_SWING = 10;
export const TEMPERATURE_SWING_VERSION = 1;

export interface TemperatureSwingCycle {
  values: number[];
}

function nextRandomState(state: number): number {
  return (
    Math.imul(state, 1664525) + 1013904223
  ) >>> 0;
}

export function createTemperatureSwingCycle(
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
          : randomInteger(7, 8);

    return magnitude === 0
      ? 0
      : random() < 0.5
        ? -magnitude
        : magnitude;
  };

  const values: number[] = [0];

  while (
    values.length < TEMPERATURE_SWING_LENGTH - 1
  ) {
    const previous = values[values.length - 1];

    let next: number;

    do {
      next = previous + generateChange();
    } while (
      Math.abs(next) > MAX_TEMPERATURE_SWING
    );

    values.push(next);
  }

  // Close the cycle without a sudden jump.
// Gradually guide the final days toward
// the starting value so the cycle closes.
const closingDays = 16;
const closingStart =
  TEMPERATURE_SWING_LENGTH - closingDays;

for (
  let index = closingStart;
  index < values.length;
  index++
) {
  const remaining =
    TEMPERATURE_SWING_LENGTH - index;

  const previous = values[index - 1];

  const target = Math.round(
    previous * (remaining - 1) / remaining
  );

  values[index] = Math.max(
    -MAX_TEMPERATURE_SWING,
    Math.min(MAX_TEMPERATURE_SWING, target)
  );
}

values.push(0);

  // Find an integer offset that places the
  // total sum at or immediately below zero.
  const sumWithOffset = (offset: number): number =>
    values.reduce(
      (sum, value) =>
        sum + Math.max(
          -MAX_TEMPERATURE_SWING,
          Math.min(
            MAX_TEMPERATURE_SWING,
            value + offset
          )
        ),
      0
    );

  let low = -20;
  let high = 20;

  while (low < high) {
    const middle = Math.floor(
      (low + high + 1) / 2
    );

    if (sumWithOffset(middle) <= 0) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  for (let index = 0; index < values.length; index++) {
    values[index] = Math.max(
      -MAX_TEMPERATURE_SWING,
      Math.min(
        MAX_TEMPERATURE_SWING,
        values[index] + low
      )
    );
  }

  // Correct the remaining negative sum
  // by distributing individual +1 changes.
  let deficit = -values.reduce(
    (sum, value) => sum + value,
    0
  );

  const candidates = values
    .map((value, index) => ({
      value,
      index,
    }))
    .filter(item =>
      item.value < MAX_TEMPERATURE_SWING
    );

  // Deterministically shuffle correction locations.
  for (let index = candidates.length - 1; index > 0; index--) {
    const other = randomInteger(0, index);

    [candidates[index], candidates[other]] =
      [candidates[other], candidates[index]];
  }

  for (
    let index = 0;
    index < deficit;
    index++
  ) {
    values[candidates[index].index]++;
  }

  return { values };
}

export function validateTemperatureSwingCycle(
  cycle: TemperatureSwingCycle
): boolean {
  const values = cycle.values;

  if (
    values.length !== TEMPERATURE_SWING_LENGTH ||
    !values.every(value =>
      Number.isInteger(value) &&
      Math.abs(value) <= MAX_TEMPERATURE_SWING
    )
  ) {
    return false;
  }

  const sum = values.reduce(
    (total, value) => total + value,
    0
  );

  if (sum !== 0) {
    return false;
  }

return values.every((value, index) => {
  const next =
    values[(index + 1) % values.length];

  return (
    Math.abs(next - value) <=
    MAX_TEMPERATURE_SWING
  );
});
}

export class TemperatureManager {
  private readonly cycle: TemperatureSwingCycle;

  constructor(cycle: TemperatureSwingCycle) {
    if (!validateTemperatureSwingCycle(cycle)) {
      throw new Error(
        'Invalid TemperatureSwing cycle.'
      );
    }

    this.cycle = {
      values: [...cycle.values],
    };
  }

  getDailySwing(worldDay: number): number {
    if (!Number.isSafeInteger(worldDay)) {
      throw new Error(
        'Temperature requires an integer World day.'
      );
    }

    const index =
      ((worldDay % TEMPERATURE_SWING_LENGTH) +
        TEMPERATURE_SWING_LENGTH) %
      TEMPERATURE_SWING_LENGTH;

    return this.cycle.values[index];
  }

  getCycle(): TemperatureSwingCycle {
    return {
      values: [...this.cycle.values],
    };
  }
}

const TEMPERATURE_COLLECTION = 'temperature-swing';

interface StoredTemperatureSwing {
  version: number;
  worldId: string;
  values: number[];
}

export async function loadOrCreateTemperatureSwing(
  projectId: string,
  worldId: string,
  seed: number
): Promise<TemperatureSwingCycle> {
  if (!projectId || !worldId) {
    throw new Error(
      'Temperature persistence requires a Project and World.'
    );
  }

  const stored =
    await hostedCollectionRepository.load<
      StoredTemperatureSwing
    >(
      TEMPERATURE_COLLECTION,
      projectId
    );

  if (stored) {
    const cycle: TemperatureSwingCycle = {
      values: stored.values,
    };

    if (
      stored.version !== TEMPERATURE_SWING_VERSION ||
      stored.worldId !== worldId ||
      !validateTemperatureSwingCycle(cycle)
    ) {
      throw new Error(
        'Stored TemperatureSwing is incompatible or invalid.'
      );
    }

    return cycle;
  }

  const cycle = createTemperatureSwingCycle(
    seed
  );

  if (!validateTemperatureSwingCycle(cycle)) {
    throw new Error(
      'Generated TemperatureSwing is invalid.'
    );
  }

  const record: StoredTemperatureSwing = {
    version: TEMPERATURE_SWING_VERSION,
    worldId,
    values: cycle.values,
  };

  await hostedCollectionRepository.save(
    TEMPERATURE_COLLECTION,
    projectId,
    record
  );

  return cycle;
}

export function testTemperatureSwingGenerator(): void {
  const seeds = [
    0,
    1,
    42,
    12345,
    987654321,
    0xffffffff,
  ];

  for (const seed of seeds) {
    const first = createTemperatureSwingCycle(seed);
    const second = createTemperatureSwingCycle(seed);

    if (!validateTemperatureSwingCycle(first)) {
      throw new Error(
        `TemperatureSwing validation failed for seed ${seed}.`
      );
    }

    if (
      first.values.some(
        (value, index) =>
          value !== second.values[index]
      )
    ) {
      throw new Error(
        `TemperatureSwing is not deterministic for seed ${seed}.`
      );
    }

    const manager = new TemperatureManager(first);

    for (const day of [
      -1025, -1024, -1, 0, 1, 1023, 1024, 1025,
    ]) {
      const expected =
        first.values[
          ((day % TEMPERATURE_SWING_LENGTH) +
            TEMPERATURE_SWING_LENGTH) %
          TEMPERATURE_SWING_LENGTH
        ];

      if (manager.getDailySwing(day) !== expected) {
        throw new Error(
          `TemperatureSwing lookup failed for day ${day}.`
        );
      }
    }
  }
}