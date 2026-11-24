import {
  createSeededRandom,
  deriveSeed,
} from '@settingforge/module-sdk';
import type {
  WeatherEnvironmentDefinitions,
  WeatherWeightedDefinition,
  WeatherWeightVector,
  WeatherSeasonWeights,
} from '../WeatherEnvironment';

export interface WeatherConditionRolls {
  visibility: number;
  cloudCover: number;
  precipitation: number;
  windStrength: number;
}

export interface WeatherProbabilityEntry {
  id: string;
  name: string;
  index: number;
  weight: number;
  percentage: number;
  cumulativePercentage: number;
}

export type WeatherProbabilityChart =
  WeatherProbabilityEntry[];

export interface WeatherProbabilityCharts {
  visibility: WeatherProbabilityChart;
  cloudCover: WeatherProbabilityChart;
  precipitation: WeatherProbabilityChart;
  windStrength: WeatherProbabilityChart;
}

export interface WeatherResolvedConditions {
  visibility: WeatherProbabilityEntry;
  cloudCover: WeatherProbabilityEntry;
  precipitation: WeatherProbabilityEntry;
  windStrength: WeatherProbabilityEntry;
}

export interface WeatherNodeMidpointTarget {
  nodeX: number;
  nodeY: number;
  transitionIndex: number;
  rolls: WeatherConditionRolls;
}

/**
 * Builds a cumulative percentage chart.
 *
 * Definition order is preserved because its
 * indices determine weather severity.
 *
 * Seasonal weight deltas are additive.
 */
export function createWeatherProbabilityChart(
  definitions: readonly WeatherWeightedDefinition[],
  modifiers: readonly WeatherWeightVector[] = []
): WeatherProbabilityChart {
  if (definitions.length === 0) {
    throw new Error(
      'Weather probability chart requires definitions.'
    );
  }

  const deltas = new Map<string, number>();

  for (const modifier of modifiers) {
    if (!Number.isFinite(modifier.delta)) {
      throw new Error(
        'Invalid Weather generation weight modifier.'
      );
    }

    deltas.set(
      modifier.targetId,
      (deltas.get(modifier.targetId) ?? 0) +
        modifier.delta
    );
  }

  const ids = new Set<string>();

  const weights = definitions.map(definition => {
    if (!definition.id || ids.has(definition.id)) {
      throw new Error(
        'Duplicate or invalid Weather definition ID.'
      );
    }

    ids.add(definition.id);

    const weight =
      definition.generationWeight +
      (deltas.get(definition.id) ?? 0);

    if (
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      throw new Error(
        `Invalid Weather weight: ${definition.id}`
      );
    }

    return weight;
  });

  const total = weights.reduce(
    (sum, weight) => sum + weight,
    0
  );

  if (total <= 0) {
    throw new Error(
      'Weather probability weights must total above zero.'
    );
  }

  let cumulative = 0;

  return definitions.map((definition, index) => {
    const percentage =
      (weights[index] / total) * 100;

    cumulative += percentage;

    return {
      id: definition.id,
      name: definition.name,
      index,
      weight: weights[index],
      percentage,
      cumulativePercentage:
        index === definitions.length - 1
          ? 100
          : cumulative,
    };
  });
}

/**
 * Constructs the four shared charts.
 *
 * The current season's weight vectors are
 * applied before percentage normalization.
 */
/**
 * Constructs the four shared charts.
 *
 * Ruleset and setting-specific seasonal
 * weight vectors are applied before
 * percentage normalization.
 */
export function createWeatherProbabilityCharts(
  definitions: WeatherEnvironmentDefinitions,
  seasonId?: string,
  overrides: readonly WeatherSeasonWeights[] = []
): WeatherProbabilityCharts {
  const seasonal = seasonId
    ? definitions.generation
        ?.seasonalWeightVectors
        ?.find(
          vector => vector.seasonId === seasonId
        )
    : undefined;

  const seasonalOverride = seasonId
    ? overrides.find(
        vector => vector.seasonId === seasonId
      )
    : undefined;

  return {
    visibility: createWeatherProbabilityChart(
      definitions.visibility,
      [
        ...(seasonal?.visibility ?? []),
        ...(seasonalOverride?.visibility ?? []),
      ]
    ),

    cloudCover: createWeatherProbabilityChart(
      definitions.cloudCover,
      [
        ...(seasonal?.cloudCover ?? []),
        ...(seasonalOverride?.cloudCover ?? []),
      ]
    ),

    precipitation: createWeatherProbabilityChart(
      definitions.precipitation,
      [
        ...(seasonal?.precipitation ?? []),
        ...(seasonalOverride?.precipitation ?? []),
      ]
    ),

    windStrength: createWeatherProbabilityChart(
      definitions.windStrength,
      [
        ...(seasonal?.windStrength ?? []),
        ...(seasonalOverride?.windStrength ?? []),
      ]
    ),
  };
}

/**
 * Produces four deterministic, independent
 * midpoint-target rolls for a Weather Node.
 *
 * No pressure, Area, Zone, or cloud-cover
 * restrictions are applied here.
 *
 * A transition can be regenerated from its
 * world seed, node position, and index.
 */
