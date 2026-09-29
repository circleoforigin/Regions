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

import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../../models/Section';

import {
  findNavigationAreaPolylineCrossings,
} from '../../navigation/NavigationBoundary';

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

  if (anchor.anchor.kind === 'terminal') {
  return {
    kind: 'terminal',
    reference: {
      kind: 'standalone',
      terminalId:
        anchor.anchor.terminalId,
    },
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
  pathSegments: ResolvedPathSegment[],
  sections: Section[] = [],
  sectionEdges: SectionEdge[] = [],
  sectionNodes: SectionNode[] = []
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
  const crossings =
    findNavigationAreaPolylineCrossings(
      route.points,
      sections,
      sectionEdges,
      sectionNodes
    );

    const routeLegSegmentIds =
  route.legs.flatMap(
    (leg) =>
      Array.from(
        {
          length:
            Math.max(
              leg.points.length - 1,
              0
            ),
        },
        () => leg.segmentId
      )
  );

  if (crossings.length === 0) {
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

  const splitPoints = [
    {
      position: start.position,
      segmentIndex: 0,
      pathSegmentId: undefined as string | undefined,
    },

  ...crossings.map(
    (crossing) => ({
        position: crossing.position,
        segmentIndex: crossing.segmentIndex,
        pathSegmentId: routeLegSegmentIds[ crossing.segmentIndex ],
    })
  ),

    {
      position: end.position,
      segmentIndex: Math.max(route.points.length - 2, 0),
      pathSegmentId: undefined as string | undefined,
    },
  ];

  for (
    let splitIndex = 1;
    splitIndex <
      splitPoints.length;
    splitIndex += 1
  ) {
    const splitStart =
      splitPoints[
        splitIndex - 1
      ];

    const splitEnd =
      splitPoints[
        splitIndex
      ];

    const points = [
      splitStart.position,

      ...route.points.slice(
        splitStart.segmentIndex + 1,
        splitEnd.segmentIndex + 1
      ),

      splitEnd.position,
    ];

    const mapDistance =
      points
        .slice(1)
        .reduce(
          (
            total,
            point,
            pointIndex
          ) => {
            const previous =
              points[pointIndex];

            return (
              total +
              Math.hypot(
                point.x -
                  previous.x,
                point.y -
                  previous.y
              )
            );
          },
          0
        );

        if (mapDistance <= 0.000001) {
            continue;
        }

    const startAnchor:
  ResolvedDistanceAnchor =
    splitIndex === 1
      ? start
      : splitStart.pathSegmentId
        ? {
            anchor: {
              id:
                `area-breakpoint-${index}-${splitIndex - 1}`,
              kind: 'path',
              segmentId:
                splitStart.pathSegmentId,
              position:
                splitStart.position,
              usePathFromPrevious:
                true,
            },
            position:
              splitStart.position,
          }
        : {
            anchor: {
              id:
                `area-breakpoint-${index}-${splitIndex - 1}`,
              kind:
                'temporary',
              pointId:
                `area-breakpoint-${index}-${splitIndex - 1}`,
              position:
                splitStart.position,
            },
            position:
              splitStart.position,
          };

    const endAnchor:
  ResolvedDistanceAnchor =
    splitIndex ===
    splitPoints.length - 1
      ? end
      : splitEnd.pathSegmentId
        ? {
            anchor: {
              id:
                `area-breakpoint-${index}-${splitIndex}`,
              kind: 'path',
              segmentId:
                splitEnd.pathSegmentId,
              position:
                splitEnd.position,
              usePathFromPrevious:
                true,
            },
            position:
              splitEnd.position,
          }
        : {
            anchor: {
              id:
                `area-breakpoint-${index}-${splitIndex}`,
              kind:
                'temporary',
              pointId:
                `area-breakpoint-${index}-${splitIndex}`,
              position:
                splitEnd.position,
            },
            position:
              splitEnd.position,
          };

    result.push({
      start: startAnchor,
      end: endAnchor,
      mapDistance,
      kind: 'path',
      points,
    });
  }

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