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
}

export default function PathOverlay({
  terminals,
  segments,
  features,

  draftStartPosition,
  draftShapePoints = [],
  draftPointer,

  mapToScreen,

  onSegmentRightClick,
  onSegmentShiftClick,
  onTerminalPointerDown,
  onShapePointerDown,
}: PathOverlayProps) {
  const resolved =
    resolvePathSegments(
      segments,
      terminals,
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
            onContextMenu={(event) => {
              onSegmentRightClick(
                event,
                item.segment.id
              );
            }}
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

      {segments.flatMap(
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
                />
              );
            }
          )
      )}

      {terminals.map(
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