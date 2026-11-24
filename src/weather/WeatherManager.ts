import type { WeatherConfiguration } from './models/WeatherConfiguration';
import type { WeatherPressureField } from './generation/WeatherPressureFieldGenerator';
import {
  getAtmosphericWindDirection,
  resolveWeatherWindSpeed,
  type WeatherWindField,
  type WeatherResolvedWind,
} from './generation/WeatherWindGenerator';
import type { WeatherMovementCycle } from './WeatherMovementCycle';
import type { WeatherEnvironmentSnapshot } from './WeatherEnvironment';
import {
  TemperatureManager,
  type SeasonalTemperatureProfile,
  type CurrentTemperature,
  calculateCurrentTemperature,
} from './TemperatureManager';
import type { SectorAddress } from '../spatial/Sector';
import {
  blendWeatherValues,
  type WeatherValues,
  type WeightedWeatherNode,
} from './generation/WeatherNodeInfluenceResolver';
import { getPressureTemperatureModifier } from './TemperatureManager';
import {
  getWeatherNodePressure,
  getPressureConditionModifier,
} from './generation/WeatherPressureFieldGenerator';
import {
  resolveSectorNodeInfluences,
  getWeatherPlaneSector,
} from './generation/WeatherNodeInfluenceResolver';
import {
  getWeatherTransitionPosition,
  type WeatherTransitionCycle,
} from './WeatherTransitionCycle';
import { createSeededRandom } from '@settingforge/module-sdk';
import { deriveWeatherSeeds } from './WeatherSeedConfiguration';
import {
  createWeatherProbabilityCharts,
  generateWeatherNodeMidpointTarget,
  interpolateWeatherConditionRolls,
  finalizeWeatherConditionRolls,
  resolveWeatherConditions,
  getWeatherConditionTemperatureModifier,
  type WeatherConditionRolls,
  type WeatherNodeMidpointTarget,
  type WeatherProbabilityCharts,
  type WeatherResolvedConditions,
} from './generation/WeatherConditionGenerator';

export interface WeatherTimeDefinition {
  secondsPerMinute: number;
  minutesPerHour: number;
  hoursPerDay: number;
}

/**
 * Returns the duration of one Weather
 * UpdateInterval in simulation seconds.
 */
export function getWeatherUpdateIntervalSeconds(
  timeDefinition: WeatherTimeDefinition,
  updatesPerHour: number
): number {
  const {
    secondsPerMinute,
    minutesPerHour,
  } = timeDefinition;

  if (
    !Number.isSafeInteger(updatesPerHour) ||
    updatesPerHour <= 0 ||
    !Number.isFinite(secondsPerMinute) ||
    secondsPerMinute <= 0 ||
    !Number.isFinite(minutesPerHour) ||
    minutesPerHour <= 0
  ) {
    throw new Error(
      'Invalid Weather UpdateInterval configuration.'
    );
  }

  return (
    secondsPerMinute * minutesPerHour
  ) / updatesPerHour;
}

/**
 * Returns the absolute UpdateInterval
 * containing the supplied simulation time.
 */
export function getWeatherUpdateIntervalIndex(
  time: number,
  intervalSeconds: number
): number {
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds <= 0
  ) {
    throw new Error(
      'Invalid Weather UpdateInterval time.'
    );
  }

  return Math.floor(
    time / intervalSeconds
  );
}

/**
 * Returns the next Weather UpdateInterval
 * boundary strictly after the supplied time.
 */
export function getNextWeatherUpdateTime(
  time: number,
  intervalSeconds: number
): number {
  const currentInterval =
    getWeatherUpdateIntervalIndex(
      time,
      intervalSeconds
    );

  return (
    currentInterval + 1
  ) * intervalSeconds;
}

export interface WeatherManagerState {
  worldSeed: number;
  transitionCycle: WeatherTransitionCycle;
  timeDefinition: WeatherTimeDefinition;
  configuration: WeatherConfiguration;
  movementCycle: WeatherMovementCycle;
  pressureField: WeatherPressureField;
  windField: WeatherWindField;
  environment: WeatherEnvironmentSnapshot | null;
  temperatureManager: TemperatureManager;
  seasonalTemperatureProfile: SeasonalTemperatureProfile;
  time: number;
  secondsPerDay: number;
}

export type WeatherPrecipitationType =
  | 'rain'
  | 'snow';

export interface SectorWeatherResult {
  sector: SectorAddress;
  time: number;

  /**
   * Raw values after Weather Node blending.
   */
  blended: WeatherValues;

  /**
   * Finalized numeric weather values after
   * applicable modifiers and roll clamping.
   */
  values: WeatherValues;

