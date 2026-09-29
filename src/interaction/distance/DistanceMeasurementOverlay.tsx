import {
  convertMapDistance,
  formatPhysicalDistance,
  getSegmentPhysicalDistance,
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

  onRemoveAnchor?: (
    anchorId: string
  ) => void;

  onSelectTemporaryAnchor?: (
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

          const legDistance =
  getSegmentPhysicalDistance(
    segment,
    distanceScale
  );

const legReadout =
  legDistance &&
  legDistance.value > 0
    ? formatPhysicalDistance(
        legDistance
      )
    : null;

const midpointIndex =
  Math.floor(
    (points.length - 1) / 2
  );

const midpointStart =
  points[midpointIndex];

const midpointEnd =
  points[
    Math.min(
      midpointIndex + 1,
      points.length - 1
    )
  ];

const labelPosition = {
  x:
    (midpointStart.x +
      midpointEnd.x) /
    2,

  y:
    (midpointStart.y +
      midpointEnd.y) /
    2,
};

        const pointString =
          points
            .map(
              (point) =>
                `${point.x},${point.y}`
            )
            .join(' ');

        if (segment.kind === 'path') {
  return (
    <g
      key={
        `${segment.start.anchor.id}-${segment.end.anchor.id}`
      }
    >
      <polyline
        className="distance-measurement-path-outline"
        points={pointString}
      />

      <polyline
        className="distance-measurement-path"
        points={pointString}
      />

      {legReadout && (
        <text
          className="distance-measurement-leg-label"
          x={labelPosition.x}
          y={labelPosition.y - 10}
          textAnchor="middle"
        >
          {legReadout}
        </text>
      )}
    </g>
  );
}

        return (
  <g
    key={
      `${segment.start.anchor.id}-${segment.end.anchor.id}`
    }
  >
    <polyline
      className="distance-measurement-line"
      points={pointString}
    />

    {legReadout && (
      <text
        className="distance-measurement-leg-label"
        x={labelPosition.x}
        y={labelPosition.y - 10}
        textAnchor="middle"
      >
        {legReadout}
      </text>
    )}
  </g>
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
                        onSelectTemporaryAnchor?.(
                            resolved.anchor.pointId,
                            resolved.position
                        );
                    }
                }}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                onRemoveAnchor?.(
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