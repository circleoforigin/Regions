import { createSeededRandom } from '@settingforge/module-sdk';
import { hostedCollectionRepository } from '../host/HostedCollectionRepository';
import type { WeatherPressure } from './generation/WeatherPressureFieldGenerator';

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

export const DAILY_MINIMUM_TIME = 6 / 24;
export const DAILY_MAXIMUM_TIME = 15 / 24;

export const MAX_PRESSURE_TEMPERATURE_MODIFIER = 5;
/**
 * Fraction of the remaining season after the
 * solstice before the temperature extreme occurs.
 *
 * 0 = at the solstice
 * 0.5 = halfway between solstice and season end
 */
export const ESTIVAL_TEMPERATURE_LAG = 0.5;
export const HIBERNAL_TEMPERATURE_LAG = 0.5;

export interface DailyTemperatureRangeCycle {
  values: number[];
}

export interface SeasonalTemperatureAnchor {
  time: number;
  temperature: number;
}

export interface SeasonalTemperatureProfile {
  anchors: SeasonalTemperatureAnchor[];
}

export interface SeasonalCalendarStart {
  seasonId: string;
  time: number;
}

export interface SeasonalCalendarSolstice {
  time: number;
}

export interface SeasonalCalendarYear {
  year: number;
  starts: SeasonalCalendarStart[];
  shortSolstice?: SeasonalCalendarSolstice;
  longSolstice?: SeasonalCalendarSolstice;
}

export interface SeasonalTemperatureCalendar {
  previous: SeasonalCalendarYear;
  current: SeasonalCalendarYear;
  next: SeasonalCalendarYear;
}

export interface SeasonalTemperatureDefinition {
  id: string;
  lowTemperature: number;
  highTemperature: number;
}

/**
 * Builds a continuous seasonal temperature profile
 * using Celestial season starts and solstices.
 *
 * Every season boundary has exactly one temperature.
 * Winter and summer solstices provide extrema.
 */
export function createSeasonalTemperatureProfile(
  calendar: SeasonalTemperatureCalendar,
  seasons: SeasonalTemperatureDefinition[]
): SeasonalTemperatureProfile {
  const definitions = new Map(
    seasons.map(season => [season.id, season])
  );

  for (const season of seasons) {
    if (
      !Number.isFinite(season.lowTemperature) ||
      !Number.isFinite(season.highTemperature) ||
      season.lowTemperature > season.highTemperature
    ) {
      throw new Error(
        `Invalid temperature definition: ${season.id}`
      );
    }
  }

  const years = [
    calendar.previous,
    calendar.current,
    calendar.next,
  ];

  const starts = years
    .flatMap(year => year.starts)
    .sort((a, b) => a.time - b.time);

  if (starts.length < 2) {
    throw new Error(
      'Seasonal temperature requires multiple season starts.'
    );
  }

  for (let index = 0; index < starts.length; index++) {
    const start = starts[index];

    if (
      !Number.isFinite(start.time) ||
      !definitions.has(start.seasonId) ||
      (
        index > 0 &&
        start.time <= starts[index - 1].time
      )
    ) {
      throw new Error(
        'Invalid Celestial season sequence.'
      );
    }
  }

  const solstices = years.flatMap(year => [
    ...(year.shortSolstice
      ? [{ time: year.shortSolstice.time, kind: 'short' }]
      : []),
    ...(year.longSolstice
      ? [{ time: year.longSolstice.time, kind: 'long' }]
      : []),
  ]);

  const anchors: SeasonalTemperatureAnchor[] = [];

  for (let index = 0; index < starts.length; index++) {
    const start = starts[index];
    const season = definitions.get(start.seasonId)!;

    const previous = index > 0
      ? definitions.get(starts[index - 1].seasonId)!
      : null;

    // Average the neighboring seasons' desired
    // boundary temperatures to prevent jumps.
    let boundaryTemperature: number;

    switch (start.seasonId) {
      case 'spring':
        boundaryTemperature = previous
          ? (previous.highTemperature +
              season.lowTemperature) / 2
          : season.lowTemperature;
        break;

      case 'summer':
        boundaryTemperature = previous
          ? (previous.highTemperature +
              season.lowTemperature) / 2
          : season.lowTemperature;
        break;

      case 'autumn':
        boundaryTemperature = previous
          ? (previous.lowTemperature +
              season.highTemperature) / 2
          : season.highTemperature;
        break;

      case 'winter':
        boundaryTemperature = previous
          ? (previous.lowTemperature +
              season.highTemperature) / 2
          : season.highTemperature;
        break;

      default:
        boundaryTemperature =
          (season.lowTemperature +
            season.highTemperature) / 2;
    }

    anchors.push({
      time: start.time,
      temperature: boundaryTemperature,
    });

    const end = starts[index + 1];

    if (!end) {
      continue;
    }

    const expectedSolstice =
      start.seasonId === 'winter'
        ? 'short'
        : start.seasonId === 'summer'
          ? 'long'
          : null;

    if (!expectedSolstice) {
      continue;
    }

const matching = solstices
  .filter(
    solstice =>
      solstice.kind === expectedSolstice &&
      solstice.time > start.time &&
      solstice.time < end.time
  )
  .sort(
    (a, b) =>
      Math.abs(
        a.time - (start.time + end.time) / 2
      ) -
      Math.abs(
        b.time - (start.time + end.time) / 2
      )
  );

// Use the actual solstice when it falls inside
// the season. Otherwise, place the temperature
// extreme at the season's midpoint.
const extremeTime =
  matching.length > 0
    ? matching[0].time
    : start.time + (end.time - start.time) / 2;

anchors.push({
  time: extremeTime,
  temperature:
    start.seasonId === 'winter'
      ? season.lowTemperature
      : season.highTemperature,
});
  }

  anchors.sort((a, b) => a.time - b.time);

  return { anchors };
}

