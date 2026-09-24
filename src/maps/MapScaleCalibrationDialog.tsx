import {
  useEffect,
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

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h2>Calibrate Scale</h2>

        <p>
          Click two points on the map
          with a known distance between
          them.
        </p>

        <p>
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

        {(firstPoint ||
          secondPoint) && (
          <button
            type="button"
            onClick={
              onResetPoints
            }
          >
            Reset Points
          </button>
        )}

        <div className="dialog-buttons">
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
  );
}

export default MapScaleCalibrationDialog;