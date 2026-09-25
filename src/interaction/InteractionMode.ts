import type { SectionKind } from '../models/Section';

export type InteractionMode =
  | 'explore'
  | 'path'
  | 'distance'
  | 'build'
  | 'area'
  | 'zone'
  | 'territory'
  | 'boundary';

export interface InteractionModeDefinition {
  id: InteractionMode;
  label: string;
}

export const INTERACTION_MODES: InteractionModeDefinition[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'path', label: 'Path' },
  { id: 'distance', label: 'Distance' },
  { id: 'build', label: 'Build' },
  { id: 'area', label: 'Area' },
  { id: 'zone', label: 'Zone' },
  { id: 'territory', label: 'Territory' },
  { id: 'boundary', label: 'Boundary' },
];

export function interactionModeToSectionKind(
  mode: InteractionMode
): SectionKind | null {
  switch (mode) {
    case 'area':
      return 'area';

    case 'zone':
      return 'zone';

    case 'territory':
      return 'border';

    case 'boundary':
      return 'boundary';

    default:
      return null;
  }
}