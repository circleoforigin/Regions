export interface WeatherConfiguration
{
  seed: number;

  plane: {
    width: number;
    height: number;
    nodeSpacingMiles: number;
  };

  movement: {
    stepsPerDay: number;
    directionCycleLength: number;
  };

  transitions: {
    cycleLength: number;
  };
}

export const DEFAULT_WEATHER_CONFIGURATION:
  WeatherConfiguration =
{
  seed: 1,

  plane: {
    width: 100,
    height: 100,
    nodeSpacingMiles: 10,
  },

  movement: {
    stepsPerDay: 4,
    directionCycleLength: 256,
  },

  transitions: {
    cycleLength: 256,
  },
};