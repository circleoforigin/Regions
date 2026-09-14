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