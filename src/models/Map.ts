import type {
  Feature,
} from './Feature';

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

  features: Feature[];

  createdAt: Date;
  updatedAt: Date;
}