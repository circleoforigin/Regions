/**
 * Reusable atmospheric value blending.
 *
 * This module does not generate weather, classify
 * weather conditions, resolve Areas, or calculate
 * wind direction.
 */

export interface WeatherValues {
  temperature: number;
  visibility: number;
  cloudCover: number;
  precipitation: number;
  windStrength: number;
}

export interface WeatherNodeSample {
  nodeX: number;
  nodeY: number;
  values: WeatherValues;
}

export interface WeightedWeatherNode {
  node: WeatherNodeSample;
  weight: number;
}

export type WeatherBlendPattern =
  | 'single'
  | 'horizontal-near'
  | 'horizontal-center'
  | 'diagonal'
  | 'triangle-near'
  | 'triangle-center';

export const WEATHER_BLEND_WEIGHTS: Record<
  WeatherBlendPattern,
  readonly number[]
> = {
  single: [1],
  'horizontal-near': [0.75, 0.25],
  'horizontal-center': [0.5, 0.5],
  diagonal: [0.66, 0.34],
  'triangle-near': [0.7, 0.15, 0.15],
  'triangle-center': [0.36, 0.32, 0.32],
};

const WEATHER_VALUE_KEYS = [
  'temperature',
  'visibility',
  'cloudCover',
  'precipitation',
  'windStrength',
] as const satisfies readonly (keyof WeatherValues)[];

/**
 * Associates nodes with a selected influence
 * pattern.
 *
 * Node ordering is significant:
 *
 * - Two nodes: dominant node first.
 * - Three nodes: triangle apex first.
 *
 * The caller may reverse two-node ordering to
 * represent the opposite side of a connection.
 */
export function createWeightedWeatherNodes(
  nodes: readonly WeatherNodeSample[],
  pattern: WeatherBlendPattern
): WeightedWeatherNode[] {
  const weights = WEATHER_BLEND_WEIGHTS[pattern];

  if (nodes.length !== weights.length) {
    throw new Error(
      `Weather blend ${pattern} requires ` +
      `${weights.length} nodes; received ${nodes.length}.`
    );
  }

  return nodes.map((node, index) => ({
    node,
    weight: weights[index],
  }));
}

/**
 * Blends all five atmospheric values in one pass.
 *
 * Intermediate results are deliberately not
 * rounded or classified.
 */
export function blendWeatherValues(
  influences: readonly WeightedWeatherNode[]
): WeatherValues {
  if (
    influences.length < 1 ||
    influences.length > 3
  ) {
    throw new Error(
      'Weather blending requires one to three nodes.'
    );
  }

  const totalWeight = influences.reduce(
    (total, influence) => {
      if (
        !Number.isFinite(influence.weight) ||
        influence.weight < 0
      ) {
        throw new Error(
          'Invalid weather node influence weight.'
        );
      }

      return total + influence.weight;
    },
    0
  );

  if (Math.abs(totalWeight - 1) > 1e-9) {
    throw new Error(
      'Weather node influence weights must total 1.'
    );
  }

  const result: WeatherValues = {
    temperature: 0,
    visibility: 0,
    cloudCover: 0,
    precipitation: 0,
    windStrength: 0,
  };

  for (const influence of influences) {
    for (const key of WEATHER_VALUE_KEYS) {
      const value = influence.node.values[key];

      if (!Number.isFinite(value)) {
        throw new Error(
          `Invalid ${key} value at weather node ` +
          `(${influence.node.nodeX}, ` +
          `${influence.node.nodeY}).`
        );
      }

      result[key] += value * influence.weight;
    }
  }

  return result;
}

/**
 * Convenience operation for callers that have
 * already identified the contributing nodes
 * and the applicable blending pattern.
 */
export function calculateBlendedWeather(
  nodes: readonly WeatherNodeSample[],
  pattern: WeatherBlendPattern
): WeatherValues {
  return blendWeatherValues(
    createWeightedWeatherNodes(nodes, pattern)
  );
}
