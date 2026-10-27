
import type {
  WeatherConfiguration,
} from './models/WeatherConfiguration';

export interface WeatherVector
{
  x: number;
  y: number;
}

export interface WeatherMovementCycle
{
  vectors: WeatherVector[];
  prefixDisplacements: WeatherVector[];
  completedDisplacement: WeatherVector;
}

const DIRECTIONS: readonly WeatherVector[] = [
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
];

function nextRandomState(
  state: number
): number
{
  return (
    Math.imul(state, 1664525) + 1013904223
  ) >>> 0;
}

export function createWeatherMovementCycle(
  configuration: WeatherConfiguration
): WeatherMovementCycle
{
  const cycleLength =
    configuration.movement.directionCycleLength;

  if (
    !Number.isSafeInteger(cycleLength) ||
    cycleLength <= 0
  )
  {
    throw new Error(
      'Invalid Weather movement cycle length.'
    );
  }

  let state = configuration.seed >>> 0;

  const vectors: WeatherVector[] = [];

  const prefixDisplacements: WeatherVector[] = [
    { x: 0, y: 0 },
  ];

  let x = 0;
  let y = 0;

  for (
    let index = 0;
    index < cycleLength;
    index++
  )
  {
    state = nextRandomState(state);

    const direction =
      DIRECTIONS[state % DIRECTIONS.length];

    const vector = {
      x: direction.x,
      y: direction.y,
    };

    vectors.push(vector);

    x += vector.x;
    y += vector.y;

    prefixDisplacements.push({ x, y });
  }

  return {
    vectors,
    prefixDisplacements,
    completedDisplacement: { x, y },
  };
}

export function getWeatherDisplacement(
  cycle: WeatherMovementCycle,
  step: number
): WeatherVector
{
  if (!Number.isSafeInteger(step))
  {
    throw new Error(
      'Weather movement step must be a safe integer.'
    );
  }

  const cycleLength = cycle.vectors.length;

  if (cycleLength === 0)
  {
    throw new Error(
      'Weather movement cycle cannot be empty.'
    );
  }

  const completedCycles =
    Math.floor(step / cycleLength);

  const remainingSteps =
    step - completedCycles * cycleLength;

  const prefix =
    cycle.prefixDisplacements[remainingSteps];

  return {
    x:
      completedCycles *
        cycle.completedDisplacement.x +
      prefix.x,
    y:
      completedCycles *
        cycle.completedDisplacement.y +
      prefix.y,
  };
}

export function getWeatherMovementStep(
  elapsedWorldDays: number,
  configuration: WeatherConfiguration
): number
{
  return Math.floor(
    elapsedWorldDays *
      configuration.movement.stepsPerDay
  );
}

export function getWrappedWeatherDisplacement(
  cycle: WeatherMovementCycle,
  step: number,
  configuration: WeatherConfiguration
): WeatherVector
{
  const displacement =
    getWeatherDisplacement(cycle, step);

  const wrap = (
    value: number,
    size: number
  ): number =>
  {
    return ((value % size) + size) % size;
  };

  // The plane dimensions are measured in Weather
  // Nodes. Each Node occupies two Sector units.
  const widthInSectors =
    configuration.plane.width * 2;

  const heightInSectors =
    configuration.plane.height * 2;

  return {
    x: wrap(displacement.x, widthInSectors),
    y: wrap(displacement.y, heightInSectors),
  };
}
