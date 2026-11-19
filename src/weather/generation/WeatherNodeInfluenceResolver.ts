
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
  | 'triangle-center'
  | 'triangle-strong'
  | 'triangle-column'
  | 'triangle-balanced';

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
  'triangle-strong': [0.8, 0.1, 0.1],
  'triangle-column': [0.56, 0.22, 0.22],
  'triangle-balanced': [0.3, 0.35, 0.35],
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
  influences: WeatherNodeInfluence[];
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


export interface WeatherNodeAddress {
  nodeX: number;
  nodeY: number;
}

/**
 * Wrap a Weather Node address around the
 * boundaries of the repeating Weather Plane.
 *
 * This allows neighboring Nodes to be
 * referenced across either plane boundary.
 */
export function getWrappedWeatherNode(
  nodeX: number,
  nodeY: number,
  configuration: WeatherConfiguration
): WeatherNodeAddress {
  const { width, height } = configuration.plane;

  if (
    !Number.isSafeInteger(nodeX) ||
    !Number.isSafeInteger(nodeY) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Invalid Weather Node address.'
    );
  }

  return {
    nodeX: wrap(nodeX, width),
    nodeY: wrap(nodeY, height),
  };
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

 const influences = resolveWeatherBlendInfluences(
  planeSector.x,
  planeSector.y,
  configuration
);

validateWeatherNodeInfluences(influences);

return { influences };
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

export interface WeatherBlendEntry {
  readonly nodeOffsetX: number;
  readonly nodeOffsetY: number;
  readonly weight: number;
}

export type WeatherBlendCell = readonly WeatherBlendEntry[];
export type WeatherBlendRow = readonly WeatherBlendCell[];
export type WeatherBlendTable = readonly WeatherBlendRow[];

/**
 * Offsets are relative to a base weather node.
 *
 * A node offset of (1, 0) means the next
 * weather node horizontally.
 *
 * A node offset of (0, 1) means the next
 * staggered weather-node row.
 */
const blend = (
  ...entries: readonly [
    number,
    number,
    number
  ][]
): WeatherBlendCell =>
  entries.map(([nodeOffsetX, nodeOffsetY, weight]) => ({
    nodeOffsetX,
    nodeOffsetY,
    weight,
  }));

const WEATHER_BLEND_PERIOD_X = 8;
const WEATHER_BLEND_PERIOD_Y = 8;

export const WEATHER_BLEND_TABLE: WeatherBlendTable = [
  // y = 0
  [
    blend([0,0,1]),
    blend([0,0,.75],[1,0,.25]),
    blend([0,0,.5],[1,0,.5]),
    blend([0,0,.25],[1,0,.75]),
    blend([1,0,1]),
    blend([1,0,.75],[2,0,.25]),
    blend([1,0,.5],[2,0,.5]),
    blend([1,0,.25],[2,0,.75]),
  ],

  // y = 1
  [
    blend([0,0,.8],[-1,1,.1],[0,1,.1]),
    blend([0,0,.75],[0,1,.25]),
    blend([0,0,.35],[1,0,.35],[0,1,.3]),
    blend([1,0,.75],[0,1,.25]),
    blend([1,0,.8],[0,1,.1],[1,1,.1]),
    blend([1,0,.75],[1,1,.25]),
    blend([1,0,.35],[2,0,.35],[1,1,.3]),
    blend([2,0,.75],[1,1,.25]),
  ],

  // y = 2
  [
    blend([0,0,.56],[-1,1,.22],[0,1,.22]),
    blend([0,0,.5],[0,1,.5]),
    blend([0,1,.56],[0,0,.22],[1,0,.22]),
    blend([0,1,.5],[1,0,.5]),
    blend([1,0,.56],[0,1,.22],[1,1,.22]),
    blend([1,0,.5],[1,1,.5]),
    blend([1,1,.56],[1,0,.22],[2,0,.22]),
    blend([1,1,.5],[2,0,.5]),
  ],

  // y = 3
  [
    blend([-1,1,.35],[0,1,.35],[0,0,.3]),
    blend([0,1,.75],[0,0,.25]),
    blend([0,1,.8],[0,0,.1],[1,0,.1]),
    blend([0,1,.75],[1,0,.25]),
    blend([0,1,.35],[1,1,.35],[1,0,.3]),
    blend([1,1,.75],[1,0,.25]),
    blend([1,1,.8],[1,0,.1],[2,0,.1]),
    blend([1,1,.75],[2,0,.25]),
  ],

  // y = 4
  [
    blend([-1,1,.5],[0,1,.5]),
    blend([-1,1,.25],[0,1,.75]),
    blend([0,1,1]),
    blend([0,1,.75],[1,1,.25]),
    blend([0,1,.5],[1,1,.5]),
    blend([0,1,.25],[1,1,.75]),
    blend([1,1,1]),
    blend([1,1,.75],[2,1,.25]),
  ],

  // y = 5
  [
    blend([-1,1,.35],[0,1,.35],[0,2,.3]),
    blend([0,1,.75],[0,2,.25]),
    blend([0,1,.8],[0,2,.1],[1,2,.1]),
    blend([0,1,.75],[1,2,.25]),
    blend([0,1,.35],[1,1,.35],[1,2,.3]),
    blend([1,1,.75],[1,2,.25]),
    blend([1,1,.8],[1,2,.1],[2,2,.1]),
    blend([1,1,.75],[2,2,.25]),
  ],

  // y = 6
  [
    blend([0,2,.56],[-1,1,.22],[0,1,.22]),
    blend([0,1,.5],[0,2,.5]),
    blend([0,1,.56],[0,2,.22],[1,2,.22]),
    blend([0,1,.5],[1,2,.5]),
    blend([1,2,.56],[0,1,.22],[1,1,.22]),
    blend([1,1,.5],[1,2,.5]),
    blend([1,1,.56],[1,2,.22],[2,2,.22]),
    blend([1,1,.5],[2,2,.5]),
  ],

  // y = 7
  [
    blend([0,2,.8],[-1,1,.1],[0,1,.1]),
    blend([0,2,.75],[0,1,.25]),
    blend([0,2,.35],[1,2,.35],[0,1,.3]),
    blend([1,2,.75],[0,1,.25]),
    blend([1,2,.8],[0,1,.1],[1,1,.1]),
    blend([1,2,.75],[1,1,.25]),
    blend([1,2,.35],[2,2,.35],[1,1,.3]),
    blend([2,2,.75],[1,1,.25]),
  ],
];

