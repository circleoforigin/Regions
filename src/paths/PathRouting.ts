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

function pointDistance(
  a: SpatialPoint,
  b: SpatialPoint
): number {
  return Math.hypot(
    b.x - a.x,
    b.y - a.y
  );
}

function polylineDistance(
  points: SpatialPoint[]
): number {
  let total = 0;

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    total += pointDistance(
      points[index - 1],
      points[index]
    );
  }

  return total;
}

function reversePoints(
  points: SpatialPoint[]
): SpatialPoint[] {
  return [...points].reverse();
}

function pathFromStartToPosition(
  segment: ResolvedPathSegment,
  position: SpatialPoint
): SpatialPoint[] {
  const projection =
    projectPointOntoPath(
      segment,
      position
    );

  const points =
    getPathSegmentPoints(segment);

  return [
    ...points.slice(
      0,
      projection.legIndex + 1
    ),
    projection.position,
  ];
}

function pathFromPositionToEnd(
  segment: ResolvedPathSegment,
  position: SpatialPoint
): SpatialPoint[] {
  const projection =
    projectPointOntoPath(
      segment,
      position
    );

  const points =
    getPathSegmentPoints(segment);

  return [
    projection.position,
    ...points.slice(
      projection.legIndex + 1
    ),
  ];
}

function pathBetweenPositions(
  segment: ResolvedPathSegment,
  start: SpatialPoint,
  end: SpatialPoint
): SpatialPoint[] {
  const startProjection =
    projectPointOntoPath(
      segment,
      start
    );

  const endProjection =
    projectPointOntoPath(
      segment,
      end
    );

  const points =
    getPathSegmentPoints(segment);

  if (
    startProjection.legIndex ===
    endProjection.legIndex
  ) {
    return [
      startProjection.position,
      endProjection.position,
    ];
  }

  if (
    startProjection.legIndex <
    endProjection.legIndex
  ) {
    return [
      startProjection.position,
      ...points.slice(
        startProjection.legIndex + 1,
        endProjection.legIndex + 1
      ),
      endProjection.position,
    ];
  }

  return reversePoints(
    pathBetweenPositions(
      segment,
      end,
      start
    )
  );
}

function addEdge(
  graph: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  points: SpatialPoint[],
  segmentId: string
) {
  const edge: GraphEdge = {
    to,
    points,
    segmentId,
    distance:
      polylineDistance(points),
  };

  const existing =
    graph.get(from) ?? [];

  graph.set(
    from,
    [...existing, edge]
  );
}

function addBidirectionalEdge(
  graph: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  points: SpatialPoint[],
  segmentId: string
) {
  addEdge(
    graph,
    from,
    to,
    points,
    segmentId
  );

  addEdge(
    graph,
    to,
    from,
    reversePoints(points),
    segmentId
  );
}

export function findPathRoute(
  start: PathRouteEndpoint,
  end: PathRouteEndpoint,
  segments: ResolvedPathSegment[]
): PathRoute | null {
  const graph =
    new Map<string, GraphEdge[]>();

  for (const resolved of segments) {
    addBidirectionalEdge(
      graph,
      terminalKey(
        resolved.segment.start
      ),
      terminalKey(
        resolved.segment.end
      ),
      getPathSegmentPoints(resolved),
      resolved.segment.id
    );
  }

  const START = '__route_start__';
  const END = '__route_end__';

  if (start.kind === 'terminal') {
    addBidirectionalEdge(
      graph,
      START,
      terminalKey(start.reference),
      [],
      ''
    );
  } else {
    const segment =
      segments.find(
        (candidate) =>
          candidate.segment.id ===
            start.segmentId
      );

    if (!segment) {
      return null;
    }

    const toStart =
      pathFromStartToPosition(
        segment,
        start.position
      );

    const toEnd =
      pathFromPositionToEnd(
        segment,
        start.position
      );

    addBidirectionalEdge(
      graph,
      START,
      terminalKey(
        segment.segment.start
      ),
      reversePoints(toStart),
      segment.segment.id
    );

    addBidirectionalEdge(
      graph,
      START,
      terminalKey(
        segment.segment.end
      ),
      toEnd,
      segment.segment.id
    );
  }

  if (end.kind === 'terminal') {
    addBidirectionalEdge(
      graph,
      END,
      terminalKey(end.reference),
      [],
      ''
    );
  } else {
    const segment =
      segments.find(
        (candidate) =>
          candidate.segment.id ===
            end.segmentId
      );

    if (!segment) {
      return null;
    }

    const fromStart =
      pathFromStartToPosition(
        segment,
        end.position
      );

    const toEnd =
      pathFromPositionToEnd(
        segment,
        end.position
      );

    addBidirectionalEdge(
      graph,
      terminalKey(
        segment.segment.start
      ),
      END,
      fromStart,
      segment.segment.id
    );

    addBidirectionalEdge(
      graph,
      terminalKey(
        segment.segment.end
      ),
      END,
      reversePoints(toEnd),
      segment.segment.id
    );
  }

  /*
   * If both temporary endpoints lie on
   * the same Segment, they may travel
   * directly between their positions
   * without visiting either Terminal.
   */
  if (
    start.kind === 'segment' &&
    end.kind === 'segment' &&
    start.segmentId === end.segmentId
  ) {
    const segment =
      segments.find(
        (candidate) =>
          candidate.segment.id ===
            start.segmentId
      );

    if (segment) {
      addBidirectionalEdge(
        graph,
        START,
        END,
        pathBetweenPositions(
          segment,
          start.position,
          end.position
        ),
        segment.segment.id
      );
    }
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

  unvisited.add(START);
  unvisited.add(END);

  for (const node of unvisited) {
    distances.set(
      node,
      node === START
        ? 0
        : Infinity
    );
  }

  while (unvisited.size > 0) {
    let current: string | null =
      null;

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

  const routeEdges: GraphEdge[] =
    [];

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

  const points: SpatialPoint[] =
    [];

  const segmentIds: string[] =
    [];

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
        previousPoint.x === point.x &&
        previousPoint.y === point.y
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