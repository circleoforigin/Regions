import type { SpatialPoint } from '../spatial/SpatialAnchor';

export interface Route {
  id: string;
  pieceId: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface RouteNodeSource {
  moduleId: string;
  type: string;
  referenceId?: string;
}

export type RouteNode =
  | {
      id: string;
      mapId: string;
      source?: RouteNodeSource;
      label?: string;
      kind: 'path';
      segmentId: string;
      position: SpatialPoint;
      usePathFromPrevious?: boolean;
    }
  | {
      id: string;
      mapId: string;
      source?: RouteNodeSource;
      label?: string;
      kind: 'terminal';
      terminalId: string;
      usePathFromPrevious?: boolean;
    }
  | {
      id: string;
      mapId: string;
      source?: RouteNodeSource;
      label?: string;
      kind: 'feature';
      featureId: string;
      usePathFromPrevious?: boolean;
    }
  | {
      id: string;
      mapId: string;
      source?: RouteNodeSource;
      label?: string;
      kind: 'point';
      position: SpatialPoint;
      usePathFromPrevious?: boolean;
    };

export interface RouteLeg {
  id: string;
  routeId: string;
  pieceId: string;
  index: number;
  start: RouteNode;
  end: RouteNode;
}

export function getRouteLegs( route: Route ): RouteLeg[]
{
  const legs: RouteLeg[] = [];

  for (
    let index = 0;
    index < route.nodes.length - 1;
    index += 1
  ) {
    const start = route.nodes[index];
    const end = route.nodes[index + 1];

    legs.push({
        id: `${start.id}:${end.id}`,
        routeId: route.id,
        pieceId: route.pieceId,
        index,
        start,
        end,
    });
  }

  return legs;
}