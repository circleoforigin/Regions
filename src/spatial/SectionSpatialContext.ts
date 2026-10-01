import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
import type { SpatialPoint } from './SpatialAnchor';
import { resolveArea } from '../sections/AreaContext';
import {
  getSectionPolygon,
  isPointInPolygon,
} from '../sections/SectionGeometry';

export interface SectionSpatialContext
{
  areaId?: string;
  zoneIds: string[];
}

export function resolveSectionSpatialContext(
  mapId: string,
  position: SpatialPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[],
  previousAreaId?: string
): SectionSpatialContext
{
  const area = resolveArea(
    mapId,
    position,
    sections,
    edges,
    nodes,
    previousAreaId
  );

  const zones = sections.filter((section) =>
  {
    if (
      section.mapId !== mapId ||
      section.kind !== 'zone'
    ) {
      return false;
    }

    const polygon = getSectionPolygon(
      section,
      edges,
      nodes
    );

    return (
      polygon.length === section.edgeIds.length &&
      polygon.length >= 3 &&
      isPointInPolygon(position, polygon)
    );
  });

  return {
    areaId: area?.id,
    zoneIds: zones.map((zone) => zone.id),
  };
}