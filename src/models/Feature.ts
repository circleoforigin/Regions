export interface FeaturePosition {
  x: number;
  y: number;
}

export interface Feature {
  id: string;
  name: string;

  position: FeaturePosition;

  type: string;
  shortDescription: string;

  targetMapId?: string;
}