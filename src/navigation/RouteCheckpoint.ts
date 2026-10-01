import type { RouteNode } from '../models/Route';
import type { SectorAddress } from '../spatial/Sector';
import type { WorldPosition } from '../spatial/WorldPosition';

export type RouteCheckpointKind =
  | 'sector'
  | 'route-node';

export interface RouteCheckpointBase
{
  kind: RouteCheckpointKind;
  worldPosition: WorldPosition;
}

export interface SectorRouteCheckpoint
  extends RouteCheckpointBase
{
  kind: 'sector';
  from: SectorAddress;
  to: SectorAddress;
}

export interface RouteNodeCheckpoint
  extends RouteCheckpointBase
{
  kind: 'route-node';
  node: RouteNode;
}

export type RouteCheckpoint =
  | SectorRouteCheckpoint
  | RouteNodeCheckpoint;

export function isRouteDecisionPoint(
  checkpoint: RouteCheckpoint
): boolean
{
  return checkpoint.kind === 'route-node';
}