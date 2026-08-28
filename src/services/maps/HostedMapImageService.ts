import type {
  MapImageAsset,
} from '../../models/MapImageAsset';

import {
  hostedCollectionRepository,
} from '../../host/HostedCollectionRepository';

import {
  hostedFileRepository,
} from '../../host/HostedFileRepository';

const MAP_IMAGE_COLLECTION =
  'mapImages';

const IMAGE_FOLDER =
  'images';

export class HostedMapImageService {
  async importLocalFile(
    file: File
  ): Promise<MapImageAsset> {
    const id =
      crypto.randomUUID();

    const fileName =
      this.createManagedFileName(
        id,
        file.name
      );

    await hostedFileRepository.saveFile(
      IMAGE_FOLDER,
      fileName,
      file
    );

    const now =
      new Date();

    const asset: MapImageAsset = {
      id,

      originalFileName:
        file.name,

      mimeType:
        file.type,

      fileSizeBytes:
        file.size,

      source: {
        path:
          fileName,
      },

      createdAt:
        now,

      updatedAt:
        now,
    };

    await hostedCollectionRepository.save(
      MAP_IMAGE_COLLECTION,
      asset.id,
      asset
    );

    return asset;
  }

  async loadAsset(
    assetId: string
  ): Promise<MapImageAsset | null> {
    const assets =
      await hostedCollectionRepository
        .loadAll<MapImageAsset>(
          MAP_IMAGE_COLLECTION
        );

    return (
      assets.find(
        (asset) =>
          asset.id === assetId
      ) ?? null
    );
  }

  async readImage(
    asset: MapImageAsset
  ): Promise<Blob | null> {
    return hostedFileRepository.readBlob(
      IMAGE_FOLDER,
      asset.source.path,
      asset.mimeType ??
        'application/octet-stream'
    );
  }

  private createManagedFileName(
    id: string,
    originalFileName: string
  ): string {
    const match =
      originalFileName.match(
        /\.([A-Za-z0-9]+)$/
      );

    if (!match) {
      return id;
    }

    return `${id}.${match[1].toLowerCase()}`;
  }
}

export const hostedMapImageService =
  new HostedMapImageService();