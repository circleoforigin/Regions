import type {
  DistanceAnchor,
  DistanceScale,
  PhysicalDistance,
} from '../interaction/distance/DistanceMeasurement';
import type { RouteNode } from '../models/Route';
import type { Feature } from '../models/Feature';
import type { Piece } from '../models/Piece';
import type { RouteLeg } from '../models/Route';
import type { StandalonePathTerminal } from '../models/Path';
import type { ResolvedPathSegment } from '../paths/PathMapState';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import type { DistanceSegment } from '../interaction/distance/DistanceMeasurement';
import { resolveDistanceAnchors } from '../interaction/distance/resolveDistanceAnchors';
import { getDistanceSegmentsWithPaths } from '../interaction/distance/DistancePathRouting';
import { convertMapDistance } from '../interaction/distance/DistanceMeasurement';

export function routeNodeToDistanceAnchor(
  node: RouteNode
): DistanceAnchor 
{
  switch (node.kind) {
    case 'point':
      return {
        id: node.id,
        kind: 'temporary',
        pointId: node.id,
        position: node.position,
        usePathFromPrevious: node.usePathFromPrevious,
      };

    case 'feature':
      return {
        id: node.id,
        kind: 'feature',
        featureId: node.featureId,
        usePathFromPrevious: node.usePathFromPrevious,
      };

    case 'path':
      return {
        id: node.id,
        kind: 'path',
        segmentId: node.segmentId,
        position: node.position,
        usePathFromPrevious: node.usePathFromPrevious,
      };

    case 'terminal':
      return {
        id: node.id,
        kind: 'terminal',
        terminalId: node.terminalId,
        usePathFromPrevious: node.usePathFromPrevious,
      };
  }
}

export function routeNodesToDistanceAnchors(
  nodes: RouteNode[]
): DistanceAnchor[] 
{ 
    return nodes.map(routeNodeToDistanceAnchor); 
}

export function getRouteLegDistanceSegments(
  leg: RouteLeg,
  features: Feature[],
  pieces: Piece[],
  terminals: StandalonePathTerminal[],
  pathSegments: ResolvedPathSegment[],
  sections: Section[] = [],
  sectionEdges: SectionEdge[] = [],
  sectionNodes: SectionNode[] = []
): DistanceSegment[] {
  if (leg.start.mapId !== leg.end.mapId)
  {
    return [];
  }

  const anchors = routeNodesToDistanceAnchors([
      leg.start,
      leg.end,
    ]);

  const resolvedAnchors = resolveDistanceAnchors(
      anchors,
      features,
      pieces,
      terminals
    );

  if (resolvedAnchors.length !== 2) 
  {
    return [];
  }

  return getDistanceSegmentsWithPaths(
    resolvedAnchors,
    pathSegments,
    sections,
    sectionEdges,
    sectionNodes
  );
}

export function getRouteLegPhysicalDistance(
  leg: RouteLeg,
  scale: DistanceScale | undefined,
  features: Feature[],
  pieces: Piece[],
  terminals: StandalonePathTerminal[],
  pathSegments: ResolvedPathSegment[],
  sections: Section[] = [],
  sectionEdges: SectionEdge[] = [],
  sectionNodes: SectionNode[] = []
): PhysicalDistance | null
{
  const segments = getRouteLegDistanceSegments(
    leg,
    features,
    pieces,
    terminals,
    pathSegments,
    sections,
    sectionEdges,
    sectionNodes
  );

  if (segments.length === 0)
  {
    return null;
  }

  const mapDistance = segments.reduce(
    (total, segment) => total + segment.mapDistance,
    0
  );

  return convertMapDistance(
    mapDistance,
    scale
  );
}