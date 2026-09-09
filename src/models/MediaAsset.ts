export interface MediaAssetSource {
  path: string;
}

export interface MediaAsset {
  id: string;

  originalFileName: string;
  mimeType: string;
  fileSizeBytes?: number;

  source: MediaAssetSource;

  createdAt: Date;
  updatedAt: Date;
}