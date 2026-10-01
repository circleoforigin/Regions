import type { Feature } from '../models/Feature';
import type { Map as RegionMap } from '../models/Map';
import type { Piece } from '../models/Piece';
import type { RouteLeg } from '../models/Route';
import type { StandalonePathTerminal } from '../models/Path';
import type { ResolvedPathSegment } from '../paths/PathMapState';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import type { SpatialPoint } from '../spatial/SpatialAnchor';
import { resolveWorldPosition } from '../spatial/WorldPositionResolver';
import { getRouteLegDistanceSegments } from './RouteDistance';

export interface RouteWorldGeometry
{
  worldMapId: string;
  points: SpatialPoint[];
}

export function getRouteLegWorldGeometry(
  leg: RouteLeg,
  maps: RegionMap[],
  features: Feature[],
  pieces: Piece[],
  terminals: StandalonePathTerminal[],
  pathSegments: ResolvedPathSegment[],
  sections: Section[] = [],
  sectionEdges: SectionEdge[] = [],
  sectionNodes: SectionNode[] = []
): RouteWorldGeometry | null
{
  if (leg.start.mapId !== leg.end.mapId)
  {
    return null;
  }

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

  const mapPoints = segments.flatMap(
    (segment, segmentIndex) =>
      segmentIndex === 0
        ? segment.points
        : segment.points.slice(1)
  );

  const worldPoints = mapPoints.map((point) =>
    resolveWorldPosition(
      leg.start.mapId,
      point,
      maps,
      features
    )
  );

  if (worldPoints.some((point) => point === null))
  {
    return null;
  }

  const resolved = worldPoints.filter(
    (point): point is NonNullable<typeof point> =>
      point !== null
  );

  const worldMapId = resolved[0]?.mapId;

  if (
    !worldMapId ||
    resolved.some(
      (point) => point.mapId !== worldMapId
    )
  ) {
    return null;
  }

  return {
    worldMapId,
    points: resolved.map((point) => ({
      x: point.x,
      y: point.y,
    })),
  };
}