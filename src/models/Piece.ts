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

export interface Piece {
  id: string;
  kind: PieceKind;
  name: string;
  mapId: string;
  position: {
    x: number;
    y: number;
  };
  appearance: PieceAppearance;
  tracked?: boolean;
  memberPieceIds?: string[];
}

export function isPieceTracked(piece: Piece): boolean {
  return piece.tracked !== false;
}
