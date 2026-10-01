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
import type {
  SectorCrossing,
} from '../spatial/SectorCrossings';
import type { SectorResolution } from '../spatial/Sector';
import { getSectorSizeInMapUnits } from '../spatial/Sector';
import { findSectorCrossings } from '../spatial/SectorCrossings';
import { getRouteLegWorldGeometry } from './RouteWorldGeometry';

export function getRouteLegSectorCrossings(
  leg: RouteLeg,
  maps: RegionMap[],
  features: Feature[],
  pieces: Piece[],
  terminals: StandalonePathTerminal[],
  pathSegments: ResolvedPathSegment[],
  sectorResolution: SectorResolution,
  sections: Section[] = [],
  sectionEdges: SectionEdge[] = [],
  sectionNodes: SectionNode[] = []
): SectorCrossing[]
{
  const geometry = getRouteLegWorldGeometry(
    leg,
    maps,
    features,
    pieces,
    terminals,
    pathSegments,
    sections,
    sectionEdges,
    sectionNodes
  );

  if (!geometry)
  {
    return [];
  }

  const worldMap = maps.find(
    (map) => map.id === geometry.worldMapId
  );

  const distanceScale =
    worldMap?.imageRegistration?.distanceScale;

  if (!distanceScale)
  {
    return [];
  }

  const sectorSize = getSectorSizeInMapUnits(
    distanceScale,
    sectorResolution
  );

  if (!sectorSize)
  {
    return [];
  }

  return findSectorCrossings(
    geometry.worldMapId,
    geometry.points,
    sectorSize
  );
}