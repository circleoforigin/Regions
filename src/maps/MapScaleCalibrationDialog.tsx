import {
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  Map as RegionMap,
  MapDistanceUnit,
} from '../models/Map';

import {
  applyMapScaleCalibration,
  calculatePixelDistance,
  createMapScaleCalibration,
  type MapScalePoint,
} from './MapScaleCalibration';

interface MapScaleCalibrationDialogProps {
  map: RegionMap;
  firstPoint: MapScalePoint | null;
  secondPoint: MapScalePoint | null;

  onResetPoints: () => void;
  onClose: () => void;

  onSave: (
    map: RegionMap
  ) => void;
}

interface WindowPosition {
  x: number;
  y: number;
}

function MapScaleCalibrationDialog({
  map,
  firstPoint,
  secondPoint,
  onResetPoints,
  onClose,
  onSave,
}: MapScaleCalibrationDialogProps) {
  const [
    distance,
    setDistance,
  ] = useState('');

  const [
    unit,
    setUnit,
  ] = useState<MapDistanceUnit>(
    map.imageRegistration
      ?.distanceScale
      ?.unit ?? 'miles'
  );

  const [
    position,
    setPosition,
  ] = useState<WindowPosition>({
    x: 24,
    y: 72,
  });

  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  useEffect(() => {
    const existing =
      map.imageRegistration
        ?.distanceScale;

    setDistance(
      existing
        ? String(existing.distance)
        : ''
    );

    setUnit(
      existing?.unit ?? 'miles'
    );
  }, [map]);

  const pixelDistance =
    firstPoint && secondPoint
      ? calculatePixelDistance(
          firstPoint,
          secondPoint
        )
      : null;

  const numericDistance =
    Number(distance);

  const canSave =
    firstPoint !== null &&
    secondPoint !== null &&
    Number.isFinite(
      numericDistance
    ) &&
    numericDistance > 0;

  function handleSave() {
    if (
      !firstPoint ||
      !secondPoint
    ) {
      return;
    }

    const calibration =
      createMapScaleCalibration(
        firstPoint,
        secondPoint,
        numericDistance,
        unit
      );

    if (!calibration) {
      return;
    }

    onSave({
      ...map,

      imageRegistration:
        applyMapScaleCalibration(
          map.imageRegistration,
          calibration
        ),

      updatedAt:
        new Date(),
    });
  }

  function handleDragStart(
    event:
      React.PointerEvent<HTMLDivElement>
  ) {
    const windowElement =
      event.currentTarget
        .parentElement;

    if (!windowElement) {
      return;
    }

    const rect =
      windowElement
        .getBoundingClientRect();

    dragRef.current = {
      pointerId:
        event.pointerId,

      offsetX:
        event.clientX -
        rect.left,

      offsetY:
        event.clientY -
        rect.top,
    };

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );
  }

  function handleDragMove(
    event:
      React.PointerEvent<HTMLDivElement>
  ) {
    const drag =
      dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const windowElement =
      event.currentTarget
        .parentElement;

    if (!windowElement) {
      return;
    }

    const rect =
      windowElement
        .getBoundingClientRect();

    const maxX =
      Math.max(
        0,
        window.innerWidth -
          rect.width
      );

    const maxY =
      Math.max(
        0,
        window.innerHeight -
          rect.height
      );

    setPosition({
      x: Math.max(
        0,
        Math.min(
          maxX,
          event.clientX -
            drag.offsetX
        )
      ),

      y: Math.max(
        0,
        Math.min(
          maxY,
          event.clientY -
            drag.offsetY
        )
      ),
    });
  }

  function handleDragEnd(
    event:
      React.PointerEvent<HTMLDivElement>
  ) {
    if (
      dragRef.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    dragRef.current = null;

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    } catch {
      // Capture may already
      // have been released.
    }
  }

  return (
    <div
      className="scale-calibration-window"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="scale-calibration-titlebar"
        onPointerDown={
          handleDragStart
        }
        onPointerMove={
          handleDragMove
        }
        onPointerUp={
          handleDragEnd
        }
        onPointerCancel={
          handleDragEnd
        }
      >
        <span>
          Calibrate Scale
        </span>

        <button
          type="button"
          className="scale-calibration-close"
          onPointerDown={(event) =>
            event.stopPropagation()
          }
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="scale-calibration-content">
        <p>
          Click two points on the map
          with a known distance between
          them.
        </p>

        <p className="scale-calibration-status">
          {!firstPoint
            ? 'Click the first point.'
            : !secondPoint
              ? 'Now click the second point.'
              : `${pixelDistance?.toFixed(
                  1
                )} pixels selected.`}
        </p>

        <label>
          Distance

          <input
            type="number"
            min="0"
            step="any"
            value={distance}
            onChange={(event) =>
              setDistance(
                event.target.value
              )
            }
          />
        </label>

        <label>
          Unit

          <select
            value={unit}
            onChange={(event) =>
              setUnit(
                event.target
                  .value as
                  MapDistanceUnit
              )
            }
          >
            <option value="feet">
              Feet
            </option>

            <option value="miles">
              Miles
            </option>

            <option value="meters">
              Meters
            </option>

            <option value="kilometers">
              Kilometers
            </option>
          </select>
        </label>

        <div className="scale-calibration-actions">
          <button
            type="button"
            disabled={
              !firstPoint &&
              !secondPoint
            }
            onClick={
              onResetPoints
            }
          >
            Reset Points
          </button>

          <div className="scale-calibration-actions-right">
            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapScaleCalibrationDialog;