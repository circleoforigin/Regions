export interface MapImageAsset {
  id: string;

  originalFileName: string;

  mimeType?: string;
  fileSizeBytes?: number;

  source: {
    path: string;
  };

  createdAt: Date;
  updatedAt: Date;
}