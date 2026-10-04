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

const travelRequestedEventDefinition: EventDefinition = {
  id: 'Simulation.TravelRequested',
  label: 'Travel Requested',
  description:
    'Requests that the active Regions travel route begin prospective simulation.',
  fields: [],
};

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
      required: true,
    },
    {
      key: 'routeId',
      label: 'Route ID',
      type: 'string',
      required: true,
    },
    {
      key: 'routeLegId',
      label: 'Route Leg ID',
      type: 'string',
      required: true,
    },
    {
      key: 'startTime',
      label: 'Start Time',
      type: 'number',
      required: true,
    },
    {
      key: 'endTime',
      label: 'End Time',
      type: 'number',
      required: true,
    },
    {
      key: 'duration',
      label: 'Duration',
      type: 'number',
      required: true,
    },
    {
      key: 'distance',
      label: 'Distance',
      type: 'object',
      required: true,
    },
    {
      key: 'pace',
      label: 'Travel Pace',
      type: 'string',
      required: true,
    },
    {
      key: 'spatialContext',
      label: 'Spatial Context',
      type: 'object',
      required: true,
    },
  ],
};

export const regionsEventDefinitions:
  EventDefinition[] = [
    ...locationEventDefinitions,
    emitImageEventDefinition,
    travelRequestedEventDefinition,
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