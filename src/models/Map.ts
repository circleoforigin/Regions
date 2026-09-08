export interface MapImageRegistration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface MapEntryDisplay {
  alias: string;
  imageFileId: string;
  imagePath: string;
}

export interface Map {
  id: string;
  name: string;

  description?: string;

  imageFileId?: string;
  imageRegistration?: MapImageRegistration;

  entryDisplay?: MapEntryDisplay;

  parentMapId?: string;
  parentLocationId?: string;
  featureTypeId?: string;

  featureIds: string[];
  sectionIds?: string[];

  createdAt: Date;
  updatedAt: Date;
}