/**
 * Interpolates smoothly between two temperature
 * anchors using a cosine curve.
 *
 * The result has zero slope at both endpoints.
 */
export function interpolateSeasonalTemperature(
  start: SeasonalTemperatureAnchor,
  end: SeasonalTemperatureAnchor,
  time: number
): number {
  if (
    !Number.isFinite(start.time) ||
    !Number.isFinite(end.time) ||
    !Number.isFinite(start.temperature) ||
    !Number.isFinite(end.temperature) ||
    !Number.isFinite(time) ||
    end.time <= start.time
  ) {
    throw new Error(
      'Invalid seasonal temperature interpolation.'
    );
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      (time - start.time) /
        (end.time - start.time)
    )
  );

  const weight =
    (1 - Math.cos(Math.PI * progress)) / 2;

  return (
    start.temperature +
    (end.temperature - start.temperature) *
      weight
  );
}

/**
 * Resolves the seasonal baseline temperature
 * from a chronologically ordered anchor profile.
 *
 * Outside the profile, the nearest endpoint
 * temperature is returned.
 */
export function getSeasonalBaselineTemperature(
  profile: SeasonalTemperatureProfile,
  time: number
): number {
  if (!Number.isFinite(time)) {
    throw new Error(
      'Seasonal temperature requires a finite time.'
    );
  }

  const anchors = profile.anchors;

  if (anchors.length === 0) {
    throw new Error(
      'Seasonal temperature profile is empty.'
    );
  }

  for (let index = 0; index < anchors.length; index++) {
    const anchor = anchors[index];

    if (
      !Number.isFinite(anchor.time) ||
      !Number.isFinite(anchor.temperature) ||
      (
        index > 0 &&
        anchor.time <= anchors[index - 1].time
      )
    ) {
      throw new Error(
        'Seasonal temperature profile has invalid anchors.'
      );
    }
  }

  if (time <= anchors[0].time) {
    return anchors[0].temperature;
  }

  const last = anchors[anchors.length - 1];

  if (time >= last.time) {
    return last.temperature;
  }

  for (let index = 1; index < anchors.length; index++) {
    const end = anchors[index];

    if (time <= end.time) {
      return interpolateSeasonalTemperature(
        anchors[index - 1],
        end,
        time
      );
    }
  }

  return last.temperature;
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

export interface DailyTemperature {
  worldDay: number;
  seasonalBaseline: number;
  dailySwing: number;
  mean: number;
  range: number;
  minimum: number;
  maximum: number;
}

export function calculateDailyTemperature(
  manager: TemperatureManager,
  profile: SeasonalTemperatureProfile,
  worldDay: number,
  secondsPerDay: number
): DailyTemperature {
  if (
    !Number.isSafeInteger(worldDay) ||
    !Number.isFinite(secondsPerDay) ||
    secondsPerDay <= 0
  ) {
    throw new Error(
      'Invalid daily temperature calculation input.'
    );
  }

  const midday =
    (worldDay + 0.5) * secondsPerDay;

  const seasonalBaseline =
    getSeasonalBaselineTemperature(
      profile,
      midday
    );

  const dailySwing =
    manager.getDailySwing(worldDay);

  const range =
    manager.getDailyTemperatureRange(worldDay);

  const mean =
    seasonalBaseline + dailySwing;

  return {
    worldDay,
    seasonalBaseline,
    dailySwing,
    mean,
    range,
    minimum: mean - range / 2,
    maximum: mean + range / 2,
  };
}

export interface CurrentTemperature {
  time: number;
  worldDay: number;
  dayFraction: number;
  temperature: number;
  dailyTemperature: DailyTemperature;
}

/**
 * Returns the temperature at any simulation time.
 *
 * Daily minimum: 06:00
 * Daily maximum: 15:00
 *
 * Temperatures between 15:00 and the next 06:00
 * cool smoothly toward the next day's minimum.
 */
export function calculateCurrentTemperature(
  manager: TemperatureManager,
  profile: SeasonalTemperatureProfile,
  time: number,
  secondsPerDay: number
): CurrentTemperature {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(secondsPerDay) ||
    secondsPerDay <= 0
  ) {
    throw new Error(
      'Invalid current temperature calculation input.'
    );
  }

  const worldDay = Math.floor(
    time / secondsPerDay
  );

  if (!Number.isSafeInteger(worldDay)) {
    throw new Error(
      'Temperature World day exceeds safe integer range.'
    );
  }

  const dayFraction = time / secondsPerDay - worldDay;

  const minimumTime = DAILY_MINIMUM_TIME;
  const maximumTime = DAILY_MAXIMUM_TIME;

  const today = calculateDailyTemperature(
    manager,
    profile,
    worldDay,
    secondsPerDay
  );

  let temperature: number;

  if (dayFraction < minimumTime) {
    // Continue cooling from yesterday's maximum
    // toward today's minimum.
    const yesterday = calculateDailyTemperature(
      manager,
      profile,
      worldDay - 1,
      secondsPerDay
    );

    temperature = interpolateSeasonalTemperature(
      {
        time: maximumTime - 1,
        temperature: yesterday.maximum,
      },
      {
        time: minimumTime,
        temperature: today.minimum,
      },
      dayFraction
    );
  } else if (dayFraction <= maximumTime) {
    // Warm from today's minimum to maximum.
    temperature = interpolateSeasonalTemperature(
      {
        time: minimumTime,
        temperature: today.minimum,
      },
      {
        time: maximumTime,
        temperature: today.maximum,
      },
      dayFraction
    );
  } else {
    // Cool from today's maximum toward
    // tomorrow's minimum.
    const tomorrow = calculateDailyTemperature(
      manager,
      profile,
      worldDay + 1,
      secondsPerDay
    );

    temperature = interpolateSeasonalTemperature(
      {
        time: maximumTime,
        temperature: today.maximum,
      },
      {
        time: 1 + minimumTime,
        temperature: tomorrow.minimum,
      },
      dayFraction
    );
  }

  return {
    time,
    worldDay,
    dayFraction,
    temperature,
    dailyTemperature: today,
  };
}
/**
 * Returns the whole-degree temperature adjustment
 * produced by a weather node's pressure.
 *
 * High pressure:
 *   -5°F at the daily minimum.
 *   +5°F at the daily maximum.
 *
 * Low pressure produces the opposite adjustment.
 * Neutral pressure produces no adjustment.
 *
 * dayFraction represents progress through a
 * SimClock day, normalized to [0, 1).
 */

