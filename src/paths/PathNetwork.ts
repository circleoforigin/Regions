import type {
  Map,
} from '../models/Map';

import type {
  PathSegment,
  StandalonePathTerminal,
} from '../models/Path';

import {
  pathSegmentRepository,
} from './PathSegmentRepository';

import {
  pathTerminalRepository,
} from './PathTerminalRepository';

import {
  loadPathMapState,
} from './PathMapState';

export interface PathNetwork {
  terminals: StandalonePathTerminal[];
  segments: PathSegment[];
}

export async function loadPathNetwork(
  map: Map
): Promise<PathNetwork> {
  return loadPathMapState(map);
}

export async function savePathTerminal(
  map: Map,
  terminal: StandalonePathTerminal
): Promise<Map> {
  await pathTerminalRepository.saveTerminal(
    terminal
  );

  const ids =
    map.pathTerminalIds ?? [];

  if (ids.includes(terminal.id)) {
    return map;
  }

  return {
    ...map,
    pathTerminalIds: [
      ...ids,
      terminal.id,
    ],
    updatedAt: new Date(),
  };
}

export async function savePathSegment(
  map: Map,
  segment: PathSegment
): Promise<Map> {
  await pathSegmentRepository.saveSegment(
    segment
  );

  const ids =
    map.pathSegmentIds ?? [];

  if (ids.includes(segment.id)) {
    return map;
  }

  return {
    ...map,
    pathSegmentIds: [
      ...ids,
      segment.id,
    ],
    updatedAt: new Date(),
  };
}

export async function replacePathSegmentWithSplit(
  map: Map,
  originalSegmentId: string,
  terminal: StandalonePathTerminal,
  first: PathSegment,
  second: PathSegment
): Promise<Map> {
  await pathTerminalRepository.saveTerminal(
    terminal
  );

  await Promise.all([
    pathSegmentRepository.saveSegment(
      first
    ),

    pathSegmentRepository.saveSegment(
      second
    ),
  ]);

  await pathSegmentRepository.deleteSegment(
    originalSegmentId
  );

  const terminalIds =
    map.pathTerminalIds ?? [];

  const segmentIds =
    map.pathSegmentIds ?? [];

  return {
    ...map,

    pathTerminalIds:
      terminalIds.includes(
        terminal.id
      )
        ? terminalIds
        : [
            ...terminalIds,
            terminal.id,
          ],

    pathSegmentIds: [
      ...segmentIds.filter(
        (id) =>
          id !== originalSegmentId
      ),

      first.id,
      second.id,
    ],

    updatedAt: new Date(),
  };
}

export async function deletePathSegment(
  map: Map,
  segmentId: string,
  network: PathNetwork
): Promise<{
  map: Map;
  deletedTerminalIds: string[];
}> {
  const segment =
    network.segments.find(
      (candidate) =>
        candidate.id === segmentId
    );

  if (!segment) {
    return {
      map,
      deletedTerminalIds: [],
    };
  }

  await pathSegmentRepository.deleteSegment(
    segmentId
  );

  const remainingSegments =
    network.segments.filter(
      (candidate) =>
        candidate.id !== segmentId
    );

  const possibleOrphans = [
    segment.start,
    segment.end,
  ].filter(
    (
      reference
    ): reference is Extract<
      typeof reference,
      { kind: 'standalone' }
    > =>
      reference.kind === 'standalone'
  );

  const deletedTerminalIds: string[] = [];

  for (const reference of possibleOrphans) {
    const stillReferenced =
      remainingSegments.some(
        (candidate) =>
          (
            candidate.start.kind ===
              'standalone' &&
            candidate.start.terminalId ===
              reference.terminalId
          ) ||
          (
            candidate.end.kind ===
              'standalone' &&
            candidate.end.terminalId ===
              reference.terminalId
          )
      );

    if (stillReferenced) {
      continue;
    }

    await pathTerminalRepository.deleteTerminal(
      reference.terminalId
    );

    deletedTerminalIds.push(
      reference.terminalId
    );
  }

  return {
    map: {
      ...map,

      pathSegmentIds:
        (
          map.pathSegmentIds ?? []
        ).filter(
          (id) => id !== segmentId
        ),

      pathTerminalIds:
        (
          map.pathTerminalIds ?? []
        ).filter(
          (id) =>
            !deletedTerminalIds.includes(
              id
            )
        ),

      updatedAt: new Date(),
    },

    deletedTerminalIds,
  };
}

export async function movePathTerminal(
  terminal: StandalonePathTerminal,
  position: {
    x: number;
    y: number;
  }
): Promise<StandalonePathTerminal> {
  const updated: StandalonePathTerminal = {
    ...terminal,

    position: {
      ...position,
    },
  };

  await pathTerminalRepository.saveTerminal(
    updated
  );

  return updated;
}

export async function savePathShapePointPosition(
  segment: PathSegment,
  pointId: string,
  position: {
    x: number;
    y: number;
  }
): Promise<PathSegment> {
  const updated: PathSegment = {
    ...segment,

    shapePoints:
      segment.shapePoints.map(
        (point) =>
          point.id === pointId
            ? {
                ...point,
                position: {
                  ...position,
                },
              }
            : point
      ),

    updatedAt: new Date(),
  };

  await pathSegmentRepository.saveSegment(
    updated
  );

  return updated;
}

export async function deletePathShapePoint(
  segment: PathSegment,
  pointId: string
): Promise<PathSegment> {
  const updated: PathSegment = {
    ...segment,

    shapePoints:
      segment.shapePoints.filter(
        (point) =>
          point.id !== pointId
      ),

    updatedAt: new Date(),
  };

  await pathSegmentRepository.saveSegment(
    updated
  );

  return updated;
}