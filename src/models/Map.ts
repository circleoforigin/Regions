export interface MapImageRegistration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Map {
  id: string;
  name: string;

  description?: string;

  imageFileId?: string;
  imageRegistration?: MapImageRegistration;

  parentMapId?: string;
  featureTypeId?: string;

  featureIds: string[];

  createdAt: Date;
  updatedAt: Date;
}
