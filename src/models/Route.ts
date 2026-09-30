import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

export interface Route {
    id: string;
    pieceId: string;
  /*
   * Ordered route nodes.
   *
   * The first node is the current
   * journey origin. As the Piece
   * progresses, earlier nodes are
   * discarded while the reached node
   * remains as the new origin.
   *
   * When the Piece reaches the final
   * node, the route is complete.
   */
  nodes: RouteNode[];
}

export type RouteNode =
  | {
      kind: 'path';
      segmentId: string;
      position: SpatialPoint;
      usePathFromPrevious?: boolean;
    }
  | {
      kind: 'terminal';
      terminalId: string;
      usePathFromPrevious?: boolean;
    }
  | {
      kind: 'feature';
      featureId: string;
      usePathFromPrevious?: boolean;
    }
  | {
      kind: 'point';
      position: SpatialPoint;
      usePathFromPrevious?: boolean;
    };