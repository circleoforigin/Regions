import type {
  PathSegment,
  StandalonePathTerminal,
} from '../models/Path';

import type {
  SpatialPoint,
} from '../spatial/SpatialAnchor';

import {
  getPathSegmentPoints,
  resolvePathSegments,
} from './PathMapState';

import type {
  Feature,
} from '../models/Feature';

interface PathDragPreview {
  kind: 'terminal' | 'shape';
  id: string;
  segmentId?: string;
  position: SpatialPoint;
  pointerId: number;
}

interface PathOverlayProps {
  editing: boolean;
  distanceTargeting: boolean;
  onDistancePathClick: (
    segmentId: string,
    position: SpatialPoint,
    usePath: boolean
  ) => void;
  terminals:
    StandalonePathTerminal[];
  segments:
    PathSegment[];
  features:
    Feature[];
  draftStartPosition?:
    SpatialPoint | null;
  draftShapePoints?:
    SpatialPoint[];
  draftPointer?:
    SpatialPoint | null;
  dragPreview?:
    PathDragPreview | null;
  mapToScreen: (
    x: number,
    y: number
  ) => SpatialPoint;
  onSegmentRightClick: (
    event:
      React.MouseEvent<SVGPolylineElement>,
    segmentId: string
  ) => void;
  onSegmentShiftClick: (
    event:
      React.MouseEvent<SVGPolylineElement>,
    segmentId: string
  ) => void;
  onTerminalPointerDown: (
    event:
      React.PointerEvent<SVGCircleElement>,
    terminalId: string
  ) => void;
  onShapePointerDown: (
    event:
      React.PointerEvent<SVGCircleElement>,
    segmentId: string,
    pointId: string
  ) => void;
  onNodePointerUp: (
    event:
      React.PointerEvent<SVGCircleElement>
  ) => void;
  onNodePointerCancel: () => void;
}

