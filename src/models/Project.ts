import type { FeatureTypeDefinition } from './FeatureTypeDefinition';
import type { Piece } from './Piece';

export interface Project {
  id: string;
  name: string;

  mapIds: string[];

  rootMapId?: string;
  activeMapId?: string;

  featureTypes: FeatureTypeDefinition[];
  pieces: Piece[];
  focusedPieceId?: string;

  createdAt: Date;
  updatedAt: Date;
}
