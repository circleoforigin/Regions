import type { Feature } from '../models/Feature';
import type { Map as RegionMap } from '../models/Map';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import type { RouteLeg, RouteNode } from '../models/Route';
import type { StandalonePathTerminal } from '../models/Path';
import type { SpatialPoint } from '../spatial/SpatialAnchor';
import type { SpatialContext } from '../spatial/SpatialContext';
import type { SectorResolution } from '../spatial/Sector';
import { resolveSpatialContext } from '../spatial/SpatialContextResolver';

export interface RouteLegSpatialContext
{
  start: SpatialContext;
  end: SpatialContext;
}

function resolveRouteNodePosition(
  node: RouteNode,
  features: Feature[],
  terminals: StandalonePathTerminal[]
): SpatialPoint | null
{
  switch (node.kind)
  {
    case 'point':
    case 'path':
      return node.position;

    case 'feature':
      return features.find(
        (feature) => feature.id === node.featureId
      )?.position ?? null;

    case 'terminal':
      return terminals.find(
        (terminal) => terminal.id === node.terminalId
      )?.position ?? null;
  }
}

export function getRouteLegSpatialContext(
  leg: RouteLeg,
  maps: RegionMap[],
  features: Feature[],
  terminals: StandalonePathTerminal[],
  sections: Section[],
  sectionEdges: SectionEdge[],
  sectionNodes: SectionNode[],
  sectorResolution: SectorResolution
): RouteLegSpatialContext | null
{
  const startPosition = resolveRouteNodePosition(
    leg.start,
    features,
    terminals
  );

  const endPosition = resolveRouteNodePosition(
    leg.end,
    features,
    terminals
  );

  if (!startPosition || !endPosition)
  {
    return null;
  }

  const start = resolveSpatialContext(
    leg.start.mapId,
    startPosition,
    maps,
    features,
    sections,
    sectionEdges,
    sectionNodes,
    sectorResolution
  );

  const end = resolveSpatialContext(
    leg.end.mapId,
    endPosition,
    maps,
    features,
    sections,
    sectionEdges,
    sectionNodes,
    sectorResolution,
    start?.areaId
  );

  if (!start || !end)
  {
    return null;
  }

  return {
    start,
    end,
  };
}