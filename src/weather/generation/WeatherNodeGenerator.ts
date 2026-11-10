
import type {
  WeatherNode,
} from '../models/WeatherNode';

import {
  getWeatherNodePressure,
  type WeatherPressureField,
} from './WeatherPressureFieldGenerator';

function wrap(
  value: number,
  size: number
): number {
  return ((value % size) + size) % size;
}

export function generateWeatherNode(
  x: number,
  y: number,
  pressureField: WeatherPressureField
): WeatherNode {
  const width = pressureField.width;
  const height = pressureField.height;

  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'Invalid Weather node coordinates or plane dimensions.'
    );
  }

  const nodeX = wrap(x, width);
  const nodeY = wrap(y, height);

  return {
    position: {
      x: nodeX,
      y: nodeY,
    },

    pressureInfluence:
      getWeatherNodePressure(
        pressureField,
        nodeX,
        nodeY
      ),
  };
}