export function getPressureTemperatureModifier(
  pressure: WeatherPressure,
  dayFraction: number
): number {
  if (
    (pressure !== -1 &&
      pressure !== 0 &&
      pressure !== 1) ||
    !Number.isFinite(dayFraction)
  ) {
    throw new Error(
      'Invalid pressure temperature modifier input.'
    );
  }

  if (pressure === 0) {
    return 0;
  }

  const fraction =
    ((dayFraction % 1) + 1) % 1;

  const minimumTime = DAILY_MINIMUM_TIME;
  const maximumTime = DAILY_MAXIMUM_TIME;

  let highPressureModifier: number;

  if (fraction < minimumTime) {
    highPressureModifier =
      interpolateSeasonalTemperature(
        {
          time: maximumTime - 1,
          temperature:
            MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        {
          time: minimumTime,
          temperature:
            -MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        fraction
      );
  } else if (fraction <= maximumTime) {
    highPressureModifier =
      interpolateSeasonalTemperature(
        {
          time: minimumTime,
          temperature:
            -MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        {
          time: maximumTime,
          temperature:
            MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        fraction
      );
  } else {
    highPressureModifier =
      interpolateSeasonalTemperature(
        {
          time: maximumTime,
          temperature:
            MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        {
          time: 1 + minimumTime,
          temperature:
            -MAX_PRESSURE_TEMPERATURE_MODIFIER,
        },
        fraction
      );
  }

  return Math.round(
    highPressureModifier * pressure
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

export function testCurrentTemperatureCalculation(): void {
  const manager = new TemperatureManager(
    createTemperatureSwingCycle(12345),
    createDailyTemperatureRangeCycle(67890)
  );

  const secondsPerDay = 86400;

  const profile: SeasonalTemperatureProfile = {
    anchors: [
      { time: -86400 * 10, temperature: 50 },
      { time: 86400 * 10, temperature: 70 },
    ],
  };

  const at = (day: number, hour: number) =>
    calculateCurrentTemperature(
      manager,
      profile,
      (day + hour / 24) * secondsPerDay,
      secondsPerDay
    ).temperature;

  const day = 2;

  const daily = calculateDailyTemperature(
    manager,
    profile,
    day,
    secondsPerDay
  );

  const minimum = at(day, 6);
  const maximum = at(day, 15);

  if (Math.abs(minimum - daily.minimum) > 1e-8) {
    throw new Error(
      'Temperature does not reach daily minimum at 06:00.'
    );
  }

  if (Math.abs(maximum - daily.maximum) > 1e-8) {
    throw new Error(
      'Temperature does not reach daily maximum at 15:00.'
    );
  }

  const midnight = at(day + 1, 0);

  const beforeMidnight = at(
    day,
    24 - 1 / 3600
  );

  if (Math.abs(midnight - beforeMidnight) > 0.01) {
    throw new Error(
      'Temperature is discontinuous at midnight.'
    );
  }

  const repeated = at(day, 12);

  if (repeated !== at(day, 12)) {
    throw new Error(
      'Current temperature is not deterministic.'
    );
  }

  const negativeDay = at(-2, 12);

  if (!Number.isFinite(negativeDay)) {
    throw new Error(
      'Negative World day temperature is invalid.'
    );
  }
}

export function testPressureTemperatureModifier(): void {
  const cases: Array<
    [WeatherPressure, number, number]
  > = [
    [1, 6 / 24, -5],
    [1, 15 / 24, 5],
    [-1, 6 / 24, 5],
    [-1, 15 / 24, -5],
    [0, 6 / 24, 0],
    [0, 15 / 24, 0],
  ];

  for (const [pressure, time, expected] of cases) {
    const actual =
      getPressureTemperatureModifier(
        pressure,
        time
      );

    if (actual !== expected) {
      throw new Error(
        `Pressure modifier mismatch: ${actual} !== ${expected}`
      );
    }
  }

  for (let i = 0; i < 1000; i++) {
    const fraction = i / 1000;

    const high =
      getPressureTemperatureModifier(
        1,
        fraction
      );

    const low =
      getPressureTemperatureModifier(
        -1,
        fraction
      );

    if (
      !Number.isInteger(high) ||
      !Number.isInteger(low) ||
      high !== -low ||
      Math.abs(high) > 5
    ) {
      throw new Error(
        'Invalid pressure modifier behavior.'
      );
    }
  }
}