import type {
  QueryDefinition,
} from '@settingforge/module-sdk';

export const regionsSpatialQueryDefinitions:
  QueryDefinition[] = [
    {
      id: 'Regions.GetPiecePosition',
      label: 'Get Piece Position',
      description:
        'Returns the current spatial position of a Piece or Party.',
      input: [
        {
          key: 'pieceId',
          label: 'Piece ID',
          type: 'string',
          required: true,
        },
      ],
      output: [
        {
          key: 'pieceId',
          label: 'Piece ID',
          type: 'string',
          required: true,
        },
        {
          key: 'mapId',
          label: 'Map ID',
          type: 'string',
          required: true,
        },
        {
          key: 'position',
          label: 'Position',
          type: 'object',
          required: true,
        },
      ],
    },

    {
      id: 'Regions.GetFeaturePosition',
      label: 'Get Feature Position',
      description:
        'Returns the spatial position of a Feature, Location, or Connection on a Map.',
      input: [
        {
          key: 'featureId',
          label: 'Feature ID',
          type: 'string',
          required: true,
        },
      ],
      output: [
        {
          key: 'featureId',
          label: 'Feature ID',
          type: 'string',
          required: true,
        },
        {
          key: 'mapId',
          label: 'Map ID',
          type: 'string',
          required: true,
        },
        {
          key: 'position',
          label: 'Position',
          type: 'object',
          required: true,
        },
      ],
    },

    {
      id: 'Regions.GetMapScale',
      label: 'Get Map Scale',
      description:
        'Returns the real-world distance calibration for a Map.',
      input: [
        {
          key: 'mapId',
          label: 'Map ID',
          type: 'string',
          required: true,
        },
      ],
      output: [
        {
          key: 'mapId',
          label: 'Map ID',
          type: 'string',
          required: true,
        },
        {
          key: 'calibrated',
          label: 'Calibrated',
          type: 'boolean',
          required: true,
        },
        {
          key: 'distanceScale',
          label: 'Distance Scale',
          type: 'object',
        },
      ],
    },
  ];