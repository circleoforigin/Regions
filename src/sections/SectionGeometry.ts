import type {
  Section,
  SectionEdge,
  SectionNode,
  SectionPoint,
} from '../models/Section';

export function closestPointOnSegment(
  point: SectionPoint,
  start: SectionPoint,
  end: SectionPoint
): SectionPoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;
  const ratio = ((point.x - start.x) * dx +
    (point.y - start.y) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, ratio));
  return { x: start.x + dx * clamped, y: start.y + dy * clamped };
}

export function pointToSegmentDistance(
  point: SectionPoint,
  start: SectionPoint,
  end: SectionPoint
): number {
  const closest = closestPointOnSegment(point, start, end);
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

export interface SectionBoundaryIntersection {
  position: SectionPoint;
  edgeIndex: number;
  fraction: number;
}

export function findPolygonBoundaryIntersections(
  start: SectionPoint,
  end: SectionPoint,
  polygon: SectionPoint[]
): SectionBoundaryIntersection[] {
  if (polygon.length < 3) {
    return [];
  }

  const routeDx =
    end.x - start.x;

  const routeDy =
    end.y - start.y;

  const intersections:
    SectionBoundaryIntersection[] = [];

  polygon.forEach(
    (edgeStart, edgeIndex) => {
      const edgeEnd =
        polygon[
          (edgeIndex + 1) %
            polygon.length
        ];

      const edgeDx =
        edgeEnd.x - edgeStart.x;

      const edgeDy =
        edgeEnd.y - edgeStart.y;

      const denominator =
        routeDx * edgeDy -
        routeDy * edgeDx;

      if (
        Math.abs(denominator) <
        0.000001
      ) {
        return;
      }

      const offsetX =
        edgeStart.x - start.x;

      const offsetY =
        edgeStart.y - start.y;

      const routeFraction =
        (
          offsetX * edgeDy -
          offsetY * edgeDx
        ) / denominator;

      const edgeFraction =
        (
          offsetX * routeDy -
          offsetY * routeDx
        ) / denominator;

      if (
        routeFraction < 0 ||
        routeFraction > 1 ||
        edgeFraction < 0 ||
        edgeFraction > 1
      ) {
        return;
      }

      intersections.push({
        position: {
          x:
            start.x +
            routeDx *
              routeFraction,
          y:
            start.y +
            routeDy *
              routeFraction,
        },
        edgeIndex,
        fraction:
          routeFraction,
      });
    }
  );

  return intersections.sort(
    (a, b) =>
      a.fraction - b.fraction
  );
}

export function findFirstPolygonBoundaryIntersection(
  start: SectionPoint,
  end: SectionPoint,
  polygon: SectionPoint[]
): SectionBoundaryIntersection | null {
  if (polygon.length < 3) {
    return null;
  }

  const routeDx =
    end.x - start.x;

  const routeDy =
    end.y - start.y;

  let first:
    SectionBoundaryIntersection |
    null = null;

  polygon.forEach(
    (edgeStart, edgeIndex) => {
      const edgeEnd =
        polygon[
          (edgeIndex + 1) %
            polygon.length
        ];

      const edgeDx =
        edgeEnd.x - edgeStart.x;

      const edgeDy =
        edgeEnd.y - edgeStart.y;

      const denominator =
        routeDx * edgeDy -
        routeDy * edgeDx;

      if (
        Math.abs(denominator) <
        0.000001
      ) {
        return;
      }

      const offsetX =
        edgeStart.x - start.x;

      const offsetY =
        edgeStart.y - start.y;

      const routeFraction =
        (
          offsetX * edgeDy -
          offsetY * edgeDx
        ) / denominator;

      const edgeFraction =
        (
          offsetX * routeDy -
          offsetY * routeDx
        ) / denominator;

      if (
        routeFraction < 0 ||
        routeFraction > 1 ||
        edgeFraction < 0 ||
        edgeFraction > 1
      ) {
        return;
      }

      if (
        first &&
        routeFraction >=
          first.fraction
      ) {
        return;
      }

      first = {
        position: {
          x:
            start.x +
            routeDx *
              routeFraction,
          y:
            start.y +
            routeDy *
              routeFraction,
        },
        edgeIndex,
        fraction:
          routeFraction,
      };
    }
  );

  return first;
}

export function getSectionPolygon(
  section: Section,
  edges: SectionEdge[],
  nodes: SectionNode[]
): SectionPoint[] {
  return getSectionNodeIds(section, edges).map((id) =>
    nodes.find((node) => node.id === id)?.position
  ).filter((point): point is SectionPoint => Boolean(point));
}

// Edge order defines the loop; each edge may be traversed in either direction.
export function getSectionNodeIds(section: Section, edges: SectionEdge[]): string[] {
  return section.edgeIds.flatMap((id, index) => {
    const edge = edges.find((item) => item.id === id);
    const previous = edges.find((item) => item.id ===
      section.edgeIds[(index + section.edgeIds.length - 1) % section.edgeIds.length]);
    if (!edge || !previous) return [];
    const shared = [edge.startNodeId, edge.endNodeId].find((nodeId) =>
      previous.startNodeId === nodeId || previous.endNodeId === nodeId);
    return shared ? [shared] : [];
  });
}
export function isPointInPolygon(
  point: SectionPoint,
  polygon: SectionPoint[]
): boolean {
  if (polygon.length < 3) return false;
  const onEdge = polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return pointToSegmentDistance(point, start, end) <= 0.000001;
  });
  if (onEdge) return true;

  let inside = false;
  for (let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x < (previousPoint.x - currentPoint.x) *
        (point.y - currentPoint.y) /
        (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Returns the unsigned surface area of a polygon.
 */
export function getPolygonArea(
  polygon: SectionPoint[]
): number
{
  if (polygon.length < 3)
  {
    return 0;
  }

  let twiceArea = 0;

  for (let index = 0; index < polygon.length; index++)
  {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];

    twiceArea +=
      a.x * b.y -
      b.x * a.y;
  }

  return Math.abs(twiceArea) / 2;
}

/**
 * Determines whether one polygon is completely contained
 * inside another polygon.
 *
 * This assumes Area boundaries do not intersect, as enforced
 * by the Area drawing system.
 */
export function isPolygonContained(
  inner: SectionPoint[],
  outer: SectionPoint[]
): boolean
{
  if (
    inner.length < 3 ||
    outer.length < 3
  )
  {
    return false;
  }

  const innerArea = getPolygonArea(inner);
  const outerArea = getPolygonArea(outer);

  if (
    innerArea <= 0 ||
    innerArea >= outerArea
  )
  {
    return false;
  }

  // Every vertex must lie inside or on the outer polygon.
  if (!inner.every((point) =>
    isPointInPolygon(point, outer)
  ))
  {
    return false;
  }

  // Every inner edge must remain within the outer polygon.
  // Checking only vertices is insufficient for concave shapes.

  for (let index = 0; index < inner.length; index++)
  {
    const start = inner[index];
    const end = inner[(index + 1) % inner.length];

    const intersections = findPolygonBoundaryIntersections(
      start,
      end,
      outer
    );

    const fractions = [
      0,
      ...intersections.map((item) => item.fraction),
      1,
    ]
      .sort((a, b) => a - b)
      .filter((fraction, index, values) =>
        index === 0 ||
        Math.abs(fraction - values[index - 1]) > 0.000001
      );

    for (let segment = 0; segment < fractions.length - 1; segment++)
    {
      const midpointFraction =
        (fractions[segment] + fractions[segment + 1]) / 2;

      const midpoint: SectionPoint = {
        x: start.x +
          (end.x - start.x) * midpointFraction,

        y: start.y +
          (end.y - start.y) * midpointFraction,
      };

      if (!isPointInPolygon(midpoint, outer))
      {
        return false;
      }
    }
  }

  return true;
}

/**
 * Finds the Area that owns a geographic position.
 *
 * When multiple Areas contain the position, the smallest
 * enclosing polygon takes precedence.
 *
 * This allows nested Areas to subtract territory from
 * their enclosing Areas without modifying their geometry.
 */
export function getAreaOwner(
  point: SectionPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): Section | undefined
{
  const containingAreas = sections
    .filter((section) =>
      section.kind === 'area'
    )
    .map((section) =>
    {
      const polygon = getSectionPolygon(
        section,
        edges,
        nodes
      );

      return {
        section,
        polygon,
        area: getPolygonArea(polygon),
      };
    })
    .filter(({ polygon }) =>
      isPointInPolygon(point, polygon)
    );

  if (containingAreas.length === 0)
  {
    return undefined;
  }

  containingAreas.sort(
    (a, b) => a.area - b.area
  );

  return containingAreas[0].section;
}

/**
 * Finds the Territory that governs a geographic position.
 *
 * Territory ownership is not yet implemented.
 *
 * Unlike Areas, Territories will use their own
 * ownership rules, which will be defined separately.
 */
export function getTerritoryOwner(
  point: SectionPoint,
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): Section | undefined
{
  // Reserved for future Territory ownership logic.
  void point;
  void sections;
  void edges;
  void nodes;

  return undefined;
}

export interface AreaContainment
{
  areaId: string;
  parentId?: string;
  childIds: string[];
}

/**
 * Builds geographic containment relationships.
 *
 * Relationships are derived from geometry and are never
 * stored as permanent dependencies between Areas.
 */
export function getAreaContainmentHierarchy(
  sections: Section[],
  edges: SectionEdge[],
  nodes: SectionNode[]
): AreaContainment[]
{
  const areas = sections
    .filter((section) => section.kind === 'area')
    .map((section) =>
    {
      const polygon = getSectionPolygon(
        section,
        edges,
        nodes
      );

      return {
        section,
        polygon,
        size: getPolygonArea(polygon),
      };
    })
    .filter((area) =>
      area.polygon.length >= 3 &&
      area.size > 0
    );

  const hierarchy: AreaContainment[] = areas.map(
    ({ section }) => ({
      areaId: section.id,
      parentId: undefined,
      childIds: [],
    })
  );

  for (const inner of areas)
  {
    const containers = areas
      .filter((outer) =>
        outer.section.id !== inner.section.id &&
        isPolygonContained(
          inner.polygon,
          outer.polygon
        )
      )
      .sort((a, b) => a.size - b.size);

    const parent = containers[0];

    if (!parent)
    {
      continue;
    }

    const entry = hierarchy.find(
      (item) => item.areaId === inner.section.id
    );

    if (entry)
    {
      entry.parentId = parent.section.id;
    }

    const parentEntry = hierarchy.find(
      (item) => item.areaId === parent.section.id
    );

    if (parentEntry)
    {
      parentEntry.childIds.push(inner.section.id);
    }
  }

  return hierarchy;
}

/** Pick an interior point with room around it, including for concave Areas. */
export function getAreaLabelPosition(polygon: SectionPoint[]): SectionPoint | undefined {
  if (polygon.length < 3) return;
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxY = Math.max(...polygon.map((point) => point.y));
  if (maxY <= minY) return;
  let best: SectionPoint | undefined;
  let clearance = -1;
  // Scan between vertices too, so narrow concave regions have candidates.
  const levels = [...new Set(polygon.map((point) => point.y))].sort((a, b) => a - b);
  const scanY = levels.slice(1).map((y, index) => (y + levels[index]) / 2);
  for (let row = 0; row < 33; row += 1) {
    scanY.push(minY + (maxY - minY) * (row + 0.5) / 33);
  }
  for (const y of scanY) {
    const intersections: number[] = [];
    polygon.forEach((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      if ((a.y > y) === (b.y > y)) return;
      intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    });
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const point = { x: (intersections[index] + intersections[index + 1]) / 2, y };
      const distance = Math.min(...polygon.map((a, edgeIndex) =>
        pointToSegmentDistance(point, a, polygon[(edgeIndex + 1) % polygon.length])));
      if (distance > clearance) { best = point; clearance = distance; }
    }
  }
  return best;
}