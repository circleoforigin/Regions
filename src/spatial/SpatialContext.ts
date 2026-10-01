import type { SectorAddress } from './Sector';
import type { WorldPosition } from './WorldPosition';

export interface SpatialContext
{
  worldPosition: WorldPosition;
  sector: SectorAddress;
  areaId?: string;
  zoneIds: string[];
}