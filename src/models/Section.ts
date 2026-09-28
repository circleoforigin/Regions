import type { Feature } from './Feature';
import type { MediaSlotOverride } from './MediaSlot';
import type {
  RulesetExtensionData,
} from './RulesetExtensionData';
export type SectionKind = 'area' | 'zone' | 'border' | 'boundary';

export interface SectionPoint {
  x: number;
  y: number;
}

export interface SectionNode {
  id: string;
  mapId: string;
  position: SectionPoint;
}

export interface SectionEdge {
  id: string;
  mapId: string;
  startNodeId: string;
  endNodeId: string;
}

export interface Section {
  id: string;
  mapId: string;
  kind: SectionKind;
  name: string;
  subtitle?: string;
  description?: Feature['description'];
  color: string;
  showName?: boolean;
  controlPosition?: SectionPoint;
  targetMapId?: string;
  featureTypeId?: string;
  journalPageId?: string;
  mediaSlotOverrides?: MediaSlotOverride[];
  /*
  * Optional data defined by the active
  * Ruleset. Regions persists this data
  * but does not interpret its meaning.
  */
  rulesetData?: RulesetExtensionData;
  locked?: boolean;
  edgeIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const SECTION_DEFAULTS: Record<
  SectionKind,
  { name: string; color: string }
> = {
  area: { name: 'Area', color: '#5f9f72' },
  zone: { name: 'Zone', color: '#8570b8' },
  border: { name: 'Border', color: '#c18a48' },
  boundary: { name: 'Boundary', color: '#b85d5d' },
};
