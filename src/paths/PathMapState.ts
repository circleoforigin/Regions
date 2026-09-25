import type {
  Feature,
} from '../models/Feature';

import type {
  Map,
} from '../models/Map';

import type {
  PathSegment,
  PathTerminalReference,
  StandalonePathTerminal,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import {
  pathSegmentRepository,
} from './PathSegmentRepository';

import {
  pathTerminalRepository,
} from './PathTerminalRepository';

export interface PathMapState {
  terminals: StandalonePathTerminal[];
  segments: PathSegment[];
}

export interface ResolvedPathTerminal {
  reference: PathTerminalReference;
  position: SpatialPoint;

  /*
   * The underlying object when this
   * terminal is supplied by an existing
   * Feature/Location/Connection.
   */
  feature?: Feature;

  /*
   * Present only for a standalone
   * terminal.
   */
  terminal?: StandalonePathTerminal;
}

export interface ResolvedPathSegment {
  segment: PathSegment;
  start: ResolvedPathTerminal;
  end: ResolvedPathTerminal;
}

export async function loadPathMapState(
  map: Map
): Promise<PathMapState> {
  const [
    terminals,
    segments,
  ] = await Promise.all([
    pathTerminalRepository.loadTerminals(
      map.pathTerminalIds ?? []
    ),

    pathSegmentRepository.loadSegments(
      map.pathSegmentIds ?? []
    ),
  ]);

  return {
    terminals,
    segments,
  };
}

export function resolvePathTerminal(
  reference: PathTerminalReference,
  terminals: StandalonePathTerminal[],
  features: Feature[]
): ResolvedPathTerminal | null {
  if (reference.kind === 'standalone') {
    const terminal = terminals.find(
      (candidate) =>
        candidate.id ===
        reference.terminalId
    );

    if (!terminal) {
      return null;
    }

    return {
      reference,
      position: terminal.position,
      terminal,
    };
  }

  const feature = features.find(
    (candidate) =>
      candidate.id ===
      reference.featureId
  );

  if (!feature) {
    return null;
  }

  return {
    reference,
    position: feature.position,
    feature,
  };
}

export function resolvePathSegment(
  segment: PathSegment,
  terminals: StandalonePathTerminal[],
  features: Feature[]
): ResolvedPathSegment | null {
  const start = resolvePathTerminal(
    segment.start,
    terminals,
    features
  );

  const end = resolvePathTerminal(
    segment.end,
    terminals,
    features
  );

  if (!start || !end) {
    return null;
  }

  return {
    segment,
    start,
    end,
  };
}

export function resolvePathSegments(
  segments: PathSegment[],
  terminals: StandalonePathTerminal[],
  features: Feature[]
): ResolvedPathSegment[] {
  return segments
    .map((segment) =>
      resolvePathSegment(
        segment,
        terminals,
        features
      )
    )
    .filter(
      (
        segment
      ): segment is ResolvedPathSegment =>
        segment !== null
    );
}

export function getPathSegmentPoints(
  resolved: ResolvedPathSegment
): SpatialPoint[] {
  return [
    resolved.start.position,
    ...resolved.segment.shapePoints.map(
      (point) => point.position
    ),
    resolved.end.position,
  ];
}

export function getPathSegmentMapDistance(
  resolved: ResolvedPathSegment
): number {
  const points =
    getPathSegmentPoints(resolved);

  let distance = 0;

  for (
    let index = 1;
    index < points.length;
    index += 1
  ) {
    const previous =
      points[index - 1];

    const current =
      points[index];

    distance += Math.hypot(
      current.x - previous.x,
      current.y - previous.y
    );
  }

  return distance;
}