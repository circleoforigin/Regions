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

function projectClickOntoSegment(
  event:
    React.MouseEvent<SVGPolylineElement>,
  mapPoints: SpatialPoint[],
  mapToScreen: (
    x: number,
    y: number
  ) => SpatialPoint
): SpatialPoint | null {
  const svg =
    event.currentTarget.ownerSVGElement;

  if (
    !svg ||
    mapPoints.length < 2
  ) {
    return null;
  }

  const rect =
    svg.getBoundingClientRect();

  const screenPoint = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };

  const screenPoints =
    mapPoints.map((point) =>
      mapToScreen(
        point.x,
        point.y
      )
    );

  let bestIndex = 0;
  let bestT = 0;
  let bestDistance = Infinity;

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
        start.x + dx * t,
      y:
        start.y + dy * t,
    };

    const distance =
      Math.hypot(
        projected.x -
          screenPoint.x,
        projected.y -
          screenPoint.y
      );

    if (
      distance < bestDistance
    ) {
      bestDistance = distance;
      bestIndex = index;
      bestT = t;
    }
  }

  const mapStart =
    mapPoints[bestIndex];

  const mapEnd =
    mapPoints[bestIndex + 1];

  return {
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
  };
}

interface PathOverlayProps {
  editing: boolean;
  terminalPromotionEnabled: boolean;
  distanceTargeting: boolean;
  exploreTargeting: boolean;
  targetedSegmentId?: string;
  targetedTerminalId?: string;
  onDistancePathClick: (
    segmentId: string,
    position: SpatialPoint,
    usePath: boolean
  ) => void;
  onExplorePathClick: (
    segmentId: string,
    position: SpatialPoint
  ) => void;
  onDistanceTerminalClick: (
    terminalId: string,
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
  onTerminalContextMenu: (
    event:
      React.MouseEvent<SVGCircleElement>,
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
  terminalPromotionEnabled,
  distanceTargeting,
  exploreTargeting,
  targetedSegmentId,
  targetedTerminalId,
  onDistancePathClick,
  onExplorePathClick,
  onDistanceTerminalClick,
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
  onTerminalContextMenu,
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
              `path-segment-${item.segment.type}`,
              editing
                ? 'path-segment-editable'
                : distanceTargeting
                  ? 'path-segment-distance-target'
                  : exploreTargeting
                    ? 'path-segment-explore-target'
                    : 'path-segment-display',

              targetedSegmentId ===
              item.segment.id
                ? 'path-segment-piece-target'
                : '',
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
  const mapPoints =
    getPathSegmentPoints(item);

  if (distanceTargeting) {
    event.preventDefault();
    event.stopPropagation();

    const position =
      projectClickOntoSegment(
        event,
        mapPoints,
        mapToScreen
      );

    if (!position) {
      return;
    }

    onDistancePathClick(
      item.segment.id,
      position,
      event.ctrlKey
    );

    return;
  }

  if (exploreTargeting) {
    event.preventDefault();
    event.stopPropagation();

    const position =
      projectClickOntoSegment(
        event,
        mapPoints,
        mapToScreen
      );

    if (!position) {
      return;
    }

    onExplorePathClick(
      item.segment.id,
      position
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
              className={[
                'path-terminal-node',
                editing
                  ? 'path-terminal-node-editable'
                  : terminalPromotionEnabled
                    ? 'path-terminal-node-promotable'
                    : 'path-terminal-node-display',
              ].join(' ')}
              cx={screen.x}
              cy={screen.y}
              r={targetedTerminalId === terminal.id
                ? 8
                : 5
                }
              onClick={(event) => {
                if (!distanceTargeting) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                onDistanceTerminalClick(
                    terminal.id,
                    event.ctrlKey
                );
              }}
              onContextMenu={(event) =>
                onTerminalContextMenu(
                  event,
                  terminal.id
                )
              }
              onPointerDown={
                editing
                  ? (event) =>
                      onTerminalPointerDown(
                        event,
                        terminal.id
                      )
                  : undefined
              }
              onPointerUp={
                editing
                  ? onNodePointerUp
                  : undefined
              }
              onPointerCancel={
                editing
                  ? onNodePointerCancel
                  : undefined
              }
              onLostPointerCapture={
                editing
                  ? onNodePointerCancel
                  : undefined
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