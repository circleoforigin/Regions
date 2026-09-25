import type {
  SpatialAnchor,
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export interface StandalonePathTerminal
  extends SpatialAnchor {
  id: string;
  mapId: string;
  position: SpatialPoint;
}

export type PathTerminalReference =
  | {
      kind: 'standalone';
      terminalId: string;
    }
  | {
      kind: 'feature';
      featureId: string;
    };

export interface PathShapePoint {
  id: string;
  position: SpatialPoint;
}

export interface PathSegment {
  id: string;
  mapId: string;

  /*
   * Descriptive only. Names are not
   * identities and do not need to be
   * unique. Multiple connected segments
   * may all be "King's Highway".
   */
  name?: string;

  start: PathTerminalReference;
  end: PathTerminalReference;

  /*
   * Ordered geometry between the two
   * terminals. Terminals themselves are
   * not duplicated here.
   */
  shapePoints: PathShapePoint[];

  /*
   * Semantic vocabulary is supplied by
   * the active Ruleset. Regions stores
   * the assigned facts without
   * interpreting them.
   */
  kindId?: string;
  subtypeId?: string;
  qualityId?: string;

  /*
   * Presentation/organization is kept
   * distinct from semantic kind.
   */
  layerId?: string;

  createdAt: Date;
  updatedAt: Date;
}