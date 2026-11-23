
import type { WeatherConfiguration } from './models/WeatherConfiguration';
import type { WeatherPressureField } from './generation/WeatherPressureFieldGenerator';
import type { WeatherWindField } from './generation/WeatherWindGenerator';
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
import { getWeatherNodePressure } from './generation/WeatherPressureFieldGenerator';
import { resolveSectorNodeInfluences } from './generation/WeatherNodeInfluenceResolver';
import {
  createWeatherTransitionCycle,
  getWeatherTransitionPosition,
  type WeatherTransitionCycle,
} from './WeatherTransitionCycle';
import {
  createSeededRandom,
  deriveSeed,
} from '@settingforge/module-sdk';
import {
  deriveWeatherSeeds,
} from './WeatherSeedConfiguration';
import {
  createWeatherProbabilityCharts,
  generateWeatherNodeMidpointTarget,
  type WeatherNodeMidpointTarget,
  type WeatherProbabilityCharts,
} from './generation/WeatherConditionGenerator';

export interface WeatherTimeDefinition {
  secondsPerMinute: number;
  minutesPerHour: number;
  hoursPerDay: number;
}

export interface WeatherManagerState {
  worldSeed: number;
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

export interface SectorWeatherResult {
  sector: SectorAddress;
  time: number;

  /**
   * Raw atmospheric values after node blending.
   * Zone and Area modifiers are not yet applied.
   */
  blended: WeatherValues;

  /**
   * Current numeric sector weather values.
   * Initially identical to blended.
   *
   * Later, Zone and Area processing will
   * modify these before finalization.
   */
  values: WeatherValues;
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

public getNodeMidpointTarget(
  nodeX: number,
  nodeY: number,
  time: number = this.state.time
): WeatherNodeMidpointTarget {
  const {
    worldSeed,
    configuration,
    secondsPerDay,
  } = this.state;

  if (
    !Number.isFinite(time) ||
    !Number.isFinite(secondsPerDay) ||
    secondsPerDay <= 0
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

  // The Weather Plane wraps around.
  const x = ((nodeX % width) + width) % width;
  const y = ((nodeY % height) + height) % height;

  const schedule =
    createWeatherNodeTransitionSchedule(
      worldSeed,
      x,
      y
    );

  // Existing transition schedules use
  // 1440 nominal minutes per world day.
const elapsedMinutes =
  time / this.state.timeDefinition.secondsPerMinute;

  return getWeatherNodeMidpointTarget(
    worldSeed,
    schedule,
    elapsedMinutes
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
  const {
    configuration,
    movementCycle,
    pressureField,
    secondsPerDay,
  } = this.state;

  const baseline =
    this.getCurrentTemperature(time).temperature;

  const { influences } =
    resolveSectorNodeInfluences(
      sector,
      time,
      secondsPerDay,
      configuration,
      movementCycle
    );

  const dayFraction =
    ((time / secondsPerDay) % 1 + 1) % 1;

  let modifier = 0;

  for (const influence of influences) {
    const pressure = getWeatherNodePressure(
      pressureField,
      influence.nodeX,
      influence.nodeY
    );

    modifier +=
      getPressureTemperatureModifier(
        pressure,
        dayFraction
      ) * influence.weight;
  }

  return baseline + modifier;
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
 * Calculates all five weather properties for
 * a sector from its contributing weather nodes.
 *
 * Node selection and influence calculation
 * are performed by the geometry resolver.
 *
 * Zone and Area processing will be inserted
 * after blending in a future implementation.
 */
public getSectorWeather(
  sector: SectorAddress,
  influences: readonly WeightedWeatherNode[],
  time: number = this.state.time
): SectorWeatherResult {
  if (!Number.isFinite(time)) {
    throw new Error(
      'Invalid sector weather simulation time.'
    );
  }

  const blended = blendWeatherValues(influences);

  return {
    sector: { ...sector },
    time,
    blended,
    values: { ...blended },
  };
}
}

export interface WeatherNodeTransitionSchedule {
  nodeX: number;
  nodeY: number;
  cycle: WeatherTransitionCycle;
}

const MINUTES_PER_DAY = 1440;
const MINIMUM_SPACING_MINUTES = 180;

export function createWeatherNodeTransitionSchedule(
  worldSeed: number,
  nodeX: number,
  nodeY: number
): WeatherNodeTransitionSchedule {
  if (
    !Number.isSafeInteger(nodeX) ||
    !Number.isSafeInteger(nodeY)
  ) {
    throw new Error(
      'Invalid Weather Node coordinates.'
    );
  }

  const transitionSeed =
    deriveWeatherSeeds(worldSeed).transitions;

  const nodeSeed = deriveSeed(
    transitionSeed,
    `node.${nodeX}.${nodeY}.schedule`
  );

  const random = createSeededRandom(nodeSeed);

  // One, two, or three transitions daily.
  const transitionCount =
    Math.floor(random() * 3) + 1;

  const spacing =
    MINUTES_PER_DAY / transitionCount;

  if (spacing < MINIMUM_SPACING_MINUTES) {
    throw new Error(
      'Weather transition spacing is too short.'
    );
  }

  const minuteOfDay = Array.from(
    { length: transitionCount },
    (_, index) => Math.floor(index * spacing)
  );

  return {
    nodeX,
    nodeY,
    cycle: createWeatherTransitionCycle(
      minuteOfDay
    ),
  };
}

export function getWeatherNodeMidpointTarget(
  worldSeed: number,
  schedule: WeatherNodeTransitionSchedule,
  elapsedMinutes: number
): WeatherNodeMidpointTarget {
  const position = getWeatherTransitionPosition(
    schedule.cycle,
    elapsedMinutes
  );

  return generateWeatherNodeMidpointTarget(
    worldSeed,
    schedule.nodeX,
    schedule.nodeY,
    position.index
  );
}
