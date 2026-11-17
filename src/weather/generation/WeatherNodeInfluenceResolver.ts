
import type {
  WeatherConfiguration,
} from '../models/WeatherConfiguration';

import {
  getWeatherMovementStep,
  getWrappedWeatherDisplacement,
  type WeatherMovementCycle,
} from '../WeatherMovementCycle';

import type {
  SectorAddress,
} from '../../spatial/Sector';

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

export type WeatherTriangleOrientation =
  | 'upright'
  | 'inverted';

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

const VALUE_KEYS = [
  'temperature',
  'visibility',
  'cloudCover',
  'precipitation',
  'windStrength',
] as const satisfies readonly (keyof WeatherValues)[];

export interface WeatherNodeInfluence {
  nodeX: number;
  nodeY: number;
  weight: number;
}

export interface SectorNodeInfluenceResult {
  orientation: WeatherTriangleOrientation;
  pattern: WeatherBlendPattern;
  influences: WeatherNodeInfluence[];
}

interface Point {
  x: number;
  y: number;
}

interface Triangle {
  points: [Point, Point, Point];
  weights: [number, number, number];
  orientation: WeatherTriangleOrientation;
}

const EPSILON = 1e-9;

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export interface WeatherPlaneSector {
  x: number;
  y: number;
}

/**
 * Maps a stationary world sector to the sector
 * currently passing over it on the moving
 * Weather Plane.
 *
 * No per-sector state or blending data is stored.
 */
export function getWeatherPlaneSector(
  sector: SectorAddress,
  time: number,
  secondsPerDay: number,
  configuration: WeatherConfiguration,
  movementCycle: WeatherMovementCycle
): WeatherPlaneSector {
  const sectorsPerNode =
    configuration.plane.nodeSpacingMiles / 5;

  const width =
    configuration.plane.width * sectorsPerNode;

  const height =
    configuration.plane.height * sectorsPerNode;

  if (
    !Number.isSafeInteger(sector.x) ||
    !Number.isSafeInteger(sector.y) ||
    !Number.isFinite(time) ||
    !Number.isFinite(secondsPerDay) ||
    secondsPerDay <= 0 ||
    !Number.isSafeInteger(sectorsPerNode) ||
    sectorsPerNode <= 0 ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Invalid Weather Plane sector lookup.'
    );
  }

  const step = getWeatherMovementStep(
    time / secondsPerDay,
    configuration
  );

  const displacement =
    getWrappedWeatherDisplacement(
      movementCycle,
      step,
      configuration
    );

  return {
    x: wrap(
      sector.x - displacement.x,
      width
    ),
    y: wrap(
      sector.y - displacement.y,
      height
    ),
  };
}

function barycentric(
  point: Point,
  a: Point,
  b: Point,
  c: Point
): [number, number, number] | null {
  const denominator =
    (b.y - c.y) * (a.x - c.x) +
    (c.x - b.x) * (a.y - c.y);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const first =
    (
      (b.y - c.y) * (point.x - c.x) +
      (c.x - b.x) * (point.y - c.y)
    ) / denominator;

  const second =
    (
      (c.y - a.y) * (point.x - c.x) +
      (a.x - c.x) * (point.y - c.y)
    ) / denominator;

  return [first, second, 1 - first - second];
}

function findContainingTriangle(
  point: Point,
  spacing: number
): Triangle {
  const lowerRow = Math.floor(point.y / spacing);

  const nodes: Point[] = [];

  for (
    let row = lowerRow - 1;
    row <= lowerRow + 2;
    row++
  ) {
    const offset =
      wrap(row, 2) === 1 ? spacing / 2 : 0;

    const nearestColumn = Math.floor(
      (point.x - offset) / spacing
    );

    for (
      let column = nearestColumn - 1;
      column <= nearestColumn + 2;
      column++
    ) {
      nodes.push({
        x: column * spacing + offset,
        y: row * spacing,
      });
    }
  }

  let best: Triangle | null = null;
  let bestScore = -Infinity;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      for (let k = j + 1; k < nodes.length; k++) {
        const points = [
          nodes[i],
          nodes[j],
          nodes[k],
        ] as [Point, Point, Point];

        const rows = new Set(
          points.map(p => p.y)
        );

        if (rows.size !== 2) continue;

        const lengths = [
          Math.hypot(
            points[0].x - points[1].x,
            points[0].y - points[1].y
          ),
          Math.hypot(
            points[1].x - points[2].x,
            points[1].y - points[2].y
          ),
          Math.hypot(
            points[2].x - points[0].x,
            points[2].y - points[0].y
          ),
        ];

        // Only immediate triangular-grid neighbors.
        const diagonal =
          Math.hypot(spacing / 2, spacing);

        if (
          lengths.some(
            length =>
              Math.abs(length - spacing) > EPSILON &&
              Math.abs(length - diagonal) > EPSILON
          )
        ) {
          continue;
        }

        const weights = barycentric(
          point,
          ...points
        );

        if (!weights) continue;

        const minimum = Math.min(...weights);

        if (minimum < -EPSILON) continue;

        if (minimum > bestScore) {
          bestScore = minimum;

          const sorted = [...points].sort(
            (a, b) => a.y - b.y
          );

          best = {
            points,
            weights,
            orientation:
              sorted[0].y === sorted[1].y
                ? 'inverted'
                : 'upright',
          };
        }
      }
    }
  }

  if (!best) {
    throw new Error(
      'Unable to resolve Weather triangle.'
    );
  }

  return best;
}

