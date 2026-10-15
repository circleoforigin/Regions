import type {
  Section,
  SectionEdge,
  SectionNode,
} from '../models/Section';
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

export function validateAreaPolygon(
  section: Section,
  edges: SectionEdge[],
  nodes: SectionNode[]
): string | undefined
{
  if (section.kind !== 'area')
  {
    return undefined;
  }

  const edgeMap = new Map(
    edges.map((edge) => [edge.id, edge])
  );

  const nodeMap = new Map(
    nodes.map((node) => [node.id, node])
  );

  const sectionEdges = section.edgeIds.map((id) =>
    edgeMap.get(id)
  );

  if (
    sectionEdges.length < 3 ||
    sectionEdges.some((edge) => !edge)
  )
  {
    return 'An Area requires at least three valid edges.';
  }

  const adjacency = new Map<string, string[]>();

  for (const edge of sectionEdges)
  {
    if (!edge)
    {
      continue;
    }

    for (const [from, to] of [
      [edge.startNodeId, edge.endNodeId],
      [edge.endNodeId, edge.startNodeId],
    ])
    {
      const neighbors = adjacency.get(from) ?? [];
      neighbors.push(to);
      adjacency.set(from, neighbors);
    }
  }

  if (
    adjacency.size < 3 ||
    [...adjacency.values()].some(
      (neighbors) => neighbors.length !== 2
    )
  )
  {
    return 'An Area must form a closed polygon.';
  }

  const origin = adjacency.keys().next().value;

  if (!origin)
  {
    return 'An Area has no valid origin.';
  }

  const orderedIds: string[] = [];
  let previous: string | undefined;
  let current: string = origin;

  do
  {
    if (orderedIds.includes(current))
    {
      return 'An Area boundary contains an invalid loop.';
    }

    orderedIds.push(current);

    const neighbors = adjacency.get(current);

    if (!neighbors)
    {
      return 'An Area boundary is disconnected.';
    }

    const next: string | undefined =
      neighbors.find((id) => id !== previous);

    if (!next)
    {
      return 'An Area boundary cannot be completed.';
    }

    previous = current;
    current = next;
  }
  while (
    current !== origin &&
    orderedIds.length <= adjacency.size
  );

  if (
    current !== origin ||
    orderedIds.length !== adjacency.size
  )
  {
    return 'An Area boundary must form one closed loop.';
  }

  const polygon = orderedIds.map((id) =>
    nodeMap.get(id)?.position
  );

  if (polygon.some((point) => !point))
  {
    return 'An Area contains a missing node.';
  }

  let twiceArea = 0;

  for (let index = 0; index < polygon.length; index++)
  {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;

    twiceArea += a.x * b.y - b.x * a.y;
  }

  if (Math.abs(twiceArea) <= 0.000001)
  {
    return 'An Area cannot collapse to zero surface area.';
  }

  return undefined;
}

export function validateAreaNodeMove(
  nodeId: string,
  position: SectionNode['position'],
  edges: SectionEdge[],
  nodes: SectionNode[],
  scale: number,
  sections: Section[]
): string | undefined
{
  const movedNodes = nodes.map((node) =>
    node.id === nodeId
      ? { ...node, position }
      : node
  );

  const movingNode = movedNodes.find((node) =>
    node.id === nodeId
  );

  if (!movingNode)
  {
    return 'The moving Area node could not be found.';
  }

  const NODE_COLLISION_RADIUS = 10;

  const overlappingNode = movedNodes.find((node) =>
  {
    if (node.id === nodeId)
    {
      return false;
    }

return Math.hypot(
  node.position.x - position.x,
  node.position.y - position.y
) * scale < NODE_COLLISION_RADIUS;
  });

  if (overlappingNode)
  {
    return 'Two Area nodes cannot occupy the same position.';
  }

  const connectedEdges = edges.filter((edge) =>
    edge.startNodeId === nodeId ||
    edge.endNodeId === nodeId
  );

  for (const edge of connectedEdges)
  {
    const start = movedNodes.find((node) =>
      node.id === edge.startNodeId
    );

    const end = movedNodes.find((node) =>
      node.id === edge.endNodeId
    );

    if (!start || !end)
    {
      return 'An Area edge references a missing node.';
    }

    const error = validateAreaSegment(
      start,
      end,
      edges,
      movedNodes
    );

    if (error)
    {
      return error;
    }
  }

  const affectedAreas = sections.filter((section) =>
  {
    if (section.kind !== 'area')
    {
      return false;
    }

    return section.edgeIds.some((edgeId) =>
    {
      const edge = edges.find((item) =>
        item.id === edgeId
      );

      return (
        edge?.startNodeId === nodeId ||
        edge?.endNodeId === nodeId
      );
    });
  });

  for (const area of affectedAreas)
  {
    const error = validateAreaPolygon(
      area,
      edges,
      movedNodes
    );

    if (error)
    {
      return error;
    }
  }

  return undefined;
}