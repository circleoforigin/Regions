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
  color: string;
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
