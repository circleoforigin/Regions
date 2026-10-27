
import {
  deriveSeed,
} from '@settingforge/module-sdk';

import type {
  WeatherNode,
} from '../models/WeatherNode';

import type {
  WeatherConfiguration,
} from '../models/WeatherConfiguration';

function normalizeCoordinate(
  coordinate: number,
  size: number
): number
{
  return (
    (coordinate % size) + size
  ) % size;
}

export function generateWeatherNode(
  x: number,
  y: number,
  worldSeed: number,
  configuration: WeatherConfiguration
): WeatherNode
{
  const width =
    configuration.plane.width;

  const height =
    configuration.plane.height;

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  )
  {
    throw new Error(
      'Invalid Weather node coordinates or plane dimensions.'
    );
  }

  const nodeX =
    normalizeCoordinate(x, width);

  const nodeY =
    normalizeCoordinate(y, height);

  const pressureSeed =
    deriveSeed(
      worldSeed,
      `weather.pressure:${nodeX}:${nodeY}`
    );

  const pressureInfluence =
    (
      pressureSeed / 0xFFFFFFFF
    ) * 2 - 1;

  return {
    position: {
      x: nodeX,
      y: nodeY,
    },

    pressureInfluence,
  };
}
