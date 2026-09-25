import {
  getTotalPhysicalDistance,
} from './DistanceMeasurement';

import type {
  DistanceScale,
  ResolvedDistanceAnchor,
} from './DistanceMeasurement';

interface Point {
  x: number;
  y: number;
}

interface DistanceMeasurementOverlayProps {
  anchors: ResolvedDistanceAnchor[];

  distanceScale?: DistanceScale;

  mapToScreen: (
    x: number,
    y: number
  ) => Point;

  onRemoveAnchor: (
    anchorId: string
  ) => void;
}

export default function DistanceMeasurementOverlay({
  anchors,
  distanceScale,
  mapToScreen,
  onRemoveAnchor,
}: DistanceMeasurementOverlayProps) {
  const totalDistance =
    getTotalPhysicalDistance(
      anchors,
      distanceScale
    );
  const screenAnchors = anchors.map(
    (resolved) => ({
      ...resolved,
      screen: mapToScreen(
        resolved.position.x,
        resolved.position.y
      ),
    })
  );

  return (
    <svg
      className="distance-measurement-layer"
      aria-hidden="true"
    >
      {screenAnchors
        .slice(1)
        .map((resolved, index) => {
          const previous =
            screenAnchors[index];

          return (
            <line
              key={`${previous.anchor.id}-${resolved.anchor.id}`}
              className="distance-measurement-line"
              x1={previous.screen.x}
              y1={previous.screen.y}
              x2={resolved.screen.x}
              y2={resolved.screen.y}
            />
          );
        })}

      {screenAnchors.map((resolved) => {
        if (
          resolved.anchor.kind !==
          'temporary'
        ) {
          return null;
        }

        return (
          <g key={resolved.anchor.id}>
            <circle
              className="distance-measurement-node"
              cx={resolved.screen.x}
              cy={resolved.screen.y}
              r={5}
            />

            <circle
              className="distance-measurement-node-hitbox"
              cx={resolved.screen.x}
              cy={resolved.screen.y}
              r={7}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();

                onRemoveAnchor(
                  resolved.anchor.id
                );
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}