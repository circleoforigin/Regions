
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

export interface WeatherManagerState {
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
