
import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

import type {
  WeatherConfiguration,
} from './models/WeatherConfiguration';

import {
  generateWeatherPressureFields,
  type WeatherPressureField,
} from './generation/WeatherPressureFieldGenerator';

import {
  generateWeatherWindField,
  type WeatherWindField,
} from './generation/WeatherWindGenerator';

const COLLECTION = 'weather-fields';
const FORMAT_VERSION = 1;

interface StoredWeatherFields {
  version: number;
  worldId: string;
  nodeWidth: number;
  nodeHeight: number;
  pressures: number[];
  windWidth: number;
  windHeight: number;
  directions: number[];
}

export interface PersistedWeatherFields {
  pressureField: WeatherPressureField;
  windField: WeatherWindField;
}

function restoreWeatherFields(
  stored: StoredWeatherFields,
  worldId: string,
  configuration: WeatherConfiguration
): PersistedWeatherFields {
  const { width, height, nodeSpacingMiles } =
    configuration.plane;

  const sectorsPerNode = nodeSpacingMiles / 5;
  const windWidth = width * sectorsPerNode;
  const windHeight = height * sectorsPerNode;

  if (
    stored.version !== FORMAT_VERSION ||
    stored.worldId !== worldId ||
    stored.nodeWidth !== width ||
    stored.nodeHeight !== height ||
    stored.windWidth !== windWidth ||
    stored.windHeight !== windHeight ||
    !Array.isArray(stored.pressures) ||
    !Array.isArray(stored.directions) ||
    stored.pressures.length !== width * height ||
    stored.directions.length !== windWidth * windHeight ||
    !stored.pressures.every(
      value => value === -1 || value === 0 || value === 1
    ) ||
    !stored.directions.every(
      value => Number.isInteger(value) &&
        value >= 0 &&
        value <= 7
    )
  ) {
    throw new Error(
      'Stored Weather fields are incompatible or invalid.'
    );
  }

  return {
    pressureField: {
      width,
      height,
      pressures: Int8Array.from(stored.pressures),
    },
    windField: {
      widthInSectors: windWidth,
      heightInSectors: windHeight,
      directions: Uint8Array.from(stored.directions),
    },
  };
}

export async function loadOrCreateWeatherFields(
  projectId: string,
  worldId: string,
  configuration: WeatherConfiguration
): Promise<PersistedWeatherFields> {
  if (!projectId || !worldId) {
    throw new Error(
      'Weather persistence requires a Project and World.'
    );
  }

  const stored =
    await hostedCollectionRepository.load<StoredWeatherFields>(
      COLLECTION,
      projectId
    );

  if (stored) {
    return restoreWeatherFields(
      stored,
      worldId,
      configuration
    );
  }

  // Generate only when no saved atmosphere exists.
  const generated = generateWeatherPressureFields(
    configuration
  );

  const pressureField = generated.nodeField;

  const windField = generateWeatherWindField(
    generated.windPressureField,
    configuration
  );

  const record: StoredWeatherFields = {
    version: FORMAT_VERSION,
    worldId,
    nodeWidth: pressureField.width,
    nodeHeight: pressureField.height,
    pressures: Array.from(pressureField.pressures),
    windWidth: windField.widthInSectors,
    windHeight: windField.heightInSectors,
    directions: Array.from(windField.directions),
  };

  // Do not expose the generated fields until
  // the initial save has completed successfully.
  await hostedCollectionRepository.save(
    COLLECTION,
    projectId,
    record
  );

  return {
    pressureField,
    windField,
  };
}
