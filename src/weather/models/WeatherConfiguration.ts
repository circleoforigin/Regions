
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
    width: 50,
    height: 50,
    nodeSpacingMiles: 20,
  },

  movement: {
    stepsPerDay: 6,
    directionCycleLength: 256,
  },

  transitions: {
    cycleLength: 256,
  },
};