interface Candidate {
  pattern: WeatherBlendPattern;
  weights: number[];
}

function chooseInfluencePattern(
  geometricWeights: readonly number[],
  points: readonly Point[]
): Candidate {
  const candidates: Candidate[] = [];

  for (let i = 0; i < 3; i++) {
    const single = [0, 0, 0];
    single[i] = 1;

    candidates.push({
      pattern: 'single',
      weights: single,
    });

    for (let j = 0; j < 3; j++) {
      if (i === j) continue;

      const horizontal =
        Math.abs(points[i].y - points[j].y) <
        EPSILON;

      const patterns: WeatherBlendPattern[] =
        horizontal
          ? ['horizontal-near', 'horizontal-center']
          : ['diagonal'];

      for (const pattern of patterns) {
        const [first, second] =
          WEATHER_BLEND_WEIGHTS[pattern];

        const weights = [0, 0, 0];
        weights[i] = first;
        weights[j] = second;

        candidates.push({ pattern, weights });
      }
    }

    for (const pattern of [
      'triangle-near',
      'triangle-center',
    ] as const) {
      const [first, second, third] =
        WEATHER_BLEND_WEIGHTS[pattern];

      const weights = [third, third, third];
      weights[i] = first;

      const others = [0, 1, 2].filter(
        index => index !== i
      );

      weights[others[0]] = second;
      weights[others[1]] = third;

      candidates.push({ pattern, weights });
    }
  }

  let selected = candidates[0];
  let lowestError = Infinity;

  for (const candidate of candidates) {
    const error = candidate.weights.reduce(
      (total, weight, index) =>
        total +
        Math.pow(
          weight - geometricWeights[index],
          2
        ),
      0
    );

    if (error < lowestError) {
      lowestError = error;
      selected = candidate;
    }
  }

  return selected;
}

/**
 * Resolve sector influences at a simulation time.
 *
 * Displacement is already expressed in sectors
 * by WeatherMovementCycle.
 */
export function resolveSectorNodeInfluences(
  sector: SectorAddress,
  time: number,
  secondsPerDay: number,
  configuration: WeatherConfiguration,
  movementCycle: WeatherMovementCycle
): SectorNodeInfluenceResult {
  const {
    width,
    height,
    nodeSpacingMiles,
  } = configuration.plane;

  const spacing = nodeSpacingMiles / 5;

  if (
    !Number.isSafeInteger(sector.x) ||
    !Number.isSafeInteger(sector.y) ||
    !Number.isFinite(time) ||
    !Number.isFinite(secondsPerDay) ||
    secondsPerDay <= 0 ||
    !Number.isSafeInteger(spacing) ||
    spacing <= 0 ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    height % 2 !== 0
  ) {
    throw new Error(
      'Invalid Weather sector influence inputs.'
    );
  }

  const planeSector = getWeatherPlaneSector(
    sector,
    time,
    secondsPerDay,
    configuration,
    movementCycle
  );

  const point: Point = {
    x: planeSector.x + 0.5,
    y: planeSector.y + 0.5,
  };

  const triangle = findContainingTriangle(
    point,
    spacing
  );

  const selected = chooseInfluencePattern(
    triangle.weights,
    triangle.points
  );

  const influences = triangle.points.flatMap(
    (node, index) => {
      const weight = selected.weights[index];

      if (weight <= 0) return [];

      const row = Math.round(node.y / spacing);

      const offset =
        wrap(row, 2) === 1 ? spacing / 2 : 0;

      const column = Math.round(
        (node.x - offset) / spacing
      );

      return [{
        nodeX: wrap(column, width),
        nodeY: wrap(row, height),
        weight,
      }];
    }
  );

  return {
    orientation: triangle.orientation,
    pattern: selected.pattern,
    influences,
  };
}

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
          'Invalid Weather influence weight.'
        );
      }

      return total + influence.weight;
    },
    0
  );

  if (Math.abs(totalWeight - 1) > EPSILON) {
    throw new Error(
      'Weather influence weights must total 1.'
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
    for (const key of VALUE_KEYS) {
      const value = influence.node.values[key];

      if (!Number.isFinite(value)) {
        throw new Error(
          `Invalid ${key} at Weather node.`
        );
      }

      result[key] += value * influence.weight;
    }
  }

  return result;
}

export function calculateBlendedWeather(
  nodes: readonly WeatherNodeSample[],
  pattern: WeatherBlendPattern
): WeatherValues {
  return blendWeatherValues(
    createWeightedWeatherNodes(nodes, pattern)
  );
}
