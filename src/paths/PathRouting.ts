import type {
  PathTerminalReference,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import {
  getPathSegmentPoints,
  type ResolvedPathSegment,
} from './PathMapState';

import {
  projectPointOntoPath,
} from './PathGeometry';

export type PathRouteEndpoint =
  | {
      kind: 'terminal';
      reference: PathTerminalReference;
    }
  | {
      kind: 'segment';
      segmentId: string;
      position: SpatialPoint;
    };

export interface PathRoute {
  distance: number;
  points: SpatialPoint[];
  segmentIds: string[];
}

interface GraphEdge {
  to: string;
  distance: number;
  points: SpatialPoint[];
  segmentId: string;
}

function terminalKey(
  reference: PathTerminalReference
): string {
  return reference.kind === 'feature'
    ? `feature:${reference.featureId}`
    : `terminal:${reference.terminalId}`;
}

function shapeKey(
  segmentId: string,
  shapePointId: string
): string {
  return `shape:${segmentId}:${shapePointId}`;
}

function pointDistance(
  a: SpatialPoint,
  b: SpatialPoint
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y
  );
}

function addEdge(
  graph: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  points: SpatialPoint[],
  segmentId: string
) {
  const distance =
    points.length >= 2
      ? pointDistance(
          points[0],
          points[points.length - 1]
        )
      : 0;

  graph.set(
    from,
    [
      ...(graph.get(from) ?? []),
      {
        to,
        distance,
        points,
        segmentId,
      },
    ]
  );

  if (!graph.has(to)) {
    graph.set(to, []);
  }
}

function addBidirectionalEdge(
  graph: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  start: SpatialPoint,
  end: SpatialPoint,
  segmentId: string
) {
  addEdge(
    graph,
    from,
    to,
    [start, end],
    segmentId
  );

  addEdge(
    graph,
    to,
    from,
    [end, start],
    segmentId
  );
}

function getGeometryKeys(
  segment: ResolvedPathSegment
): string[] {
  return [
    terminalKey(
      segment.segment.start
    ),

    ...segment.segment.shapePoints.map(
      (point) =>
        shapeKey(
          segment.segment.id,
          point.id
        )
    ),

    terminalKey(
      segment.segment.end
    ),
  ];
}

function attachSegmentEndpoint(
  graph: Map<string, GraphEdge[]>,
  syntheticKey: string,
  endpoint: Extract<
    PathRouteEndpoint,
    { kind: 'segment' }
  >,
  segments: ResolvedPathSegment[]
): boolean {
  const segment =
    segments.find(
      (candidate) =>
        candidate.segment.id ===
        endpoint.segmentId
    );

  if (!segment) {
    return false;
  }

  const projection =
    projectPointOntoPath(
      segment,
      endpoint.position
    );

  const points =
    getPathSegmentPoints(segment);

  const keys =
    getGeometryKeys(segment);

  const beforeIndex =
    projection.legIndex;

  const afterIndex =
    projection.legIndex + 1;

  const before =
    points[beforeIndex];

  const after =
    points[afterIndex];

  const beforeDistance =
    pointDistance(
      projection.position,
      before
    );

  const afterDistance =
    pointDistance(
      projection.position,
      after
    );

  /*
   * A Path-mounted measurement joins the
   * network through the nearest existing
   * Path geometry node bounding the leg.
   *
   * Those nodes are either:
   * - a Terminal
   * - a Shape Point
   *
   * This guarantees routed measurement
   * follows the authored Path geometry.
   */
  const useBefore =
    beforeDistance <= afterDistance;

  const targetIndex =
    useBefore
      ? beforeIndex
      : afterIndex;

  const targetPoint =
    points[targetIndex];

  const targetKey =
    keys[targetIndex];

  addBidirectionalEdge(
    graph,
    syntheticKey,
    targetKey,
    projection.position,
    targetPoint,
    segment.segment.id
  );

  return true;
}