  /**
   * Resolved atmospheric conditions.
   *
   * Null when Ruleset weather definitions
   * are unavailable.
   */
  conditions: WeatherResolvedConditions | null;

  /**
   * Current wind direction and
   * descriptive numerical speed.
   */
  wind: WeatherResolvedWind;
  precipitationType: WeatherPrecipitationType | null;
}

/**
 * Top-level controller for SettingForge weather.
 *
 * Owns the calculation interface used by Regions,
 * tracked pieces, overlays, and simulation systems.
 *
 * React hooks are responsible for acquiring state.
 * WeatherManager is responsible for calculations.
 */
export class WeatherManager {
  private state: WeatherManagerState;

  constructor(state: WeatherManagerState) {
    this.state = state;
  }

  public getProbabilityCharts():
  WeatherProbabilityCharts | null {
  const environment = this.state.environment;

  if (!environment?.definitions) {
    return null;
  }

  return createWeatherProbabilityCharts(
    environment.definitions,
    environment.seasonId
  );
}

public getUpdateIntervalSeconds(): number {
  return getWeatherUpdateIntervalSeconds(
    this.state.timeDefinition,
    this.state.configuration.transitions
      .updatesPerHour
  );
}

public getUpdateIntervalIndex(
  time: number = this.state.time
): number {
  return getWeatherUpdateIntervalIndex(
    time,
    this.getUpdateIntervalSeconds()
  );
}

public getNextUpdateTime(
  time: number = this.state.time
): number {
  return getNextWeatherUpdateTime(
    time,
    this.getUpdateIntervalSeconds()
  );
}

public getNodeMidpointTarget(
  nodeX: number,
  nodeY: number,
  time: number = this.state.time
): WeatherNodeMidpointTarget {
  const {
    worldSeed,
    configuration,
    timeDefinition,
    transitionCycle,
  } = this.state;

  if (
    !Number.isFinite(time) ||
    !Number.isFinite(timeDefinition.secondsPerMinute) ||
    timeDefinition.secondsPerMinute <= 0
  ) {
    throw new Error(
      'Invalid Weather simulation time.'
    );
  }

  const width = configuration.plane.width;
  const height = configuration.plane.height;

  if (
    !Number.isSafeInteger(nodeX) ||
    !Number.isSafeInteger(nodeY) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Invalid Weather Node coordinates.'
    );
  }

  const x = ((nodeX % width) + width) % width;
  const y = ((nodeY % height) + height) % height;

  const elapsedIntervals = this.getUpdateIntervalIndex(time);

  return getWeatherNodeMidpointTarget(
    worldSeed,
    x,
    y,
    transitionCycle,
    elapsedIntervals
  );
}

/**
 * Returns the current atmospheric rolls
 * for a Weather Node at an arbitrary
 * simulation time.
 *
 * Weather rolls change exclusively at
 * UpdateInterval boundaries.
 */
public getNodeWeatherRolls(
  nodeX: number,
  nodeY: number,
  time: number = this.state.time
): WeatherConditionRolls {
  const {
    worldSeed,
    transitionCycle,
  } = this.state;

  const currentInterval =
    this.getUpdateIntervalIndex(time);

  const currentPosition =
    getWeatherTransitionPosition(
      transitionCycle,
      currentInterval
    );

  const currentTarget =
    this.getNodeMidpointTarget(
      nodeX,
      nodeY,
      time
    );

  // At the midpoint, every property has
  // reached its generated target.
  if (
    currentInterval ===
    currentPosition.midpointInterval
  ) {
    return { ...currentTarget.rolls };
  }

  // Before the current midpoint, move
  // from the previous midpoint target
  // toward the current midpoint target.
  if (
    currentInterval <
    currentPosition.midpointInterval
  ) {
    const previousPosition =
      getWeatherTransitionPosition(
        transitionCycle,
        currentPosition.startInterval - 1
      );

    const previousTarget =
      generateWeatherNodeMidpointTarget(
        worldSeed,
        currentTarget.nodeX,
        currentTarget.nodeY,
        previousPosition.index
      );

    const totalUpdateIntervals =
      currentPosition.midpointInterval -
      previousPosition.midpointInterval;

    const elapsedUpdateIntervals =
      currentInterval -
      previousPosition.midpointInterval;

    return interpolateWeatherConditionRolls(
      previousTarget.rolls,
      currentTarget.rolls,
      totalUpdateIntervals,
      elapsedUpdateIntervals
    );
  }

  // After the current midpoint, move
  // toward the next midpoint target.
  const nextPosition =
    getWeatherTransitionPosition(
      transitionCycle,
      currentPosition.endInterval
    );

  const nextTarget =
    generateWeatherNodeMidpointTarget(
      worldSeed,
      currentTarget.nodeX,
      currentTarget.nodeY,
      nextPosition.index
    );

  const totalUpdateIntervals =
    nextPosition.midpointInterval -
    currentPosition.midpointInterval;

  const elapsedUpdateIntervals =
    currentInterval -
    currentPosition.midpointInterval;

  return interpolateWeatherConditionRolls(
    currentTarget.rolls,
    nextTarget.rolls,
    totalUpdateIntervals,
    elapsedUpdateIntervals
  );
}

  public update(state: WeatherManagerState): void {
    this.state = state;
  }

  public getState(): Readonly<WeatherManagerState> {
    return this.state;
  }

  public getCurrentTemperature(
    time: number = this.state.time
  ): CurrentTemperature {
    return calculateCurrentTemperature(
      this.state.temperatureManager,
      this.state.seasonalTemperatureProfile,
      time,
      this.state.secondsPerDay
    );
  }

