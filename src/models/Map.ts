import type {
  MediaSlotOverride,
} from './MediaSlot';

export interface MapImageRegistration {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface BoundaryAlignment {
  rotation: number;
  zoom: number;
  width: number;
  height: number;
  x: number;
  y: number;
  pivotX: number;
  pivotY: number;
}

export interface AreaBoundaryLink {
  areaId: string;
  alignment: BoundaryAlignment;
}

export interface Map {
  areaBoundaryLink?: AreaBoundaryLink;
  id: string;
  name: string;

  description?: string;

  /*
   * The actual image used to render
   * this Map inside Regions.
   */
  imageFileId?: string;

  imageRegistration?:
    MapImageRegistration;

  /*
   * Optional overrides for the
   * Project's Global Media Slots.
   *
   * A missing slot means:
   * fall back to Global.
   */
  mediaSlotOverrides?:
    MediaSlotOverride[];

  parentMapId?: string;
  parentLocationId?: string;
  featureTypeId?: string;

  featureIds: string[];
  sectionIds?: string[];

  createdAt: Date;
  updatedAt: Date;
}