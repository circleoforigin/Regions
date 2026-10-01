import type { Feature } from '../models/Feature';
import type { Map as RegionMap } from '../models/Map';
import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import type { SpatialPoint } from './SpatialAnchor';
import type { SpatialContext } from './SpatialContext';
import type { SectorResolution } from './Sector';
import { getSectorAddress } from './Sector';
import { resolveSectionSpatialContext } from './SectionSpatialContext';
import { resolveWorldPositionFrames } from './WorldPositionResolver';

export function resolveSpatialContext(
  mapId: string,
  position: SpatialPoint,
  maps: RegionMap[],
  features: Feature[],
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[],
  sectorResolution: SectorResolution,
  previousAreaId?: string
): SpatialContext | null
{
  const frames = resolveWorldPositionFrames(
    mapId,
    position,
    maps,
    features
  );

  if (!frames || frames.length === 0)
  {
    return null;
  }

  let areaId: string | undefined;
  const zoneIds: string[] = [];

  for (const frame of [...frames].reverse())
  {
    const sectionContext =
      resolveSectionSpatialContext(
        frame.mapId,
        frame.position,
        sections,
        edges,
        nodes,
        previousAreaId
      );

    if (sectionContext.areaId)
    {
      areaId = sectionContext.areaId;
    }

    for (const zoneId of sectionContext.zoneIds)
    {
      if (!zoneIds.includes(zoneId))
      {
        zoneIds.push(zoneId);
      }
    }
  }

  const worldFrame =
    frames[frames.length - 1];

  const worldMap = maps.find(
    (map) => map.id === worldFrame.mapId
  );

  const distanceScale =
    worldMap?.imageRegistration?.distanceScale;

  if (!worldMap || !distanceScale)
  {
    return null;
  }

  const worldPosition = {
    mapId: worldFrame.mapId,
    x: worldFrame.position.x,
    y: worldFrame.position.y,
  };

  const sector = getSectorAddress(
    worldPosition,
    distanceScale,
    sectorResolution
  );

  if (!sector)
  {
    return null;
  }

  return {
    worldPosition,
    sector,
    ...(areaId ? { areaId } : {}),
    zoneIds,
  };
}