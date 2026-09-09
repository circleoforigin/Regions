export type MediaSlotType =
  | 'image'
  | 'video';

export interface MediaSlotMedia {
  mediaType: MediaSlotType;

  fileId: string;
  filePath: string;
  fileName: string;
}

export interface GlobalMediaSlot {
  slot: number;

  media?: MediaSlotMedia;
}

export interface MediaSlotOverride {
  slot: number;

  media: MediaSlotMedia;
}

export interface ResolvedMediaSlot {
  slot: number;

  mediaType: MediaSlotType;

  fileId: string;
  filePath: string;

  source:
    | 'global'
    | 'map'
    | 'area';
}