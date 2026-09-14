import type { SectionEdge, SectionNode } from '../models/Section';
import { pointToSegmentDistance } from './SectionGeometry';

const EPS = 0.000001;
export function validateAreaSegment(
  start: SectionNode, end: SectionNode, edges: SectionEdge[], nodes: SectionNode[]
): string | undefined {
  if (Math.hypot(start.position.x - end.position.x, start.position.y - end.position.y) <= EPS) {
    return 'An edge must connect two different nodes.';
  }
  if (nodes.some((node) => node.id !== start.id && node.id !== end.id &&
    pointToSegmentDistance(node.position, start.position, end.position) <= EPS)) {
    return 'Connect to the existing node instead of drawing through it.';
  }
  for (const edge of edges) {
    const a = nodes.find((node) => node.id === edge.startNodeId);
    const b = nodes.find((node) => node.id === edge.endNodeId);
    if (!a || !b) continue;
    // Following a whole existing edge reuses it; it does not create an overlap.
    if ((a.id === start.id && b.id === end.id) ||
        (b.id === start.id && a.id === end.id)) continue;
    const cross = (p: SectionNode, q: SectionNode, r: SectionNode) =>
      (q.position.x - p.position.x) * (r.position.y - p.position.y) -
      (q.position.y - p.position.y) * (r.position.x - p.position.x);
    const ab1 = cross(start, end, a), ab2 = cross(start, end, b);
    const cd1 = cross(a, b, start), cd2 = cross(a, b, end);
    if (((ab1 > EPS && ab2 < -EPS) || (ab1 < -EPS && ab2 > EPS)) &&
        ((cd1 > EPS && cd2 < -EPS) || (cd1 < -EPS && cd2 > EPS))) {
      return 'An Area edge cannot cross another edge.';
    }
    for (const [node, otherStart, otherEnd] of [[start, a, b], [end, a, b], [a, start, end], [b, start, end]]) {
      if (node.id !== otherStart.id && node.id !== otherEnd.id &&
          pointToSegmentDistance(node.position, otherStart.position, otherEnd.position) <= EPS) {
        return 'An Area edge cannot overlap another edge. Connect at an existing node.';
      }
    }
  }
}

/** Find a return route without reusing the draft's edges or interior nodes. */
export function findAreaReturnPath(
  draftNodes: SectionNode[], draftEdges: SectionEdge[], existingEdges: SectionEdge[]
): SectionEdge[] | undefined {
  const origin = draftNodes[0]?.id, last = draftNodes.at(-1)?.id;
  if (!origin || !last || origin === last) return;
  const blockedNodes = new Set(draftNodes.slice(1, -1).map((node) => node.id));
  const blockedEdges = new Set(draftEdges.map((edge) => edge.id));
  const queue: { node: string; path: SectionEdge[] }[] = [{ node: last, path: [] }];
  const visited = new Set([last]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of existingEdges) {
      if (blockedEdges.has(edge.id)) continue;
      const next = edge.startNodeId === current.node ? edge.endNodeId
        : edge.endNodeId === current.node ? edge.startNodeId : undefined;
      if (!next || blockedNodes.has(next)) continue;
      const path = [...current.path, edge];
      if (next === origin && path.length + draftEdges.length >= 3) return path;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push({ node: next, path });
      }
    }
  }
}