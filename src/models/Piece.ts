import type {
  SpatialAnchor,
  SpatialPoint,
} from '../spatial/SpatialAnchor';
export type PieceKind = 'piece' | 'group';

export type PieceShape =
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'hexagon';

export interface PieceAppearance {
  shape: PieceShape;
  fillColor: string;
  borderColor: string;
}

export interface Piece extends SpatialAnchor {
  id: string;
  kind: PieceKind;
  name: string;
  mapId: string;
  position: SpatialPoint;
  appearance: PieceAppearance;
  tracked?: boolean;
  memberPieceIds?: string[];
}

export function isPieceTracked(piece: Piece): boolean {
  return piece.tracked !== false;
}

export function getPartyMembers(party: Piece, pieces: Piece[]): Piece[] {
  if (party.kind !== 'group') return [];
  const memberIds = new Set(party.memberPieceIds ?? []);
  return pieces.filter((piece) => piece.kind !== 'group' && memberIds.has(piece.id));
}

export function findContainingParty(pieceId: string, pieces: Piece[]): Piece | undefined {
  return pieces.find((piece) =>
    piece.kind === 'group' && piece.memberPieceIds?.includes(pieceId)
  );
}

export function isPieceGrouped(pieceId: string, pieces: Piece[]): boolean {
  return Boolean(findContainingParty(pieceId, pieces));
}

export function resolveSpatialPiece(pieceId: string, pieces: Piece[]): Piece | undefined {
  const piece = pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) return undefined;
  return piece.kind !== 'group' ? findContainingParty(piece.id, pieces) ?? piece : piece;
}

export function getPartyMemberIds(piece: Piece): string[] {
  return piece.kind === 'group' ? [...new Set(piece.memberPieceIds ?? [])] : [piece.id];
}

export function movePartyAndMembers(
  pieces: Piece[],
  spatialPieceId: string,
  mapId: string,
  position: Piece['position']
): Piece[] {
  const spatialPiece = pieces.find((piece) => piece.id === spatialPieceId);
  const memberIds = new Set(spatialPiece ? getPartyMemberIds(spatialPiece) : []);
  return pieces.map((piece) => {
    if (piece.id === spatialPieceId) return { ...piece, mapId, position };
    return memberIds.has(piece.id) ? { ...piece, mapId } : piece;
  });
}