public getSectorTemperature(
  sector: SectorAddress,
  time: number = this.state.time
): number {
  return this.getSectorWeather(
    sector,
    time
  ).values.temperature;
}

public getTemperatureAtSector(
  worldMapId: string,
  sectorX: number,
  sectorY: number,
  time: number = this.state.time
): number {
  return this.getSectorTemperature(
    {
      worldMapId,
      x: sectorX,
      y: sectorY,
    },
    time
  );
}

/**
 * Resolves wind direction from the
 * moving Weather Plane and numerical
 * speed from the resolved wind strength.
 */
public getSectorWind(
  sector: SectorAddress,
  windStrengthRoll: number,
  windStrength:
    WeatherResolvedConditions['windStrength'] | null,
  time: number = this.state.time
): WeatherResolvedWind {
  const {
    configuration,
    movementCycle,
    windField,
    secondsPerDay,
    environment,
  } = this.state;

  const planeSector =
    getWeatherPlaneSector(
      sector,
      time,
      secondsPerDay,
      configuration,
      movementCycle
    );

  const direction =
    getAtmosphericWindDirection(
      windField,
      planeSector.x,
      planeSector.y
    );

  const definition = windStrength
    ? environment?.definitions
        ?.windStrength.find(
          entry =>
            entry.id === windStrength.id
        )
    : undefined;

  const speed =
    windStrength && definition
      ? resolveWeatherWindSpeed(
          windStrengthRoll,
          windStrength,
          definition
        )
      : null;

  return {
    direction,
    speed,
  };
}

/**
 * Determines precipitation type using
 * the Ruleset's rain/snow threshold.
 */
public getPrecipitationType(
  temperature: number
): WeatherPrecipitationType | null {
  const threshold =
    this.state.environment
      ?.definitions
      ?.temperature
      .rainSnowThreshold;

  if (threshold === undefined) {
    return null;
  }

  return temperature <= threshold
    ? 'snow'
    : 'rain';
}

/**
 * Calculates the current numeric weather
 * values for a world Sector.
 *
 * Weather Plane movement and atmospheric
 * UpdateIntervals are resolved independently.
 *
 * Area and Zone modifiers will be applied
 * after node blending.
 */
public getSectorWeather(
  sector: SectorAddress,
  time: number = this.state.time
): SectorWeatherResult {
  if (!Number.isFinite(time)) {
    throw new Error(
      'Invalid sector weather simulation time.'
    );
  }

  const {
    configuration,
    movementCycle,
    pressureField,
    secondsPerDay,
  } = this.state;

  const { influences } =
    resolveSectorNodeInfluences(
      sector,
      time,
      secondsPerDay,
      configuration,
      movementCycle
    );

  const baselineTemperature =
    this.getCurrentTemperature(time).temperature;

  const dayFraction =
    ((time / secondsPerDay) % 1 + 1) % 1;

  let pressureConditionModifier = 0;
  const weightedNodes: WeightedWeatherNode[] =
    influences.map(influence => {
      const {
        nodeX,
        nodeY,
        weight,
      } = influence;

      const rolls =
        this.getNodeWeatherRolls(
          nodeX,
          nodeY,
          time
        );

      const pressure =
        getWeatherNodePressure(
          pressureField,
          nodeX,
          nodeY
        );

      pressureConditionModifier +=
        getPressureConditionModifier(
            pressure
        ) * weight;

      const temperature =
        baselineTemperature +
        getPressureTemperatureModifier(
          pressure,
          dayFraction
        );

      return {
        node: {
          nodeX,
          nodeY,
          values: {
            temperature,
            ...rolls,
          },
        },
        weight,
      };
    });

const blended =
  blendWeatherValues(weightedNodes);

const modifiedRolls: WeatherConditionRolls = {
  visibility:
    blended.visibility,

  cloudCover:
    blended.cloudCover +
    pressureConditionModifier,

  precipitation:
    blended.precipitation +
    pressureConditionModifier,

  windStrength:
    blended.windStrength,
};

const finalizedRolls =
  finalizeWeatherConditionRolls(
    modifiedRolls
  );

const charts =
  this.getProbabilityCharts();

const conditions = charts
  ? resolveWeatherConditions(
      finalizedRolls,
      charts
    )
  : null;

const definitions =
  this.state.environment?.definitions;

const temperatureModifier =
  conditions && definitions
    ? getWeatherConditionTemperatureModifier(conditions)
    : 0;

const values: WeatherValues = {
  temperature:
    blended.temperature +
    temperatureModifier,

  ...finalizedRolls,
};

const wind =
  this.getSectorWind(
    sector,
    finalizedRolls.windStrength,
    conditions?.windStrength ?? null,
    time
  );

const precipitationType =
  this.getPrecipitationType(
    values.temperature
  );

return {
  sector: { ...sector },
  time,
  blended,
  values,
  conditions,
  wind,
  precipitationType,
};
}
}

