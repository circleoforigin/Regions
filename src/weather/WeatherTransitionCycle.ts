export interface WeatherTransitionCycle {
  /**
   * Transition boundaries expressed as
   * integer UpdateInterval indices within
   * one complete repeating cycle.
   */
  offsets: number[];

  /**
   * Total number of UpdateIntervals
   * in the repeating cycle.
   */
  durationIntervals: number;
}

export interface WeatherTransitionPosition {
  /**
   * Absolute transition index.
   * May be negative for past dates.
   */
  index: number;

  startInterval: number;
  midpointInterval: number;
  endInterval: number;
}

/**
 * Resolves the transition containing an
 * absolute UpdateInterval index.
 */
export function getWeatherTransitionPosition(
  cycle: WeatherTransitionCycle,
  elapsedIntervals: number
): WeatherTransitionPosition {
  if (!Number.isSafeInteger(elapsedIntervals)) {
    throw new Error(
      'Invalid Weather UpdateInterval index.'
    );
  }

  const cycleLength = cycle.offsets.length;

  if (
    cycleLength === 0 ||
    !Number.isSafeInteger(cycle.durationIntervals) ||
    cycle.durationIntervals <= 0
  ) {
    throw new Error(
      'Invalid Weather transition cycle.'
    );
  }

  const completedCycles = Math.floor(
    elapsedIntervals / cycle.durationIntervals
  );

  const cycleStart =
    completedCycles * cycle.durationIntervals;

  const intervalWithinCycle =
    elapsedIntervals - cycleStart;

  let low = 0;
  let high = cycleLength;

  while (low < high) {
    const middle = Math.floor(
      (low + high) / 2
    );

    if (
      cycle.offsets[middle] <=
      intervalWithinCycle
    ) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const localIndex = low - 1;

  const startInterval =
    cycleStart + cycle.offsets[localIndex];

  const endInterval =
    localIndex + 1 < cycleLength
      ? cycleStart +
        cycle.offsets[localIndex + 1]
      : cycleStart +
        cycle.durationIntervals;

  const midpointInterval =
    startInterval +
    Math.floor(
      (endInterval - startInterval) / 2
    );

  return {
    index:
      completedCycles * cycleLength +
      localIndex,

    startInterval,
    midpointInterval,
    endInterval,
  };
}
