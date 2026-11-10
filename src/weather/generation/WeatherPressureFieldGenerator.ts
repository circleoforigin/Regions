import type { WeatherConfiguration } from '../models/WeatherConfiguration';

export type WeatherPressure = -1 | 0 | 1;

export interface WeatherPressureField {
  width: number;
  height: number;
  pressures: Int8Array;
}

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export function generateWeatherPressureField(
  configuration: WeatherConfiguration,
  random: () => number = Math.random
): WeatherPressureField {
  const { width, height } = configuration.plane;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 2 ||
    height < 2 ||
    height % 2 !== 0
  ) {
    throw new Error(
      'Invalid Weather pressure plane dimensions.'
    );
  }

  const pressures = new Int8Array(width * height);

  const indexAt = (x: number, y: number): number =>
    wrap(y, height) * width + wrap(x, width);

  // A staggered Node has six neighbors.
  // Odd rows are offset east by half a spacing.
  const neighborsOf = (
    x: number,
    y: number
  ): number[] => {
    const offsets = y % 2 === 0
      ? [
          [-1, 0], [1, 0],
          [-1, -1], [0, -1],
          [-1, 1], [0, 1],
        ]
      : [
          [-1, 0], [1, 0],
          [0, -1], [1, -1],
          [0, 1], [1, 1],
        ];

    return offsets.map(
      ([dx, dy]) => indexAt(x + dx, y + dy)
    );
  };

  const available = new Uint8Array(
    pressures.length
  );
  available.fill(1);

  let remaining = pressures.length;

  const pickAvailable = (): number => {
    const target = Math.floor(random() * remaining);
    let seen = 0;

    for (let i = 0; i < available.length; i++) {
      if (!available[i]) continue;

      if (seen === target) return i;
      seen++;
    }

    throw new Error(
      'Unable to select an available Weather Node.'
    );
  };

  const claim = (
    index: number,
    pressure: WeatherPressure
  ): void => {
    pressures[index] = pressure;
    available[index] = 0;
    remaining--;
  };

  while (remaining > 0) {
    const start = pickAvailable();

    // Neutral clusters are generated explicitly,
    // not just left between high and low systems.
    const roll = random();
    const pressure: WeatherPressure =
      roll < 1 / 3 ? -1 :
      roll < 2 / 3 ? 0 : 1;

    // Mostly small clusters, with occasional
    // larger irregular formations.
    const sizeRoll = random();
    const targetSize =
      sizeRoll < 0.15
        ? 1 + Math.floor(random() * 3)
        : sizeRoll < 0.75
          ? 4 + Math.floor(random() * 5)
          : sizeRoll < 0.95
            ? 9 + Math.floor(random() * 8)
            : 17 + Math.floor(random() * 9);

    claim(start, pressure);

    const frontier = [start];
    let claimed = 1;

    while (
      frontier.length > 0 &&
      claimed < targetSize
    ) {
      const sourceIndex = frontier[
        Math.floor(random() * frontier.length)
      ];

      const x = sourceIndex % width;
      const y = Math.floor(sourceIndex / width);

      const candidates = neighborsOf(x, y)
        .filter(index => available[index] === 1);

      if (candidates.length === 0) {
        const position = frontier.indexOf(sourceIndex);
        frontier.splice(position, 1);
        continue;
      }

      const next = candidates[
        Math.floor(random() * candidates.length)
      ];

      claim(next, pressure);
      frontier.push(next);
      claimed++;
    }
  }

  return {
    width,
    height,
    pressures,
  };
}

export function getWeatherNodePressure(
  field: WeatherPressureField,
  x: number,
  y: number
): WeatherPressure {
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y)
  ) {
    throw new Error(
      'Weather Node coordinates must be integers.'
    );
  }

  return field.pressures[
    wrap(y, field.height) * field.width +
    wrap(x, field.width)
  ] as WeatherPressure;
}
