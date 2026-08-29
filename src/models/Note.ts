export interface NoteSection {
  id: string;

  sourceFeatureId?: string;

  heading: string;
  body: string;

  keywords: string[];
}

export interface Note {
  id: string;
  title: string;

  sections: NoteSection[];

  createdAt: Date;
  updatedAt: Date;
}