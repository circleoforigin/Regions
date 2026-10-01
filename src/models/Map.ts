import type {
  MediaSlotOverride,
} from './MediaSlot';
import type {
  RulesetExtensionData,
} from './RulesetExtensionData';

export type MapDistanceUnit =
  | 'feet'
  | 'miles'
  | 'meters'
  | 'kilometers';

  export type MapSimulationScale =
  | 'overworld'
  | 'area'
  | 'local'
  | 'special';

export interface MapImageRegistration {
  scale: number;
  offsetX: number;
  offsetY: number;

  distanceScale?: {
    distance: number;
    pixels: number;
    unit: MapDistanceUnit;
  };
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
  simulationScale?: MapSimulationScale;
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

  pathTerminalIds?: string[];
  pathSegmentIds?: string[];

  /*
  * Optional data defined by the active
  * Ruleset. Regions persists this data
  * but does not interpret its meaning.
  */
  rulesetData?: RulesetExtensionData;

  createdAt: Date;
  updatedAt: Date;
}