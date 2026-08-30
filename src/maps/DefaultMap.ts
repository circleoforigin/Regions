import defaultMapImageUrl from '../assets/default-map.svg';
import type { Map as RegionMap } from '../models/Map';

export const DEFAULT_MAP_IMAGE_ID = 'regions-default-map';
export const DEFAULT_MAP_IMAGE_URL = defaultMapImageUrl;
export const DEFAULT_MAP_WIDTH = 1000;
export const DEFAULT_MAP_HEIGHT = 1000;

interface CreateDefaultMapOptions {
  id: string;
  now: Date;
  parentMapId?: string;
}

export function createDefaultMap(
  options: CreateDefaultMapOptions
): RegionMap {
  return {
    id: options.id,
    name: 'Untitled Map',
    imageFileId: DEFAULT_MAP_IMAGE_ID,
    imageRegistration: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    parentMapId: options.parentMapId,
    featureIds: [],
    createdAt: options.now,
    updatedAt: options.now,
  };
}
