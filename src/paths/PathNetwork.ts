import type {
  Map,
} from '../models/Map';

import type {
  PathSegment,
  StandalonePathTerminal,
} from '../models/Path';
import type { Feature } from '../models/Feature';
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

export async function detachFeatureFromPathNetwork(
  map: Map,
  feature: Feature,
  network: PathNetwork
): Promise<{
  map: Map;
  network: PathNetwork;
}>
{
  const connectedSegments =
    network.segments.filter((segment) =>
    {
      return (
        (
          segment.start.kind === 'feature' &&
          segment.start.featureId === feature.id
        ) ||
        (
          segment.end.kind === 'feature' &&
          segment.end.featureId === feature.id
        )
      );
    });

  if (connectedSegments.length === 0)
  {
    return { map, network };
  }

  const now = new Date();

  const terminal: StandalonePathTerminal = {
    id: crypto.randomUUID(),
    mapId: map.id,
    position: { ...feature.position },
  };

  const replaceReference = (
    reference: PathSegment['start']
  ): PathSegment['start'] =>
  {
    if (
      reference.kind === 'feature' &&
      reference.featureId === feature.id
    )
    {
      return {
        kind: 'standalone',
        terminalId: terminal.id,
      };
    }

    return reference;
  };

  const updatedSegments =
    network.segments.map((segment) =>
    {
      if (!connectedSegments.includes(segment))
      {
        return segment;
      }

      return {
        ...segment,
        start: replaceReference(segment.start),
        end: replaceReference(segment.end),
        updatedAt: now,
      };
    });

  // Persist the Terminal before redirecting Path references.
  await pathTerminalRepository.saveTerminal(terminal);

  await Promise.all(
    updatedSegments
      .filter((segment) =>
        connectedSegments.some(
          (connected) => connected.id === segment.id
        )
      )
      .map((segment) =>
        pathSegmentRepository.saveSegment(segment)
      )
  );

  return {
    map: {
      ...map,
      pathTerminalIds: [
        ...(map.pathTerminalIds ?? []),
        terminal.id,
      ],
      updatedAt: now,
    },

    network: {
      terminals: [
        ...network.terminals,
        terminal,
      ],
      segments: updatedSegments,
    },
  };
}

export async function deleteOrphanPathTerminal(
  map: Map,
  terminalId: string,
  network: PathNetwork
): Promise<{
  map: Map;
  network: PathNetwork;
  deleted: boolean;
}>
{
  const terminal = network.terminals.find(
    (candidate) => candidate.id === terminalId
  );

  if (!terminal)
  {
    return { map, network, deleted: false };
  }

  const isAttached = network.segments.some((segment) =>
  {
    return (
      (
        segment.start.kind === 'standalone' &&
        segment.start.terminalId === terminalId
      ) ||
      (
        segment.end.kind === 'standalone' &&
        segment.end.terminalId === terminalId
      )
    );
  });

  if (isAttached)
  {
    return { map, network, deleted: false };
  }

  await pathTerminalRepository.deleteTerminal(terminalId);

  return {
    map: {
      ...map,
      pathTerminalIds: (map.pathTerminalIds ?? []).filter(
        (id) => id !== terminalId
      ),
      updatedAt: new Date(),
    },
    network: {
      ...network,
      terminals: network.terminals.filter(
        (candidate) => candidate.id !== terminalId
      ),
    },
    deleted: true,
  };
}

export async function promotePathTerminalToFeature(
  map: Map,
  terminalId: string,
  featureId: string,
  network: PathNetwork
): Promise<{
  map: Map;
  network: PathNetwork;
}> {
  const terminal =
    network.terminals.find(
      (candidate) =>
        candidate.id === terminalId
    );

  if (!terminal) {
    return {
      map,
      network,
    };
  }

  const replaceReference = (
    reference: PathSegment['start']
  ): PathSegment['start'] => {
    if (
      reference.kind !== 'standalone' ||
      reference.terminalId !== terminalId
    ) {
      return reference;
    }

    return {
      kind: 'feature',
      featureId,
    };
  };

  const updatedSegments =
    network.segments.map(
      (segment) => {
        const start =
          replaceReference(
            segment.start
          );

        const end =
          replaceReference(
            segment.end
          );

        if (
          start === segment.start &&
          end === segment.end
        ) {
          return segment;
        }

        return {
          ...segment,
          start,
          end,
          updatedAt: new Date(),
        };
      }
    );

  await Promise.all(
    updatedSegments
      .filter((segment) => {
        const original =
          network.segments.find(
            (candidate) =>
              candidate.id ===
              segment.id
          );

        return (
          original &&
          (
            original.start !==
              segment.start ||
            original.end !==
              segment.end
          )
        );
      })
      .map((segment) =>
        pathSegmentRepository.saveSegment(
          segment
        )
      )
  );

  await pathTerminalRepository.deleteTerminal(
    terminalId
  );

  return {
    map: {
      ...map,

      pathTerminalIds:
        (
          map.pathTerminalIds ?? []
        ).filter(
          (id) =>
            id !== terminalId
        ),

      updatedAt: new Date(),
    },

    network: {
      terminals:
        network.terminals.filter(
          (candidate) =>
            candidate.id !== terminalId
        ),

      segments:
        updatedSegments,
    },
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