
export interface WeatherTransitionCycle
{
  /**
   * Transition times expressed as absolute
   * minutes within one complete cycle.
   */
  offsets: number[];

  /**
   * Length of the repeating schedule,
   * measured in minutes.
   */
  durationMinutes: number;
}

export interface WeatherTransitionPosition
{
  /**
   * Absolute transition index.
   * May be negative for past dates.
   */
  index: number;

  /**
   * Absolute minute when this transition
   * began.
   */
  startMinute: number;

  /**
   * Absolute minute of the next transition.
   */
  endMinute: number;

  /**
   * Progress between transitions.
   * Range: 0 through less than 1.
   */
  progress: number;
}

export function createWeatherTransitionCycle(
  minuteOfDay: readonly number[]
): WeatherTransitionCycle
{
  if (
    minuteOfDay.length === 0 ||
    minuteOfDay[0] !== 0
  )
  {
    throw new Error(
      'Weather transition cycle must begin at midnight.'
    );
  }

  const offsets: number[] = [];

  let day = 0;
  let previousMinute = -1;

  for (const minute of minuteOfDay)
  {
    if (
      !Number.isSafeInteger(minute) ||
      minute < 0 ||
      minute >= 1440
    )
    {
      throw new Error(
        'Invalid Weather transition minute.'
      );
    }

    if (minute === previousMinute)
    {
      throw new Error(
        'Duplicate consecutive Weather transition.'
      );
    }

    if (minute < previousMinute)
    {
      day += 1;
    }

    offsets.push(
      day * 1440 + minute
    );

    previousMinute = minute;
  }

  return {
    offsets,

    durationMinutes:
      (day + 1) * 1440,
  };
}

export function getWeatherTransitionPosition(
  cycle: WeatherTransitionCycle,
  elapsedMinutes: number
): WeatherTransitionPosition
{
  if (!Number.isFinite(elapsedMinutes))
  {
    throw new Error(
      'Invalid Weather simulation time.'
    );
  }

  const minute =
    Math.floor(elapsedMinutes);

  const cycleLength =
    cycle.offsets.length;

  if (
    cycleLength === 0 ||
    cycle.durationMinutes <= 0
  )
  {
    throw new Error(
      'Invalid Weather transition cycle.'
    );
  }

  const completedCycles =
    Math.floor(
      minute / cycle.durationMinutes
    );

  const minuteWithinCycle =
    minute -
    completedCycles * cycle.durationMinutes;

  let low = 0;
  let high = cycleLength;

  while (low < high)
  {
    const middle =
      Math.floor((low + high) / 2);

    if (
      cycle.offsets[middle] <=
      minuteWithinCycle
    )
    {
      low = middle + 1;
    }
    else
    {
      high = middle;
    }
  }

  const localIndex = low - 1;

  const startMinute =
    completedCycles *
      cycle.durationMinutes +
    cycle.offsets[localIndex];

  const endMinute =
    localIndex + 1 < cycleLength
      ? completedCycles *
          cycle.durationMinutes +
        cycle.offsets[localIndex + 1]
      : (completedCycles + 1) *
          cycle.durationMinutes;

  return {
    index:
      completedCycles * cycleLength +
      localIndex,

    startMinute,
    endMinute,

    progress:
      (minute - startMinute) /
      (endMinute - startMinute),
  };
}
