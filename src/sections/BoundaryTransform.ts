import { isPointInPolygon } from './SectionGeometry';
import type { BoundaryAlignment } from '../models/Map';
import type { Section, SectionEdge, SectionNode, SectionPoint } from '../models/Section';

export function isValidAlignment(value: BoundaryAlignment): boolean {
  return Object.values(value).every(Number.isFinite) &&
    value.zoom > 0 && value.width > 0 && value.height > 0;
}

export function transformBoundaryPoint(point: SectionPoint, value: BoundaryAlignment, inverse = false): SectionPoint {
  if (!isValidAlignment(value)) throw new Error('Boundary scale values must be positive and all values finite.');
  const radians = value.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const sx = value.zoom / 100 * value.width / 100;
  const sy = value.zoom / 100 * value.height / 100;
  if (inverse) {
    const x = point.x - value.x, y = point.y - value.y;
    return { x: (x * cos + y * sin) / sx + value.pivotX,
      y: (-x * sin + y * cos) / sy + value.pivotY };
  }
  const x = (point.x - value.pivotX) * sx;
  const y = (point.y - value.pivotY) * sy;
  return { x: x * cos - y * sin + value.x, y: x * sin + y * cos + value.y };
}

export function deriveAreaBoundary(mapId: string, area: Section, polygon: SectionPoint[], alignment: BoundaryAlignment) {
  if (polygon.length < 3) throw new Error('The linked Area needs a valid outline.');
  const id = `area-boundary-${mapId}`;
  const nodes: SectionNode[] = polygon.map((point, index) => ({
    id: `${id}-node-${index}`, mapId, position: transformBoundaryPoint(point, alignment),
  }));
  const edges: SectionEdge[] = nodes.map((node, index) => ({
    id: `${id}-edge-${index}`, mapId, startNodeId: node.id,
    endNodeId: nodes[(index + 1) % nodes.length].id,
  }));
  const section: Section = { id, mapId, kind: 'boundary', name: `${area.name} Boundary`,
    color: area.color, edgeIds: edges.map((edge) => edge.id), locked: true,
    createdAt: area.createdAt, updatedAt: area.updatedAt };
  return { section, nodes, edges };
}
/** Locate the first crossing in the requested direction and step just beyond it. */
export function findBoundaryCrossing(start: SectionPoint, end: SectionPoint, polygon: SectionPoint[], entering: boolean) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || polygon.length < 3) return;
  const hits: number[] = [];
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) return;
    const ax = a.x - start.x, ay = a.y - start.y;
    const t = (ax * ey - ay * ex) / denominator;
    const u = (ax * dy - ay * dx) / denominator;
    if (t >= 0 && t < 1 && u >= 0 && u <= 1) hits.push(t);
  });
  hits.sort((a, b) => a - b);
  for (const t of hits) {
    const step = Math.min(0.001 / length, (1 - t) / 2);
    const before = { x: start.x + dx * Math.max(0, t - step), y: start.y + dy * Math.max(0, t - step) };
    const after = { x: start.x + dx * (t + step), y: start.y + dy * (t + step) };
    if (isPointInPolygon(before, polygon) !== entering && isPointInPolygon(after, polygon) === entering) {
      return { position: after, fraction: t };
    }
  }
}