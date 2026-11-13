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
          : randomInteger(7, 10);

    return magnitude === 0
      ? 0
      : random() < 0.5
        ? -magnitude
        : magnitude;
  };

  const halfLength =
    TEMPERATURE_SWING_LENGTH / 2;

  const firstHalf: number[] = [0];

  while (firstHalf.length < halfLength) {
    const previous =
      firstHalf[firstHalf.length - 1];

    let next: number;

    do {
      next = previous + generateChange();
    } while (
      next < -MAX_TEMPERATURE_SWING ||
      next > MAX_TEMPERATURE_SWING
    );

    firstHalf.push(next);
  }

  // Keep the join between the two halves
  // within the maximum daily change.
  while (
    Math.abs(firstHalf[halfLength - 1]) > 5
  ) {
    firstHalf.pop();

    const previous =
      firstHalf[firstHalf.length - 1];

    let next: number;

    do {
      next = previous + generateChange();
    } while (
      next < -5 ||
      next > 5
    );

    firstHalf.push(next);
  }

  // Mirroring with inverted signs guarantees
  // an exact zero sum without altering values.
  const secondHalf = firstHalf
    .slice()
    .reverse()
    .map(value => -value);

  return {
    values: [...firstHalf, ...secondHalf],
  };
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

    return Math.abs(next - value) <= 10;
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