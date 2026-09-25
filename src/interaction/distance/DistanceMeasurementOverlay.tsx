import {
  formatPhysicalDistance,
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
  pointerPosition: Point | null;
  mapToScreen: (
    x: number,
    y: number
  ) => Point;

  onRemoveAnchor: (
    anchorId: string
  ) => void;

  onSelectTemporaryAnchor: (
    pointId: string,
    position: Point
) => void;
}

export default function DistanceMeasurementOverlay({
  anchors,
  distanceScale,
  pointerPosition,
  mapToScreen,
  onRemoveAnchor,
  onSelectTemporaryAnchor,
}: DistanceMeasurementOverlayProps) {
  const totalDistance =
    getTotalPhysicalDistance(
      anchors,
      distanceScale
    );
  const readout =
  anchors.length < 2
    ? null
    : totalDistance
      ? formatPhysicalDistance(
          totalDistance
        )
      : 'Scale not calibrated';
  const screenAnchors = anchors.map(
    (resolved) => ({
      ...resolved,
      screen: mapToScreen(
        resolved.position.x,
        resolved.position.y
      ),
    })
  );

  const temporaryNodes = Array.from(
    new Map(
        screenAnchors
        .filter(
            (resolved) =>
            resolved.anchor.kind ===
            'temporary'
        )
        .map((resolved) => [
            resolved.anchor.kind === 'temporary'
            ? resolved.anchor.pointId
            : '',
            resolved,
        ])
    ).values()
    );

  return (
  <>
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

      {temporaryNodes.map((resolved) => {
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
              onClick={(event) => {
  event.preventDefault();
  event.stopPropagation();

  if (
    resolved.anchor.kind ===
    'temporary'
  ) {
    onSelectTemporaryAnchor(
      resolved.anchor.pointId,
      resolved.position
    );
  }
}}
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

    {readout && pointerPosition && (
      <div
        className="distance-measurement-readout"
        style={{
          left: pointerPosition.x + 16,
          top: pointerPosition.y + 18,
        }}
      >
        {readout}
      </div>
    )}
  </>
);
}