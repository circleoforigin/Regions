import type {
  FeatureTypeDefinition,
} from '../models/FeatureTypeDefinition';

export type FeatureTypePreset =
  Pick<
    FeatureTypeDefinition,
    'name' | 'properties'
  > & {
    presetId: string;
  };

export const featureTypePresets:
  FeatureTypePreset[] = [
    {
      presetId: 'regions.terrain.forest',
      name: 'Forest',
    },
    {
      presetId: 'regions.terrain.grassland',
      name: 'Grassland',
    },
    {
      presetId: 'regions.terrain.desert',
      name: 'Desert',
    },
    {
      presetId: 'regions.terrain.swamp',
      name: 'Swamp',
    },
    {
      presetId: 'regions.terrain.mountains',
      name: 'Mountains',
    },
    {
      presetId: 'regions.terrain.hills',
      name: 'Hills',
    },
    {
      presetId: 'regions.terrain.lake',
      name: 'Lake',
    },
    {
      presetId: 'regions.terrain.ocean',
      name: 'Ocean',
    },
    {
      presetId: 'regions.terrain.coast',
      name: 'Coast',
    },
    {
      presetId: 'regions.terrain.arctic',
      name: 'Arctic',
    },
    {
      presetId: 'regions.terrain.urban',
      name: 'Urban',
    },
    {
      presetId: 'regions.terrain.underground',
      name: 'Underground',
    },
  ];