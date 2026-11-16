
import {
  deriveSeed,
} from '@settingforge/module-sdk';

import {
  DEFAULT_WEATHER_CONFIGURATION,
  type WeatherConfiguration,
} from './models/WeatherConfiguration';

export interface WeatherSeeds {
  movement: number;
  transitions: number;
  temperature: number;
  dailyTemperatureRange: number;
}

export function deriveWeatherSeeds(
  worldSeed: number
): WeatherSeeds
{
  return {
    movement: deriveSeed(
      worldSeed,
      'weather.movement'
    ),

    transitions: deriveSeed(
      worldSeed,
      'weather.transitions'
    ),

    temperature: deriveSeed(
        worldSeed,
        'weather.temperature'
    ),

    dailyTemperatureRange: deriveSeed(
        worldSeed,
        'weather.daily-temperature-range'
    ),
  };
}

export function createWorldWeatherConfiguration(
  worldSeed: number
): WeatherConfiguration
{
  const seeds = deriveWeatherSeeds(
    worldSeed
  );

  return {
    ...DEFAULT_WEATHER_CONFIGURATION,

    seed: seeds.movement,
  };
}
