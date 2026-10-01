import type { SpatialPoint } from './SpatialAnchor';

export interface WorldPosition extends SpatialPoint
{
    mapId: string;
}