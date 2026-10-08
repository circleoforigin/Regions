import {
  projectCommandDefinitions,
  projectEventDefinitions,
  projectQueryDefinitions,
} from '@settingforge/module-sdk';
import type {
  CommandDefinition,
  EventDefinition,
} from '@settingforge/module-sdk';
import {
  emitImageEventDefinition,
  locationEventDefinitions,
} from '../events/LocationEvents';
import { regionsSpatialQueryDefinitions } from './RegionsSpatialCapabilities';

const travelCommandDefinition: CommandDefinition = {
  id: 'Regions.Travel',
  label: 'Travel',
  description:
    'Prospects travel for Pieces possessing Routes.',
  input: [
    {
      key: 'startTime',
      label: 'Start Time',
      type: 'number',
      required: true,
    },
  ],
};

const continueTravelCommandDefinition: CommandDefinition = {
  id: 'Regions.ContinueTravel',
  label: 'Continue Travel',
  description:
    'Continues prospective travel for a Piece after an Occurrence breakpoint.',
  input: [
    {
      key: 'pieceId',
      label: 'Piece ID',
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
      key: 'mode',
      label: 'Continuation Mode',
      type: 'string',
      required: true,
    },
    {
      key: 'remainingDistance',
      label: 'Remaining Distance',
      type: 'number',
    },
  ],
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
      key: 'speedMph',
      label: 'Speed MPH',
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
  travelCommandDefinition,
  continueTravelCommandDefinition,
  ...projectCommandDefinitions,
]

export const regionsQueryDefinitions = [
  ...projectQueryDefinitions,
  ...regionsSpatialQueryDefinitions,
];