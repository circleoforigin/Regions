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

export function getSectionPolygon(
  section: Section,
  edges: SectionEdge[],
  nodes: SectionNode[]
): SectionPoint[] {
  return section.edgeIds.map((edgeId) => {
    const edge = edges.find((item) => item.id === edgeId);
    return nodes.find((node) => node.id === edge?.startNodeId)?.position;
  }).filter((point): point is SectionPoint => Boolean(point));
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
