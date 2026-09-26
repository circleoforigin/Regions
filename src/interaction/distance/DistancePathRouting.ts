import type {
  PathTerminalReference,
} from '../../models/Path';

import type {
  ResolvedPathSegment,
} from '../../paths/PathMapState';

import {
  findPathRoute,
  type PathRouteEndpoint,
} from '../../paths/PathRouting';

import type {
  DistanceSegment,
  ResolvedDistanceAnchor,
} from './DistanceMeasurement';

function featureTerminalReference(
  featureId: string,
  segments: ResolvedPathSegment[]
): PathTerminalReference | null {
  for (const resolved of segments) {
    for (
      const reference of [
        resolved.segment.start,
        resolved.segment.end,
      ]
    ) {
      if (
        reference.kind === 'feature' &&
        reference.featureId === featureId
      ) {
        return reference;
      }
    }
  }

  return null;
}

function getRouteEndpoint(
  anchor: ResolvedDistanceAnchor,
  segments: ResolvedPathSegment[]
): PathRouteEndpoint | null {
  if (anchor.anchor.kind === 'path') {
    return {
      kind: 'segment',
      segmentId:
        anchor.anchor.segmentId,
      position: anchor.position,
    };
  }

  if (anchor.anchor.kind === 'feature') {
    const reference =
      featureTerminalReference(
        anchor.anchor.featureId,
        segments
      );

    return reference
      ? {
          kind: 'terminal',
          reference,
        }
      : null;
  }

  return null;
}

export function getDistanceSegmentsWithPaths(
  anchors: ResolvedDistanceAnchor[],
  pathSegments: ResolvedPathSegment[]
): DistanceSegment[] {
  const result: DistanceSegment[] = [];

  for (
    let index = 1;
    index < anchors.length;
    index += 1
  ) {
    const start = anchors[index - 1];
    const end = anchors[index];

    const usePath = end.anchor.usePathFromPrevious === true;

    if (usePath) {
      const routeStart =
        getRouteEndpoint(
          start,
          pathSegments
        );

      const routeEnd =
        getRouteEndpoint(
          end,
          pathSegments
        );

      if (routeStart && routeEnd) {
        const route =
          findPathRoute(
            routeStart,
            routeEnd,
            pathSegments
          );

        if (route) {
          result.push({
            start,
            end,
            mapDistance:
              route.distance,
            kind: 'path',
            points: route.points,
          });

          continue;
        }
      }
    }

    result.push({
      start,
      end,
      mapDistance: Math.hypot(
        end.position.x -
          start.position.x,
        end.position.y -
          start.position.y
      ),
      kind: 'straight',
      points: [
        start.position,
        end.position,
      ],
    });
  }

  return result;
}