import type {
  PathSegment,
  PathShapePoint,
  PathTerminalReference,
  StandalonePathTerminal,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import type {
  ResolvedPathSegment,
} from './PathMapState';

import {
  projectPointOntoPath,
} from './PathGeometry';

export function createStandalonePathTerminal(
  mapId: string,
  position: SpatialPoint
): StandalonePathTerminal {
  return {
    id: crypto.randomUUID(),
    mapId,
    position,
  };
}

export function createPathSegment(
  mapId: string,
  start: PathTerminalReference,
  end: PathTerminalReference,
  shapePoints: PathShapePoint[]
): PathSegment {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    mapId,

    start,
    end,

    shapePoints: shapePoints.map(
      (point) => ({
        ...point,
        position: {
          ...point.position,
        },
      })
    ),

    createdAt: now,
    updatedAt: now,
  };
}

export function splitPathSegment(
  resolved: ResolvedPathSegment,
  requestedPosition: SpatialPoint
): {
  terminal: StandalonePathTerminal;
  first: PathSegment;
  second: PathSegment;
} {
  const projection =
    projectPointOntoPath(
      resolved,
      requestedPosition
    );

  const original =
    resolved.segment;

  const terminal =
    createStandalonePathTerminal(
      original.mapId,
      projection.position
    );

  const terminalReference:
    PathTerminalReference = {
      kind: 'standalone',
      terminalId: terminal.id,
    };

  const now = new Date();

  const sharedProperties = {
    mapId: original.mapId,
    name: original.name,
    kindId: original.kindId,
    subtypeId: original.subtypeId,
    qualityId: original.qualityId,
    layerId: original.layerId,
  };

  const first: PathSegment = {
    ...sharedProperties,

    id: crypto.randomUUID(),

    start: original.start,
    end: terminalReference,

    shapePoints:
      original.shapePoints
        .slice(
          0,
          projection.legIndex
        )
        .map((point) => ({
          ...point,
          position: {
            ...point.position,
          },
        })),

    createdAt: now,
    updatedAt: now,
  };

  const second: PathSegment = {
    ...sharedProperties,

    id: crypto.randomUUID(),

    start: terminalReference,
    end: original.end,

    shapePoints:
      original.shapePoints
        .slice(
          projection.legIndex
        )
        .map((point) => ({
          ...point,
          position: {
            ...point.position,
          },
        })),

    createdAt: now,
    updatedAt: now,
  };

  return {
    terminal,
    first,
    second,
  };
}