import {
  projectCommandDefinitions,
  projectEventDefinitions,
  projectQueryDefinitions,
} from '@settingforge/module-sdk';

import type {
  EventDefinition,
} from '@settingforge/module-sdk';

import {
  emitImageEventDefinition,
  locationEventDefinitions,
} from '../events/LocationEvents';

import {
  regionsSpatialQueryDefinitions,
} from './RegionsSpatialCapabilities';

export const regionsEventDefinitions:
  EventDefinition[] = [
    ...locationEventDefinitions,
    emitImageEventDefinition,
    ...projectEventDefinitions,
  ];

export const regionsCommandDefinitions = [
  ...projectCommandDefinitions,
];

export const regionsQueryDefinitions = [
  ...projectQueryDefinitions,
  ...regionsSpatialQueryDefinitions,
];