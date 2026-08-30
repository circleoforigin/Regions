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

  position: FeaturePosition;

  type: string;
  description?: string;

  noteLinks: FeatureNoteLink[];

  targetMapId?: string;
  targetFeatureId?: string;
}
