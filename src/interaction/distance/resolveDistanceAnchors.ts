import type { Feature } from '../../models/Feature';
import type { Piece } from '../../models/Piece';

import type {
  DistanceAnchor,
  ResolvedDistanceAnchor,
} from './DistanceMeasurement';

export function resolveDistanceAnchors(
  anchors: DistanceAnchor[],
  features: Feature[],
  pieces: Piece[]
): ResolvedDistanceAnchor[] {
  const resolved: ResolvedDistanceAnchor[] = [];

  for (const anchor of anchors) {
    if (anchor.kind === 'temporary') {
      resolved.push({
        anchor,
        position: anchor.position,
      });

      continue;
    }

    if (anchor.kind === 'feature') {
      const feature = features.find(
        (candidate) =>
          candidate.id === anchor.featureId
      );

      if (!feature) {
        continue;
      }

      resolved.push({
        anchor,
        position: feature.position,
      });

      continue;
    }

    const piece = pieces.find(
      (candidate) =>
        candidate.id === anchor.pieceId
    );

    if (!piece) {
      continue;
    }

    resolved.push({
      anchor,
      position: piece.position,
    });
  }

  return resolved;
}