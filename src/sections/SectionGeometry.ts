import type { SectionPoint } from '../models/Section';

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