export function findPathRoute(
  start: PathRouteEndpoint,
  end: PathRouteEndpoint,
  segments: ResolvedPathSegment[]
): PathRoute | null {
  const graph =
    new Map<string, GraphEdge[]>();

  /*
   * Shape Points are real routing vertices.
   *
   * A PathSegment is therefore represented
   * as the exact authored chain:
   *
   * Terminal
   *   -> Shape
   *   -> Shape
   *   -> Terminal
   */
  for (const segment of segments) {
    const points =
      getPathSegmentPoints(segment);

    const keys =
      getGeometryKeys(segment);

    for (
      let index = 1;
      index < points.length;
      index += 1
    ) {
      addBidirectionalEdge(
        graph,
        keys[index - 1],
        keys[index],
        points[index - 1],
        points[index],
        segment.segment.id
      );
    }
  }

  const START =
    '__route_start__';

  const END =
    '__route_end__';

  graph.set(START, []);
  graph.set(END, []);

  if (start.kind === 'terminal') {
    const key =
      terminalKey(
        start.reference
      );

    addEdge(
      graph,
      START,
      key,
      [],
      ''
    );
  } else if (
    !attachSegmentEndpoint(
      graph,
      START,
      start,
      segments
    )
  ) {
    return null;
  }

  if (end.kind === 'terminal') {
    const key =
      terminalKey(
        end.reference
      );

    addEdge(
      graph,
      key,
      END,
      [],
      ''
    );
  } else {
    const endpointKey =
      '__route_end_attachment__';

    graph.set(endpointKey, []);

    if (
      !attachSegmentEndpoint(
        graph,
        endpointKey,
        end,
        segments
      )
    ) {
      return null;
    }

    /*
     * attachSegmentEndpoint is bidirectional,
     * so the network can reach endpointKey.
     */
    addEdge(
      graph,
      endpointKey,
      END,
      [],
      ''
    );
  }

  const distances =
    new Map<string, number>();

  const previous =
    new Map<
      string,
      {
        node: string;
        edge: GraphEdge;
      }
    >();

  const unvisited =
    new Set<string>(
      graph.keys()
    );

  for (const node of unvisited) {
    distances.set(
      node,
      node === START
        ? 0
        : Infinity
    );
  }

  while (unvisited.size > 0) {
    let current:
      string | null = null;

    let currentDistance =
      Infinity;

    for (const node of unvisited) {
      const distance =
        distances.get(node) ??
        Infinity;

      if (
        distance <
        currentDistance
      ) {
        current = node;
        currentDistance =
          distance;
      }
    }

    if (
      current === null ||
      !Number.isFinite(
        currentDistance
      )
    ) {
      break;
    }

    if (current === END) {
      break;
    }

    unvisited.delete(current);

    for (
      const edge of
        graph.get(current) ?? []
    ) {
      if (
        !unvisited.has(edge.to)
      ) {
        continue;
      }

      const candidate =
        currentDistance +
        edge.distance;

      if (
        candidate <
        (
          distances.get(edge.to) ??
          Infinity
        )
      ) {
        distances.set(
          edge.to,
          candidate
        );

        previous.set(
          edge.to,
          {
            node: current,
            edge,
          }
        );
      }
    }
  }

  const distance =
    distances.get(END);

  if (
    distance === undefined ||
    !Number.isFinite(distance)
  ) {
    return null;
  }

  const routeEdges:
    GraphEdge[] = [];

  let cursor = END;

  while (cursor !== START) {
    const step =
      previous.get(cursor);

    if (!step) {
      return null;
    }

    routeEdges.unshift(
      step.edge
    );

    cursor = step.node;
  }

  const points:
    SpatialPoint[] = [];

  const segmentIds:
    string[] = [];

  for (const edge of routeEdges) {
    if (
      edge.segmentId &&
      segmentIds.at(-1) !==
        edge.segmentId
    ) {
      segmentIds.push(
        edge.segmentId
      );
    }

    for (const point of edge.points) {
      const previousPoint =
        points.at(-1);

      if (
        previousPoint &&
        previousPoint.x ===
          point.x &&
        previousPoint.y ===
          point.y
      ) {
        continue;
      }

      points.push(point);
    }
  }

  return {
    distance,
    points,
    segmentIds,
  };
}