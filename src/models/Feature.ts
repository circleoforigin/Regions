import type { RichTextDocument } from './RichText';
import type {
  SpatialAnchor,
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export type FeaturePosition = SpatialPoint;

export interface FeatureNoteLink {
  noteId: string;
  sectionId: string;
}

export interface Feature extends SpatialAnchor {
  id: string;
  name: string;
  subtitle?: string;

  position: FeaturePosition;

  type: 'feature' | 'location' | 'connection';
  description?: RichTextDocument | string;
  featureTypeId?: string;
  showLabel?: boolean;

  noteLinks: FeatureNoteLink[];

  targetMapId?: string;
  targetFeatureId?: string;

  journalPageId?: string;

  connectionPlacementPending?: boolean;
}
