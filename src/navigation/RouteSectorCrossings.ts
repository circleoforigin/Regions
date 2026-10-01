import type { Feature } from '../models/Feature';
import type { Map as RegionMap } from '../models/Map';
import type { Piece } from '../models/Piece';
import type { RouteLeg } from '../models/Route';
import type { StandalonePathTerminal } from '../models/Path';
import type { ResolvedPathSegment } from '../paths/PathMapState';
import type { PhysicalDistance } from '../interaction/distance/DistanceMeasurement';
import { convertMapDistance } from '../interaction/distance/DistanceMeasurement';
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

export interface RouteSectorCrossing extends SectorCrossing
{
  distance: PhysicalDistance;
}

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
): RouteSectorCrossing[]
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

  const crossings = findSectorCrossings(
  geometry.worldMapId,
  geometry.points,
  sectorSize
);

return crossings.flatMap((crossing) =>
{
  const distance = convertMapDistance(
    crossing.mapDistance,
    distanceScale
  );

  return distance
    ? [{
        ...crossing,
        distance,
      }]
    : [];
  });
}