export function getWeatherBlendCell(
  sectorX: number,
  sectorY: number
): WeatherBlendCell {
  const { localX, localY } =
    getWeatherBlendPosition(sectorX, sectorY);

  const cell = WEATHER_BLEND_TABLE[localY]?.[localX];

  if (!cell) {
    throw new Error(
      `Missing Weather blend cell (${localX}, ${localY}).`
    );
  }

  return cell;
}

export interface WeatherBlendPosition {
  localX: number;
  localY: number;
  tileX: number;
  tileY: number;
}

/**
 * Locate a sector within the repeating 8x8
 * weather blending pattern.
 *
 * Tile coordinates identify which repetition
 * of the pattern contains the sector.
 *
 * Local coordinates identify its lookup cell.
 */
export function getWeatherBlendPosition(
  sectorX: number,
  sectorY: number
): WeatherBlendPosition {
  if (
    !Number.isSafeInteger(sectorX) ||
    !Number.isSafeInteger(sectorY)
  ) {
    throw new Error(
      'Invalid Weather blend sector coordinates.'
    );
  }

const tileX = Math.floor(
  sectorX / WEATHER_BLEND_PERIOD_X
);

const tileY = Math.floor(
  sectorY / WEATHER_BLEND_PERIOD_Y
);

return {
  localX:
    sectorX - tileX * WEATHER_BLEND_PERIOD_X,
  localY:
    sectorY - tileY * WEATHER_BLEND_PERIOD_Y,
  tileX,
  tileY,
};
}

export function resolveWeatherBlendNode(
  sectorX: number,
  sectorY: number,
  entry: WeatherBlendEntry,
  configuration: WeatherConfiguration
): WeatherNodeAddress {
  const spacing =
    configuration.plane.nodeSpacingMiles / 5;

  if (spacing !== 4) {
    throw new Error(
      'Fixed Weather blending requires 4-sector node spacing.'
    );
  }

  const { tileX, tileY } =
    getWeatherBlendPosition(sectorX, sectorY);

  const row = tileY * 2 + entry.nodeOffsetY;

  return getWrappedWeatherNode(
    tileX * 2 + entry.nodeOffsetX,
    row,
    configuration
  );
}

export function resolveWeatherBlendInfluences(
  sectorX: number,
  sectorY: number,
  configuration: WeatherConfiguration
): WeatherNodeInfluence[] {
  const cell = getWeatherBlendCell(
    sectorX,
    sectorY
  );

  return cell.map(entry => ({
    ...resolveWeatherBlendNode(
      sectorX,
      sectorY,
      entry,
      configuration
    ),
    weight: entry.weight,
  }));
}