export default function PathOverlay({
  editing,
  distanceTargeting,
  onDistancePathClick,
  terminals,
  segments,
  features,

  draftStartPosition,
  draftShapePoints = [],
  draftPointer,
  dragPreview,

  mapToScreen,

  onSegmentRightClick,
  onSegmentShiftClick,
  onTerminalPointerDown,
  onShapePointerDown,
  onNodePointerUp,
  onNodePointerCancel,
}: PathOverlayProps) {
  const displayedTerminals =
    terminals.map((terminal) =>
      dragPreview?.kind ===
        'terminal' &&
      dragPreview.id === terminal.id
        ? {
            ...terminal,
            position:
              dragPreview.position,
          }
        : terminal
    );

  const displayedSegments =
    segments.map((segment) => {
      if (
        dragPreview?.kind !==
          'shape' ||
        dragPreview.segmentId !==
          segment.id
      ) {
        return segment;
      }

      return {
        ...segment,

        shapePoints:
          segment.shapePoints.map(
            (point) =>
              point.id ===
                dragPreview.id
                ? {
                    ...point,
                    position:
                      dragPreview.position,
                  }
                : point
          ),
      };
    });

  const resolved =
    resolvePathSegments(
      displayedSegments,
      displayedTerminals,
      features
    );

  return (
    <svg
      className="path-overlay"
      aria-label="Path network"
    >
      {resolved.map((item) => {
        const points =
          getPathSegmentPoints(item)
            .map((point) =>
              mapToScreen(
                point.x,
                point.y
              )
            );

        return (
          <polyline
            key={item.segment.id}
            className={[
                'path-segment',
                editing
                    ? 'path-segment-editable'
                    : distanceTargeting
                        ? 'path-segment-distance-target'
                        : 'path-segment-display',
            ].join(' ')}
            points={
              points
                .map(
                  (point) =>
                    `${point.x},${point.y}`
                )
                .join(' ')
            }
            onContextMenu={(event) =>
              onSegmentRightClick(
                event,
                item.segment.id
              )
            }
            onClick={(event) => {
  if (distanceTargeting) {
    event.preventDefault();
    event.stopPropagation();

    const svg =
      event.currentTarget
        .ownerSVGElement;

    if (!svg) {
      return;
    }

    const rect =
      svg.getBoundingClientRect();

    const screenPoint = {
      x:
        event.clientX -
        rect.left,
      y:
        event.clientY -
        rect.top,
    };

    const mapPoints =
      getPathSegmentPoints(item);

    const screenPoints =
      mapPoints.map((point) =>
        mapToScreen(
          point.x,
          point.y
        )
      );

    let bestIndex = 0;
    let bestT = 0;
    let bestDistance =
      Infinity;

    for (
      let index = 0;
      index <
      screenPoints.length - 1;
      index += 1
    ) {
      const start =
        screenPoints[index];

      const end =
        screenPoints[index + 1];

      const dx =
        end.x - start.x;

      const dy =
        end.y - start.y;

      const lengthSquared =
        dx * dx + dy * dy;

      const t =
        lengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                (
                  (
                    screenPoint.x -
                    start.x
                  ) * dx +
                  (
                    screenPoint.y -
                    start.y
                  ) * dy
                ) /
                  lengthSquared
              )
            );

      const projected = {
        x:
          start.x +
          dx * t,
        y:
          start.y +
          dy * t,
      };

      const distance =
        Math.hypot(
          projected.x -
            screenPoint.x,
          projected.y -
            screenPoint.y
        );

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;
        bestIndex = index;
        bestT = t;
      }
    }

    const mapStart =
      mapPoints[bestIndex];

    const mapEnd =
      mapPoints[
        bestIndex + 1
      ];

    onDistancePathClick(
      item.segment.id,
      {
        x:
          mapStart.x +
          (
            mapEnd.x -
            mapStart.x
          ) * bestT,

        y:
          mapStart.y +
          (
            mapEnd.y -
            mapStart.y
          ) * bestT,
      },
      event.ctrlKey
    );

    return;
  }

  if (!event.shiftKey) {
    return;
  }

  onSegmentShiftClick(
    event,
    item.segment.id
  );
}}
          />
        );
      })}

      {editing && displayedSegments.flatMap(
        (segment) =>
          segment.shapePoints.map(
            (point) => {
              const screen =
                mapToScreen(
                  point.position.x,
                  point.position.y
                );

              return (
                <circle
                  key={`${segment.id}:${point.id}`}
                  className="path-shape-node"
                  cx={screen.x}
                  cy={screen.y}
                  r={4}
                  onPointerDown={
                    (event) =>
                      onShapePointerDown(
                        event,
                        segment.id,
                        point.id
                      )
                  }
                  onPointerUp={
                    onNodePointerUp
                  }
                  onPointerCancel={
                    onNodePointerCancel
                  }
                  onLostPointerCapture={
                    onNodePointerCancel
                  }
                />
              );
            }
          )
      )}

      {editing && displayedTerminals.map(
        (terminal) => {
          const screen =
            mapToScreen(
              terminal.position.x,
              terminal.position.y
            );

          return (
            <circle
              key={terminal.id}
              className="path-terminal-node"
              cx={screen.x}
              cy={screen.y}
              r={5}
              onPointerDown={
                (event) =>
                  onTerminalPointerDown(
                    event,
                    terminal.id
                  )
              }
              onPointerUp={
                onNodePointerUp
              }
              onPointerCancel={
                onNodePointerCancel
              }
              onLostPointerCapture={
                onNodePointerCancel
              }
            />
          );
        }
      )}

      {editing && draftStartPosition && (
        <polyline
          className="path-segment path-segment-draft"
          points={[
            draftStartPosition,
            ...draftShapePoints,
            ...(draftPointer
              ? [draftPointer]
              : []),
          ]
            .map((point) =>
              mapToScreen(
                point.x,
                point.y
              )
            )
            .map(
              (point) =>
                `${point.x},${point.y}`
            )
            .join(' ')}
        />
      )}
    </svg>
  );
}