/**
 * Creates one repeating transition schedule
 * shared by every Weather Node.
 *
 * Time units come exclusively from SimClock.
 */

export function createGlobalWeatherTransitionCycle(
  worldSeed: number,
  timeDefinition: WeatherTimeDefinition,
  transitionCount: number,
  updatesPerHour: number
): WeatherTransitionCycle {
  const intervalsPerDay =
    timeDefinition.hoursPerDay *
    updatesPerHour;

  // Minimum separation of three
  // SimClock hours.
  const minimumSpacing =
    updatesPerHour * 3;

  if (
    !Number.isSafeInteger(updatesPerHour) ||
    updatesPerHour <= 0 ||
    !Number.isSafeInteger(intervalsPerDay) ||
    !Number.isSafeInteger(minimumSpacing) ||
    intervalsPerDay < minimumSpacing ||
    !Number.isSafeInteger(transitionCount) ||
    transitionCount <= 0
  ) {
    throw new Error(
      'Invalid Weather transition configuration.'
    );
  }

  const maximumDailyTransitions = Math.min(
    3,
    Math.floor(
      intervalsPerDay / minimumSpacing
    )
  );

  const random = createSeededRandom(
    deriveWeatherSeeds(worldSeed).transitions
  );

  const offsets: number[] = [];
  let day = 0;

  while (offsets.length < transitionCount) {
    const dailyCount =
      1 + Math.floor(
        random() * maximumDailyTransitions
      );

    const slots = Array.from(
      { length: maximumDailyTransitions },
      (_, index) => index
    );

    // Fisher-Yates shuffle.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(
        random() * (i + 1)
      );

      [slots[i], slots[j]] = [
        slots[j],
        slots[i],
      ];
    }

    const selectedSlots =
      day === 0
        ? [
            0,
            ...slots
              .filter(slot => slot !== 0)
              .slice(0, dailyCount - 1),
          ]
        : slots.slice(0, dailyCount);

    selectedSlots.sort((a, b) => a - b);

    const slotWidth =
      intervalsPerDay /
      maximumDailyTransitions;

    for (const slot of selectedSlots) {
      if (offsets.length >= transitionCount) {
        break;
      }

      const slotStart = Math.floor(
        slot * slotWidth
      );

      const slotEnd = Math.floor(
        (slot + 1) * slotWidth
      );

      const maximumVariation =
        slotEnd -
        slotStart -
        minimumSpacing;

      const variation =
        day === 0 && slot === 0
          ? 0
          : Math.floor(
              random() *
              (maximumVariation + 1)
            );

      offsets.push(
        day * intervalsPerDay +
        slotStart +
        variation
      );
    }

    day++;
  }

  return {
    offsets,
    durationIntervals:
      day * intervalsPerDay,
  };
}

/**
 * Resolves a node's deterministic midpoint
 * target using the shared transition cycle.
 */
export function getWeatherNodeMidpointTarget(
  worldSeed: number,
  nodeX: number,
  nodeY: number,
  cycle: WeatherTransitionCycle,
  elapsedIntervals: number
): WeatherNodeMidpointTarget {
  const position = getWeatherTransitionPosition(
    cycle,
    elapsedIntervals
  );

  return generateWeatherNodeMidpointTarget(
    worldSeed,
    nodeX,
    nodeY,
    position.index
  );
}