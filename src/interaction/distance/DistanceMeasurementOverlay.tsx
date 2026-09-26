import {
  convertMapDistance,
  formatPhysicalDistance,
} from './DistanceMeasurement';

import type {
  DistanceScale,
  DistanceSegment,
  ResolvedDistanceAnchor,
} from './DistanceMeasurement';

interface Point {
  x: number;
  y: number;
}

interface DistanceMeasurementOverlayProps {
  anchors: ResolvedDistanceAnchor[];
  segments: DistanceSegment[];
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
  segments,
  distanceScale,
  pointerPosition,
  mapToScreen,
  onRemoveAnchor,
  onSelectTemporaryAnchor,
}: DistanceMeasurementOverlayProps) {
    const totalDistance =
    convertMapDistance(
      segments.reduce(
        (total, segment) =>
          total + segment.mapDistance,
        0
      ),
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

  const visibleNodes = Array.from(
  new Map(
    screenAnchors
      .filter(
        (resolved) =>
          resolved.anchor.kind ===
            'temporary' ||
          resolved.anchor.kind ===
            'path'
      )
      .map((resolved) => [
        resolved.anchor.kind ===
          'temporary'
          ? `temporary:${resolved.anchor.pointId}`
          : resolved.anchor.id,
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
            {segments.map((segment) => {
        const points =
          segment.points.map((point) =>
            mapToScreen(
              point.x,
              point.y
            )
          );

        return (
          <polyline
            key={
              `${segment.start.anchor.id}-${segment.end.anchor.id}`
            }
            className={[
              'distance-measurement-line',
              segment.kind === 'path'
                ? 'distance-measurement-path'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            points={points
              .map(
                (point) =>
                  `${point.x},${point.y}`
              )
              .join(' ')}
          />
        );
      })}

      {visibleNodes.map((resolved) => {
        
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

                    if (resolved.anchor.kind === 'temporary') 
                    {
                        onSelectTemporaryAnchor(
                            resolved.anchor.pointId,
                            resolved.position
                        );
                    }
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                onRemoveAnchor(resolved.anchor.id);
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