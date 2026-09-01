import type { FeatureTypeDefinition } from './FeatureTypeDefinition';

export interface Project {
  id: string;
  name: string;

  mapIds: string[];

  rootMapId?: string;
  activeMapId?: string;

  featureTypes: FeatureTypeDefinition[];

  createdAt: Date;
  updatedAt: Date;
}
