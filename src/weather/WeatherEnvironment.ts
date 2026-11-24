export interface WeatherNamedDefinition {
  id: string;
  name: string;
}

export interface WeatherWeightedDefinition
  extends WeatherNamedDefinition {
  generationWeight: number;
  temperatureModifier?: number;
}

export interface WeatherTemperatureModifierDefinition
  extends WeatherWeightedDefinition {
  temperatureModifier?: number;
}

export interface WeatherSeasonDefinition
  extends WeatherNamedDefinition {
  lowTemperature: number;
  highTemperature: number;
  generationWeight?: number;
}

export interface WeatherWindStrengthDefinition
  extends WeatherTemperatureModifierDefinition {
  minimumSpeed: number;
  maximumSpeed: number;
}

export interface WeatherWindDirectionDefinition
  extends WeatherNamedDefinition {
  degrees: number;
}

export interface WeatherSpecialDefinition
  extends WeatherWeightedDefinition {
  description?: string;
  requirements: {
    conditionId: string;
    operator: string;
    value: string | number | boolean;
  }[];
  effects: {
    conditionId: string;
    value: string | number | boolean;
  }[];
}

export interface WeatherWeightVector {
  targetId: string;
  delta: number;
}

export interface WeatherSeasonWeights {
  seasonId: string;
  visibility: WeatherWeightVector[];
  cloudCover: WeatherWeightVector[];
  precipitation: WeatherWeightVector[];
  windStrength: WeatherWeightVector[];
  specialWeather: WeatherWeightVector[];
}

export interface WeatherEnvironmentDefinitions {
  seasons: WeatherSeasonDefinition[];

  temperature: {
    unit: 'fahrenheit' | 'celsius';
    rainSnowThreshold: number;
  };

visibility: WeatherWeightedDefinition[];
cloudCover: WeatherTemperatureModifierDefinition[];
precipitation: WeatherTemperatureModifierDefinition[];
windStrength: WeatherWindStrengthDefinition[];
  windDirections: WeatherWindDirectionDefinition[];
  specialWeather: WeatherSpecialDefinition[];

  generation?: {
    enabled: boolean;
    minimumUpdateMinutes: number;
    maximumUpdateMinutes: number;
    seasonalWeightVectors?: WeatherSeasonWeights[];
  };
}

export interface WeatherEnvironmentSnapshot {
  definitions: WeatherEnvironmentDefinitions | undefined;
  overrides: {
    seasonalWeightVectors?: WeatherSeasonWeights[];
  };
  seasonId?: string;
}