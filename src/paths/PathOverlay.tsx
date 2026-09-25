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
            className="path-segment"
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

      {displayedSegments.flatMap(
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

      {displayedTerminals.map(
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

      {draftStartPosition && (
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