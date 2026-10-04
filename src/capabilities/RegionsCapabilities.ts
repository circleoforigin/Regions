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

const travelLegProspectedEventDefinition: EventDefinition = {
  id: 'Regions.TravelLegProspected',
  label: 'Travel Leg Prospected',
  description:
    'Describes a prospective Route Leg so other systems can generate events during its travel interval.',
  fields: [
    {
      key: 'pieceId',
      label: 'Piece ID',
      type: 'string',
    },
    {
      key: 'routeId',
      label: 'Route ID',
      type: 'string',
    },
    {
      key: 'routeLegId',
      label: 'Route Leg ID',
      type: 'string',
    },
    {
      key: 'startTime',
      label: 'Start Time',
      type: 'number',
    },
    {
      key: 'endTime',
      label: 'End Time',
      type: 'number',
    },
    {
      key: 'duration',
      label: 'Duration',
      type: 'number',
    },    
    {
      key: 'pace',
      label: 'Travel Pace',
      type: 'string',
    },
  ],
};

export const regionsEventDefinitions:
  EventDefinition[] = [
    ...locationEventDefinitions,
    emitImageEventDefinition,
    travelLegProspectedEventDefinition,
    ...projectEventDefinitions,
  ];

export const regionsCommandDefinitions = [
  ...projectCommandDefinitions,
];

export const regionsQueryDefinitions = [
  ...projectQueryDefinitions,
  ...regionsSpatialQueryDefinitions,
];