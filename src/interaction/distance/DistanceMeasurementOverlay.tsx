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
  targetedAnchorId?: string;
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
  targetedAnchorId,
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

const breakpointNodes =
  segments
    .slice(0, -1)
    .map((segment) => ({
      position:
        segment.end.position,
    }))
    .filter(
      (breakpoint) =>
        !anchors.some(
          (anchor) =>
            Math.hypot(
              anchor.position.x -
                breakpoint.position.x,
              anchor.position.y -
                breakpoint.position.y
            ) < 0.000001
        )
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
  </g>
);
      })}

      {visibleNodes.map((resolved) => {
        
  return (
    <g key={resolved.anchor.id}>
      <circle
        className={[
          'distance-measurement-node',
          resolved.anchor.id === targetedAnchorId
            ? 'targeted'
            : '',
        ].filter(Boolean).join(' ')}
        cx={resolved.screen.x}
        cy={resolved.screen.y}
        r={
          resolved.anchor.id === targetedAnchorId
            ? 8
            : 5
        }
      />
            {(
                onRemoveAnchor || 
                onSelectTemporaryAnchor
            ) && (
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
            )}
          </g>
        );
      })}

      {breakpointNodes.map(
  (breakpoint, index) => {
    const screen =
      mapToScreen(
        breakpoint.position.x,
        breakpoint.position.y
      );

    return (
      <circle
        key={`breakpoint-${index}-${breakpoint.position.x}-${breakpoint.position.y}`}
        className="distance-measurement-node"
        cx={screen.x}
        cy={screen.y}
        r={5}
      />
    );
  }
)}

{segments.map((segment) => {
  const points =
    segment.points.map(
      (point) =>
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

  if (
    !legReadout ||
    points.length === 0
  ) {
    return null;
  }

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

  return (
    <text
      key={`label-${segment.start.anchor.id}-${segment.end.anchor.id}`}
      className="distance-measurement-leg-label"
      x={labelPosition.x}
      y={labelPosition.y - 10}
      textAnchor="middle"
    >
      {legReadout}
    </text>
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