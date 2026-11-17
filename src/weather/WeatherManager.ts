
import type {
  WeatherConfiguration,
} from './models/WeatherConfiguration';

import type {
  WeatherPressureField,
} from './generation/WeatherPressureFieldGenerator';

import type {
  WeatherWindField,
} from './generation/WeatherWindGenerator';

import type {
  WeatherMovementCycle,
} from './WeatherMovementCycle';

import type {
  WeatherEnvironmentSnapshot,
} from './WeatherEnvironment';

import {
  TemperatureManager,
  type SeasonalTemperatureProfile,
  type CurrentTemperature,
  calculateCurrentTemperature,
} from './TemperatureManager';

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
   * Future primary weather calculation entry point:
   *
   * getSectorWeather(sector, time)
   *
   * This will resolve contributing nodes,
   * blend their five weather values, apply
   * Zone/Area effects, and finalize the result.
   *
   * It is intentionally not implemented until
   * sector-to-node geometry is connected.
   */
}
