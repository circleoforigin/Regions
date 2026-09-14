import type { Section, SectionEdge, SectionNode, SectionPoint } from '../models/Section';
import { getSectionPolygon, isPointInPolygon } from './SectionGeometry';

/** Resolve only Areas on this Map; visibility is a display preference. */
export function resolveArea(
  mapId: string,
  position: SectionPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[],
  previousAreaId?: string
): Section | undefined {
  const containing = sections.filter((section) => {
    if (section.mapId !== mapId || section.kind !== 'area') return false;
    const polygon = getSectionPolygon(section, edges, nodes);
    return polygon.length === section.edgeIds.length &&
      polygon.length >= 3 && isPointInPolygon(position, polygon);
  });
  // Retain the previous Area on a shared edge, avoiding spurious transitions.
  return containing.find((section) => section.id === previousAreaId) ?? containing[0];
}