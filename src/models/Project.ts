import type { FeatureTypeDefinition } from './FeatureTypeDefinition';
import type { GlobalMediaSlot } from './MediaSlot';
import type { Piece } from './Piece';
import type { Route } from './Route';

export interface Project {
  id: string;
  name: string;
  mapIds: string[];

  rootMapId?: string;
  activeMapId?: string;

  featureTypes:
    FeatureTypeDefinition[];

  pieces: Piece[];
  routes: Route[];
  focusedPieceId?: string;

  /*
   * Defines the complete set of logical
   * media slots available throughout
   * this Regions Project.
   *
   * Maps and Areas may override these
   * slots, but cannot create additional
   * slots of their own.
   */
  globalMediaSlots:
    GlobalMediaSlot[];

  createdAt: Date;
  updatedAt: Date;
}