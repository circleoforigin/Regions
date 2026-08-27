import type {
  Feature,
} from './Feature';

export interface Map {
  id: string;
  name: string;

  description?: string;

  imageFileId?: string;

  parentMapId?: string;

  features: Feature[];

  createdAt: Date;
  updatedAt: Date;
}