export function validateWeatherNodeInfluences(
  influences: readonly WeatherNodeInfluence[]
): void {
  if (
    influences.length < 1 ||
    influences.length > 3
  ) {
    throw new Error(
      'Weather requires 1 to 3 node influences.'
    );
  }

  let total = 0;

  for (const influence of influences) {
    if (
      !Number.isFinite(influence.weight) ||
      influence.weight <= 0
    ) {
      throw new Error(
        'Invalid Weather node influence weight.'
      );
    }

    total += influence.weight;
  }

  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(
      'Weather node influences must total 1.'
    );
  }
}

export function verifyWeatherBlendCell(
  sectorX: number,
  sectorY: number,
  expected: readonly WeatherBlendEntry[]
): void {
  const actual = getWeatherBlendCell(sectorX, sectorY);

  if (
    actual.length !== expected.length ||
    actual.some((entry, index) =>
      entry.nodeOffsetX !== expected[index].nodeOffsetX ||
      entry.nodeOffsetY !== expected[index].nodeOffsetY ||
      Math.abs(entry.weight - expected[index].weight) > 1e-9
    )
  ) {
    throw new Error(
      `Incorrect Weather blend at (${sectorX}, ${sectorY}).`
    );
  }
}

export function verifyApprovedWeatherBlends(): void {
  verifyWeatherBlendCell(0, 0, [
    { nodeOffsetX: 0, nodeOffsetY: 0, weight: 1 },
  ]);

  verifyWeatherBlendCell(1, 0, [
    { nodeOffsetX: 0, nodeOffsetY: 0, weight: .75 },
    { nodeOffsetX: 1, nodeOffsetY: 0, weight: .25 },
  ]);

  verifyWeatherBlendCell(1, 3, [
    { nodeOffsetX: 0, nodeOffsetY: 1, weight: .75 },
    { nodeOffsetX: 0, nodeOffsetY: 0, weight: .25 },
  ]);

  verifyWeatherBlendCell(2, 2, [
    { nodeOffsetX: 0, nodeOffsetY: 1, weight: .56 },
    { nodeOffsetX: 0, nodeOffsetY: 0, weight: .22 },
    { nodeOffsetX: 1, nodeOffsetY: 0, weight: .22 },
  ]);

  verifyWeatherBlendCell(4, 1, [
    { nodeOffsetX: 1, nodeOffsetY: 0, weight: .8 },
    { nodeOffsetX: 0, nodeOffsetY: 1, weight: .1 },
    { nodeOffsetX: 1, nodeOffsetY: 1, weight: .1 },
  ]);

  verifyWeatherBlendCell(6, 2, [
    { nodeOffsetX: 1, nodeOffsetY: 1, weight: .56 },
    { nodeOffsetX: 1, nodeOffsetY: 0, weight: .22 },
    { nodeOffsetX: 2, nodeOffsetY: 0, weight: .22 },
  ]);
}

export function verifyWeatherBlendLookup(): void {
  validateWeatherBlendTable();
  verifyApprovedWeatherBlends();

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (!verifyWeatherBlendRepeat(x, y)) {
        throw new Error(
          `Weather blend does not repeat at (${x}, ${y}).`
        );
      }
    }
  }
}

export function verifyWeatherBlendRepeat(
  sectorX: number,
  sectorY: number
): boolean {
  const original = getWeatherBlendCell(
    sectorX,
    sectorY
  );

  const horizontal = getWeatherBlendCell(
    sectorX + WEATHER_BLEND_PERIOD_X,
    sectorY
  );

  const vertical = getWeatherBlendCell(
    sectorX,
    sectorY + WEATHER_BLEND_PERIOD_Y
  );

  return (
    original === horizontal &&
    original === vertical
  );
}

export function validateWeatherBlendTable(): void {
  if (
    WEATHER_BLEND_TABLE.length !==
    WEATHER_BLEND_PERIOD_Y
  ) {
    throw new Error(
      'Weather blend table must contain 8 rows.'
    );
  }

  for (const row of WEATHER_BLEND_TABLE) {
    if (row.length !== WEATHER_BLEND_PERIOD_X) {
      throw new Error(
        'Weather blend table must contain 8 columns.'
      );
    }

    for (const cell of row) {
      if (cell.length < 1 || cell.length > 3) {
        throw new Error(
          'Weather blend cells require 1–3 nodes.'
        );
      }

      const total = cell.reduce(
        (sum, entry) => sum + entry.weight,
        0
      );

      if (Math.abs(total - 1) > 1e-9) {
        throw new Error(
          'Weather blend weights must total 1.'
        );
      }
    }
  }
}