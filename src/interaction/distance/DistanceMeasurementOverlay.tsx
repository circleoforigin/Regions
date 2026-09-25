import type { DistancePoint } from './DistanceMeasurement';

interface Point {
  x: number;
  y: number;
}

interface DistanceMeasurementOverlayProps {
  points: DistancePoint[];
  mapToScreen: (x: number, y: number) => Point;
  onRemovePoint: (pointId: string) => void;
}

export default function DistanceMeasurementOverlay({
  points,
  mapToScreen,
  onRemovePoint,
}: DistanceMeasurementOverlayProps) {
  const screenPoints = points.map((point) => ({
    ...point,
    screen: mapToScreen(
      point.position.x,
      point.position.y
    ),
  }));

  return (
    <svg
      className="distance-measurement-layer"
      aria-hidden="true"
    >
      {screenPoints.slice(1).map((point, index) => {
        const previous = screenPoints[index];

        return (
          <line
            key={`${previous.id}-${point.id}`}
            className="distance-measurement-line"
            x1={previous.screen.x}
            y1={previous.screen.y}
            x2={point.screen.x}
            y2={point.screen.y}
          />
        );
      })}

      {screenPoints.map((point) => (
        <g key={point.id}>
          <circle
            className="distance-measurement-node"
            cx={point.screen.x}
            cy={point.screen.y}
            r={5}
          />

          <circle
            className="distance-measurement-node-hitbox"
            cx={point.screen.x}
            cy={point.screen.y}
            r={7}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemovePoint(point.id);
            }}
          />
        </g>
      ))}
    </svg>
  );
}