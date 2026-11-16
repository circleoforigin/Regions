import { createSeededRandom } from '@settingforge/module-sdk';
import { hostedCollectionRepository } from '../host/HostedCollectionRepository';

export const TEMPERATURE_SWING_LENGTH = 1024;
export const MAX_TEMPERATURE_SWING = 10;
export const TEMPERATURE_SWING_VERSION = 1;

export interface TemperatureSwingCycle {
  values: number[];
}

export const DAILY_TEMPERATURE_RANGE_LENGTH = 1009;
export const MIN_DAILY_TEMPERATURE_RANGE = 10;
export const MAX_DAILY_TEMPERATURE_RANGE = 30;
export const DAILY_TEMPERATURE_RANGE_VERSION = 1;

export interface DailyTemperatureRangeCycle {
  values: number[];
}

export function createTemperatureSwingCycle(
  seed: number
): TemperatureSwingCycle {
  const random = createSeededRandom(seed);

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
const closingStart = TEMPERATURE_SWING_LENGTH - closingDays;

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

export function createDailyTemperatureRangeCycle(
  seed: number
): DailyTemperatureRangeCycle {
  const random = createSeededRandom(seed);

  const randomInteger = (
    minimum: number,
    maximum: number
  ): number =>
    minimum + Math.floor(
      random() * (maximum - minimum + 1)
    );

  const clamp = (value: number): number =>
    Math.max(
      MIN_DAILY_TEMPERATURE_RANGE,
      Math.min(
        MAX_DAILY_TEMPERATURE_RANGE,
        value
      )
    );

  const values: number[] = [
    randomInteger(15, 25),
  ];

  while (
    values.length <
    DAILY_TEMPERATURE_RANGE_LENGTH
  ) {
    const previous =
      values[values.length - 1];

    const roll = random();

    const magnitude =
      roll < 0.85
        ? randomInteger(0, 2)
        : roll < 0.98
          ? randomInteger(3, 5)
          : randomInteger(6, 8);

    const change =
      magnitude === 0
        ? 0
        : random() < 0.5
          ? -magnitude
          : magnitude;

    // Favor the typical 15–25°F range
    // without excluding occasional extremes.
    const centerAdjustment =
      previous < 15
        ? 1
        : previous > 25
          ? -1
          : 0;

    values.push(
      clamp(
        previous +
        change +
        centerAdjustment
      )
    );
  }

  // Guide the final 16 days toward the
  // first value to avoid a cycle-boundary jump.
  const closingDays = 16;
  const closingStart =
    DAILY_TEMPERATURE_RANGE_LENGTH -
    closingDays;

  for (
    let index = closingStart;
    index < values.length;
    index++
  ) {
    const previous = values[index - 1];

    const remaining =
      DAILY_TEMPERATURE_RANGE_LENGTH -
      index;

    const target =
      values[0];

    values[index] = clamp(
      previous +
      Math.round(
        (target - previous) /
        (remaining + 1)
      )
    );
  }

  return { values };
}

export function validateDailyTemperatureRangeCycle(
  cycle: DailyTemperatureRangeCycle
): boolean {
  const values = cycle.values;

  if (
    values.length !==
      DAILY_TEMPERATURE_RANGE_LENGTH ||
    !values.every(
      value =>
        Number.isInteger(value) &&
        value >=
          MIN_DAILY_TEMPERATURE_RANGE &&
        value <=
          MAX_DAILY_TEMPERATURE_RANGE
    )
  ) {
    return false;
  }

  return values.every(
    (value, index) => {
      const next =
        values[
          (index + 1) %
          values.length
        ];

      return Math.abs(
        next - value
      ) <= 10;
    }
  );
}

export class TemperatureManager {
  private readonly cycle: TemperatureSwingCycle;
  private readonly dailyRangeCycle: DailyTemperatureRangeCycle | null;

  constructor(
  cycle: TemperatureSwingCycle,
  dailyRangeCycle: DailyTemperatureRangeCycle | null = null
) {
  if (!validateTemperatureSwingCycle(cycle)) {
    throw new Error(
      'Invalid TemperatureSwing cycle.'
    );
  }

  if (
    dailyRangeCycle &&
    !validateDailyTemperatureRangeCycle(dailyRangeCycle)
  ) {
    throw new Error(
      'Invalid DailyTemperatureRange cycle.'
    );
  }

  this.cycle = {
    values: [...cycle.values],
  };

  this.dailyRangeCycle = dailyRangeCycle
    ? { values: [...dailyRangeCycle.values] }
    : null;
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


getDailyTemperatureRange(
  worldDay: number
): number {
  if (!Number.isSafeInteger(worldDay)) {
    throw new Error(
      'DailyTemperatureRange requires an integer World day.'
    );
  }

  if (!this.dailyRangeCycle) {
    throw new Error(
      'DailyTemperatureRange has not been loaded.'
    );
  }

  const index =
    ((worldDay % DAILY_TEMPERATURE_RANGE_LENGTH) +
      DAILY_TEMPERATURE_RANGE_LENGTH) %
    DAILY_TEMPERATURE_RANGE_LENGTH;

  return this.dailyRangeCycle.values[index];
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


const DAILY_TEMPERATURE_RANGE_COLLECTION =
  'daily-temperature-range';

interface StoredDailyTemperatureRange {
  version: number;
  worldId: string;
  values: number[];
}

export async function loadOrCreateDailyTemperatureRange(
  projectId: string,
  worldId: string,
  seed: number
): Promise<DailyTemperatureRangeCycle> {
  if (!projectId || !worldId) {
    throw new Error(
      'DailyTemperatureRange requires a Project and World.'
    );
  }

  const stored =
    await hostedCollectionRepository.load<
      StoredDailyTemperatureRange
    >(
      DAILY_TEMPERATURE_RANGE_COLLECTION,
      projectId
    );

  if (stored) {
    const cycle: DailyTemperatureRangeCycle = {
      values: stored.values,
    };

    if (
      stored.version !== DAILY_TEMPERATURE_RANGE_VERSION ||
      stored.worldId !== worldId ||
      !validateDailyTemperatureRangeCycle(cycle)
    ) {
      throw new Error(
        'Stored DailyTemperatureRange is incompatible or invalid.'
      );
    }

    return cycle;
  }

  const cycle =
    createDailyTemperatureRangeCycle(seed);

  if (!validateDailyTemperatureRangeCycle(cycle)) {
    throw new Error(
      'Generated DailyTemperatureRange is invalid.'
    );
  }

  await hostedCollectionRepository.save(
    DAILY_TEMPERATURE_RANGE_COLLECTION,
    projectId,
    {
      version: DAILY_TEMPERATURE_RANGE_VERSION,
      worldId,
      values: cycle.values,
    } satisfies StoredDailyTemperatureRange
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

export function testDailyTemperatureRangeGenerator(): void {
  const seeds = [
    0,
    1,
    42,
    12345,
    987654321,
    0xffffffff,
  ];

  for (const seed of seeds)
  {
    const first = createDailyTemperatureRangeCycle(seed);

    const second = createDailyTemperatureRangeCycle(seed);

    if (!validateDailyTemperatureRangeCycle(first))
    {
      throw new Error(
        `DailyTemperatureRange validation failed for seed ${seed}.`
      );
    }

    if (
      first.values.some(
        (value, index) =>
          value !== second.values[index]
      )
    ) {
      throw new Error(
        `DailyTemperatureRange is not deterministic for seed ${seed}.`
      );
    }

    const swingCycle = createTemperatureSwingCycle(seed);

    const manager = new TemperatureManager(
      swingCycle,
      first
    );

    for (const day of [
      -1010,
      -1009,
      -1,
      0,
      1,
      1008,
      1009,
      1010,
      2018,
    ]) {
      const index =
        ((day % DAILY_TEMPERATURE_RANGE_LENGTH) +
          DAILY_TEMPERATURE_RANGE_LENGTH) %
        DAILY_TEMPERATURE_RANGE_LENGTH;

      const expected = first.values[index];

      if (
        manager.getDailyTemperatureRange(day) !==
        expected
      ) {
        throw new Error(
          `DailyTemperatureRange lookup failed for day ${day}.`
        );
      }
    }

  }
}