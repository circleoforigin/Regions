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

  type: string;
  description?: RichTextDocument | string;

  noteLinks: FeatureNoteLink[];

  targetMapId?: string;
  targetFeatureId?: string;
}
import type { RichTextDocument } from './RichText';