export function generateWeatherNodeMidpointTarget(
  worldSeed: number,
  nodeX: number,
  nodeY: number,
  transitionIndex: number
): WeatherNodeMidpointTarget {
  if (
    !Number.isSafeInteger(worldSeed) ||
    !Number.isSafeInteger(nodeX) ||
    !Number.isSafeInteger(nodeY) ||
    !Number.isSafeInteger(transitionIndex)
  ) {
    throw new Error(
      'Invalid Weather midpoint generation input.'
    );
  }

  const seed = deriveSeed(
    worldSeed,
    `weather.node.conditions.${nodeX}.${nodeY}.${transitionIndex}`
  );

  const random = createSeededRandom(seed);

  const roll = (): number =>
    Math.floor(random() * 100) + 1;

  return {
    nodeX,
    nodeY,
    transitionIndex,

    rolls: {
      visibility: roll(),
      cloudCover: roll(),
      precipitation: roll(),
      windStrength: roll(),
    },
  };
}


/**
 * Calculates a Weather Node's current rolls
 * between two consecutive midpoint targets.
 *
 * All properties share the same UpdateChange,
 * determined by the largest absolute difference.
 *
 * Properties stop changing once their individual
 * targets have been reached.
 */
export function interpolateWeatherConditionRolls(
  from: WeatherConditionRolls,
  to: WeatherConditionRolls,
  totalUpdateIntervals: number,
  elapsedUpdateIntervals: number
): WeatherConditionRolls {
  if (
    !Number.isSafeInteger(totalUpdateIntervals) ||
    totalUpdateIntervals <= 0 ||
    !Number.isSafeInteger(elapsedUpdateIntervals)
  ) {
    throw new Error(
      'Invalid Weather interpolation intervals.'
    );
  }

  if (elapsedUpdateIntervals <= 0) {
    return { ...from };
  }

  if (
    elapsedUpdateIntervals >= totalUpdateIntervals
  ) {
    return { ...to };
  }

  const maximumDifference = Math.max(
    Math.abs(to.visibility - from.visibility),
    Math.abs(to.cloudCover - from.cloudCover),
    Math.abs(to.precipitation - from.precipitation),
    Math.abs(to.windStrength - from.windStrength)
  );

  const updateChange =
    maximumDifference / totalUpdateIntervals;

  const totalChange =
    updateChange * elapsedUpdateIntervals;

  const interpolate = (
    start: number,
    target: number
  ): number => {
    const difference = target - start;

    if (
      Math.abs(difference) <= totalChange
    ) {
      return target;
    }

    return (
      start +
      Math.sign(difference) * totalChange
    );
  };

  return {
    visibility: interpolate(
      from.visibility,
      to.visibility
    ),

    cloudCover: interpolate(
      from.cloudCover,
      to.cloudCover
    ),

    precipitation: interpolate(
      from.precipitation,
      to.precipitation
    ),

    windStrength: interpolate(
      from.windStrength,
      to.windStrength
    ),
  };
}

/**
 * Finalizes an atmospheric roll after all
 * applicable modifiers have been applied.
 *
 * Always rounds down and clamps to 1–100.
 */
export function finalizeWeatherRoll(
  value: number
): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      'Invalid Weather condition roll.'
    );
  }

  return Math.max(
    1,
    Math.min(100, Math.floor(value))
  );
}

/**
 * Finalizes all four atmospheric rolls.
 */
export function finalizeWeatherConditionRolls(
  rolls: WeatherConditionRolls
): WeatherConditionRolls {
  return {
    visibility: finalizeWeatherRoll(rolls.visibility),
    cloudCover: finalizeWeatherRoll(rolls.cloudCover),
    precipitation: finalizeWeatherRoll(rolls.precipitation),
    windStrength: finalizeWeatherRoll(rolls.windStrength),
  };
}

/**
 * Resolves a finalized atmospheric roll
 * against its cumulative probability chart.
 */
export function resolveWeatherCondition(
  roll: number,
  chart: WeatherProbabilityChart
): WeatherProbabilityEntry {
  if (
    !Number.isSafeInteger(roll) ||
    roll < 1 ||
    roll > 100
  ) {
    throw new Error(
      'Weather condition roll must be finalized.'
    );
  }

  const condition = chart.find(
    entry =>
      entry.weight > 0 &&
      roll <= entry.cumulativePercentage
  );

  if (!condition) {
    throw new Error(
      'Unable to resolve Weather condition.'
    );
  }

  return condition;
}

/**
 * Resolves the four atmospheric conditions.
 *
 * Precipitation severity cannot exceed
 * cloud-cover severity.
 *
 * The original precipitation roll is preserved.
 */
export function resolveWeatherConditions(
  rolls: WeatherConditionRolls,
  charts: WeatherProbabilityCharts
): WeatherResolvedConditions {
  const visibility =
    resolveWeatherCondition(
      rolls.visibility,
      charts.visibility
    );

  const cloudCover =
    resolveWeatherCondition(
      rolls.cloudCover,
      charts.cloudCover
    );

  const precipitation =
    resolveWeatherCondition(
      rolls.precipitation,
      charts.precipitation
    );

  const windStrength =
    resolveWeatherCondition(
      rolls.windStrength,
      charts.windStrength
    );

  const precipitationIndex = Math.min(
    precipitation.index,
    cloudCover.index
  );

  return {
    visibility,
    cloudCover,

    precipitation:
      charts.precipitation[precipitationIndex],

    windStrength,
  };
}

/**
 * Calculates the combined temperature
 * reduction in Fahrenheit from resolved
 * atmospheric condition severity.
 */
export function getWeatherConditionTemperatureModifier(
  conditions: WeatherResolvedConditions
): number {
  return -(
    conditions.cloudCover.index * 2 +
    conditions.precipitation.index * 2 +
    conditions.windStrength.index
  );
}