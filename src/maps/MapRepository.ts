import type {
  Map,
} from '../models/Map';

import {
  hostedCollectionRepository,
} from '../host/HostedCollectionRepository';

const MAPS_COLLECTION =
  'maps';

export class MapRepository {
  async loadMaps(): Promise<Map[]> {
    const maps =
      await hostedCollectionRepository
        .loadAll<Map>(
          MAPS_COLLECTION
        );

    return Array.isArray(maps)
      ? maps
      : [];
  }

  async loadMap(
    mapId: string
  ): Promise<Map | null> {
    const maps =
      await this.loadMaps();

    return (
      maps.find(
        (map) =>
          map.id === mapId
      ) ?? null
    );
  }

  async saveMap(
    map: Map
  ): Promise<void> {
    await hostedCollectionRepository.save(
      MAPS_COLLECTION,
      map.id,
      map
    );
  }

  async deleteMap(
    mapId: string
  ): Promise<boolean> {
    return hostedCollectionRepository.delete(
      MAPS_COLLECTION,
      mapId
    );
  }
}

export const mapRepository =
  new MapRepository();