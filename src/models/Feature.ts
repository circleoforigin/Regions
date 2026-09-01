import type { RichTextDocument } from './RichText';

export interface FeaturePosition {
  x: number;
  y: number;
}

export interface FeatureNoteLink {
  noteId: string;
  sectionId: string;
}

export interface Feature {
  id: string;
  name: string;
  subtitle?: string;

  position: FeaturePosition;

  type: 'feature' | 'location';
  description?: RichTextDocument | string;
  featureTypeId?: string;
  showLabel?: boolean;

  noteLinks: FeatureNoteLink[];

  targetMapId?: string;
  targetFeatureId?: string;
}
