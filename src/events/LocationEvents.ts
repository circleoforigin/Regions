import type {
  EventDefinition,
  EventFieldDefinition,
} from '@settingforge/module-sdk';
import type { Piece } from '../models/Piece';
import { isPieceTracked } from '../models/Piece';

export interface LocationContext {
  contextKind: 'map' | 'area';
  locationId: string;
  locationName: string;
  locationType: string;
}
interface PieceContext extends LocationContext {
  projectId: string;
  pieceId: string;
  tracked: boolean;
  focused: boolean;
}
export interface LocationEnteredPayload extends PieceContext {
  previousContextKind: 'map' | 'area';
  previousLocationId: string;
  previousLocationName: string;
  previousLocationType: string;
}
export interface LocationContextChangedPayload extends PieceContext {
  reason: 'movement' | 'focus';
}
export type LocationEvent =
  | { type: 'Regions.LocationEntered'; payload: LocationEnteredPayload }
  | { type: 'Regions.LocationContextChanged'; payload: LocationContextChangedPayload };

const commonFields: EventFieldDefinition[] = [
  { key: 'projectId', label: 'Project ID', type: 'string' },
  { key: 'pieceId', label: 'Piece ID', type: 'string' },
  { key: 'tracked', label: 'Tracked', type: 'boolean' },
  { key: 'focused', label: 'Focused', type: 'boolean' },
  { key: 'contextKind', label: 'Context Kind', type: 'string' },
  { key: 'locationId', label: 'Location ID', type: 'string' },
  { key: 'locationName', label: 'Location Name', type: 'string' },
  { key: 'locationType', label: 'Location Type', type: 'string' },
];
export const locationEventDefinitions: EventDefinition[] = [
  {
    id: 'Regions.LocationEntered', label: 'Location Entered',
    description: 'A Piece entered a different Map or Area, regardless of tracking or focus.',
    fields: [...commonFields,
      { key: 'previousContextKind', label: 'Previous Context Kind', type: 'string' },
      { key: 'previousLocationId', label: 'Previous Location ID', type: 'string' },
      { key: 'previousLocationName', label: 'Previous Location Name', type: 'string' },
      { key: 'previousLocationType', label: 'Previous Location Type', type: 'string' },
    ],
  },
  {
    id: 'Regions.LocationContextChanged', label: 'Location Context Changed',
    description: 'The host context changed because its focused Piece moved or a different Piece was focused.',
    fields: [...commonFields, { key: 'reason', label: 'Reason', type: 'string' }],
  },
];

export const emitImageEventDefinition:
  EventDefinition = {
    id: 'Regions.EmitImage',
    label: 'Emit Image',
    description:
      'Raised for each resolved image media slot.',
    fields: [
      {
        key: 'slot',
        label: 'Slot',
        type: 'number',
      },
      {
        key: 'filePath',
        label: 'File Path',
        type: 'string',
      },
      {
        key: 'fileName',
        label: 'File Name',
        type: 'string',
      },
      {
        key: 'source',
        label: 'Source',
        type: 'string',
      },
    ],
  };

export function createLocationEvents(
  projectId: string, piece: Piece, focusedPieceId: string | undefined,
  destination: LocationContext, reason: 'movement' | 'focus', previous?: LocationContext
): LocationEvent[] {
  const payload: PieceContext = { projectId, pieceId: piece.id,
    tracked: isPieceTracked(piece), focused: piece.id === focusedPieceId, ...destination };
  if (reason === 'focus') {
    return payload.focused
      ? [{ type: 'Regions.LocationContextChanged', payload: { ...payload, reason } }] : [];
  }
  if (!previous) throw new Error('Piece movement requires its previous location context.');
  if (previous.contextKind === destination.contextKind && previous.locationId === destination.locationId) return [];
  const events: LocationEvent[] = [{ type: 'Regions.LocationEntered', payload: {
    ...payload, previousContextKind: previous.contextKind,
    previousLocationId: previous.locationId, previousLocationName: previous.locationName,
    previousLocationType: previous.locationType,
  } }];
  if (payload.focused) events.push({ type: 'Regions.LocationContextChanged', payload: { ...payload, reason } });
  return events;
}