import type {
  Section,
  SectionEdge,
  SectionNode,
  SectionPoint,
} from '../models/Section';

import {
  findFirstPolygonBoundaryIntersection,
  findPolygonBoundaryIntersections,
  getSectionPolygon,
} from '../sections/SectionGeometry';

export interface NavigationBoundaryCrossing {
  area: Section;
  position: SectionPoint;
  fraction: number;
}

export interface NavigationAreaCrossing {
  area: Section;
  position: SectionPoint;
  fraction: number;
}

export function findNavigationAreaCrossings(
  start: SectionPoint,
  end: SectionPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): NavigationAreaCrossing[] {
  const crossings:
    NavigationAreaCrossing[] = [];

  for (const section of sections) {
    if (
      section.kind !== 'area'
    ) {
      continue;
    }

    const polygon =
      getSectionPolygon(
        section,
        edges,
        nodes
      );

    const intersections =
      findPolygonBoundaryIntersections(
        start,
        end,
        polygon
      );

    for (const intersection of intersections) {
      const duplicate =
        crossings.some(
          (crossing) =>
            crossing.area.id ===
              section.id &&
            Math.abs(
              crossing.fraction -
                intersection.fraction
            ) < 0.000001
        );

      if (duplicate) {
        continue;
      }

      crossings.push({
        area: section,
        position:
          intersection.position,
        fraction:
          intersection.fraction,
      });
    }
  }

  return crossings.sort(
    (a, b) =>
      a.fraction - b.fraction
  );
}

export interface NavigationAreaPolylineCrossing {
  area: Section;
  position: SectionPoint;
  segmentIndex: number;
  fraction: number;
}

export function findNavigationAreaPolylineCrossings(
  points: SectionPoint[],
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): NavigationAreaPolylineCrossing[] {
  const crossings:
    NavigationAreaPolylineCrossing[] = [];

  for (
    let segmentIndex = 0;
    segmentIndex < points.length - 1;
    segmentIndex += 1
  ) {
    const start =
      points[segmentIndex];

    const end =
      points[segmentIndex + 1];

    const segmentCrossings =
      findNavigationAreaCrossings(
        start,
        end,
        sections,
        edges,
        nodes
      );

    for (const crossing of segmentCrossings) {
      const duplicate =
        crossings.some(
          (existing) =>
            existing.area.id ===
              crossing.area.id &&
            Math.hypot(
              existing.position.x -
                crossing.position.x,
              existing.position.y -
                crossing.position.y
            ) < 0.000001
        );

      if (duplicate) {
        continue;
      }

      crossings.push({
        area: crossing.area,
        position:
          crossing.position,
        segmentIndex,
        fraction:
          crossing.fraction,
      });
    }
  }

  return crossings.sort(
    (a, b) =>
      a.segmentIndex -
        b.segmentIndex ||
      a.fraction -
        b.fraction
  );
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