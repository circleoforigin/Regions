import type {
  SpatialAnchor,
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import type {
  RulesetExtensionData,
} from './RulesetExtensionData';

import type {
  RichTextDocument,
} from './RichText';

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

export type PathType =
  | 'path'
  | 'road'
  | 'river'
  | 'creek'
  | 'airway';

export interface PathSegment {
  id: string;
  mapId: string;
  type: PathType;

   /*
   * Descriptive data is optional.
   * Creating/drawing a Path does not
   * require the user to provide it.
   *
   * Names are not identities and do not
   * need to be unique. Multiple connected
   * segments may all be "King's Highway".
   */
  name?: string;
  subtitle?: string;
  description?: RichTextDocument | string;
  journalPageId?: string;

  start: PathTerminalReference;
  end: PathTerminalReference;

  /*
   * Ordered geometry between the two
   * terminals. Terminals themselves are
   * not duplicated here.
   */
  shapePoints: PathShapePoint[];

    /*
   * Optional data defined by the active
   * Ruleset. Regions persists this data
   * but does not interpret its meaning.
   */
  rulesetData?: RulesetExtensionData;

  /*
   * Presentation/organization is kept
   * distinct from semantic kind.
   */
  layerId?: string;

  createdAt: Date;
  updatedAt: Date;
}