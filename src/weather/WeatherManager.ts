
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
  getWeatherTransitionPosition,
  type WeatherTransitionCycle,
} from './WeatherTransitionCycle';
import { createSeededRandom } from '@settingforge/module-sdk';
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

  const elapsedMinutes =
    time / timeDefinition.secondsPerMinute;

  return getWeatherNodeMidpointTarget(
    worldSeed,
    x,
    y,
    transitionCycle,
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


/**
 * Creates one repeating transition schedule
 * shared by every Weather Node.
 *
 * Time units come exclusively from SimClock.
 */
export function createGlobalWeatherTransitionCycle(
  worldSeed: number,
  timeDefinition: WeatherTimeDefinition,
  transitionCount: number
): WeatherTransitionCycle {
  const {
    minutesPerHour,
    hoursPerDay,
  } = timeDefinition;

  const minutesPerDay =
    minutesPerHour * hoursPerDay;

  const minimumSpacing =
    minutesPerHour * 3;

  if (
    !Number.isSafeInteger(minutesPerDay) ||
    !Number.isSafeInteger(minimumSpacing) ||
    minimumSpacing <= 0 ||
    minutesPerDay < minimumSpacing ||
    !Number.isSafeInteger(transitionCount) ||
    transitionCount <= 0
  ) {
    throw new Error(
      'Invalid SimClock weather transition configuration.'
    );
  }

  // A shorter day may not accommodate
  // three transitions.
  const maximumDailyTransitions = Math.min(
    3,
    Math.floor(minutesPerDay / minimumSpacing)
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

    // Divide the day into evenly spaced
    // candidate slots, then select a subset.
    const slots = Array.from(
      { length: maximumDailyTransitions },
      (_, index) => index
    );

    // Fisher-Yates shuffle.
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));

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
      minutesPerDay / maximumDailyTransitions;

    const maximumVariation = Math.max(
      0,
      Math.floor(
        (slotWidth - minimumSpacing) / 2
      )
    );

    for (const slot of selectedSlots) {
      if (offsets.length >= transitionCount) {
        break;
      }

      const variation =
        day === 0 && slot === 0
          ? 0
          : Math.floor(
              random() * (maximumVariation + 1)
            );

      const minuteOfDay =
        Math.floor(slot * slotWidth) +
        variation;

      offsets.push(
        day * minutesPerDay + minuteOfDay
      );
    }

    day++;
  }

  return {
    offsets,
    durationMinutes: day * minutesPerDay,
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
  elapsedMinutes: number
): WeatherNodeMidpointTarget {
  const position = getWeatherTransitionPosition(
    cycle,
    elapsedMinutes
  );

  return generateWeatherNodeMidpointTarget(
    worldSeed,
    nodeX,
    nodeY,
    position.index
  );
}
