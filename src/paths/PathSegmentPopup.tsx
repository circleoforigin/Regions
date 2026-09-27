import type {
  PointerEvent as ReactPointerEvent,
} from 'react';

import type {
  PathSegment,
} from '../models/Path';

interface PathSegmentPopupProps {
  segment: PathSegment;

  position: {
    x: number;
    y: number;
  };

  onPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerMove: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerUp: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void;

  onPointerCancel: () => void;
}

export default function PathSegmentPopup({
  segment,
  position,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: PathSegmentPopupProps) {
  return (
    <div
      className="feature-popup path-segment-popup"
      style={{
        left: position.x,
        top: position.y,
      }}
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      onClick={(event) =>
        event.stopPropagation()
      }
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div
        className="feature-popup-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={
          onPointerCancel
        }
      >
        <div className="feature-popup-name">
          {segment.name?.trim() ||
            'Unnamed Path'}
        </div>

        {segment.subtitle?.trim() && (
          <div className="feature-popup-subtitle">
            {segment.subtitle}
          </div>
        )}
      </div>

      <div className="path-segment-popup-body">
        {segment.brief ? (
          <div className="path-segment-popup-brief">
            Brief
          </div>
        ) : (
          <div className="path-segment-popup-empty">
            No brief
          </div>
        )}
      </div>
    </div>
  );
}