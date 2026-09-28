import type {
  Section,
  SectionEdge,
  SectionNode,
  SectionPoint,
} from '../models/Section';

import {
  findFirstPolygonBoundaryIntersection,
  getSectionPolygon,
} from '../sections/SectionGeometry';

export interface NavigationBoundaryCrossing {
  area: Section;
  position: SectionPoint;
  fraction: number;
}

export function findFirstNavigationBoundaryCrossing(
  start: SectionPoint,
  end: SectionPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): NavigationBoundaryCrossing | null {
  let first:
    NavigationBoundaryCrossing |
    null = null;

  for (const section of sections) {
    if (
      section.kind !== 'area' ||
      !section.targetMapId
    ) {
      continue;
    }

    const polygon =
      getSectionPolygon(
        section,
        edges,
        nodes
      );

    const startInside =
      isPointInsideNavigationArea(
        start,
        polygon
      );    

    /*
     * For now this detector represents
     * ENTERING a connected Area from the
     * current map.
     *
     * If the movement starts inside the
     * Area, this is not an entry crossing.
     */
    if (startInside) {
      continue;
    }

    /*
     * A segment can enter and leave an
     * Area even when its endpoint is
     * outside, so we still test the
     * boundary when endInside is false.
     */
    const crossing =
      findFirstPolygonBoundaryIntersection(
        start,
        end,
        polygon
      );

    if (!crossing) {
      continue;
    }

    if (
      first &&
      crossing.fraction >=
        first.fraction
    ) {
      continue;
    }

    first = {
      area: section,
      position:
        crossing.position,
      fraction:
        crossing.fraction,
    };
  }

  return first;
}

function isPointInsideNavigationArea(
  point: SectionPoint,
  polygon: SectionPoint[]
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (
    let index = 0,
      previous =
        polygon.length - 1;
    index < polygon.length;
    previous = index,
      index += 1
  ) {
    const current =
      polygon[index];

    const prior =
      polygon[previous];

    const crosses =
      current.y > point.y !==
        prior.y > point.y &&
      point.x <
        (
          (prior.x - current.x) *
            (point.y - current.y)
        ) /
          (prior.y - current.y) +
          current.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}