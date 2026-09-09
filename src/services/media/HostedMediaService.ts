import type {
  MediaAsset,
} from '../../models/MediaAsset';

import {
  hostedCollectionRepository,
} from '../../host/HostedCollectionRepository';

import {
  hostedFileRepository,
} from '../../host/HostedFileRepository';

const MEDIA_COLLECTION =
  'mediaAssets';

const MEDIA_FOLDER =
  'media';

export class HostedMediaService {
  async importLocalFile(
    file: File
  ): Promise<MediaAsset> {
    const id =
      crypto.randomUUID();

    const fileName =
      this.createManagedFileName(
        id,
        file.name
      );

    await hostedFileRepository.saveFile(
      MEDIA_FOLDER,
      fileName,
      file
    );

    const now =
      new Date();

    const asset: MediaAsset = {
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
      MEDIA_COLLECTION,
      asset.id,
      asset
    );

    return asset;
  }

  async loadAsset(
    assetId: string
  ): Promise<MediaAsset | null> {
    return hostedCollectionRepository.load<MediaAsset>(
      MEDIA_COLLECTION,
      assetId
    );
  }

  async readMedia(
    asset: MediaAsset
  ): Promise<Blob | null> {
    return hostedFileRepository.readBlob(
      MEDIA_FOLDER,
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

export const hostedMediaService =
  new HostedMediaService();