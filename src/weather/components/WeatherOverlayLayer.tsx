import type {
  Map as RegionMap,
  MapImageRegistration,
} from '../../models/Map';
import { useRegionsState } from '../../state/RegionsStateContext';
import { defaultLayerVisibility } from '../../state/RegionsState';
import { useWeather } from '../WeatherContext';

import WeatherNodeOverlay from './WeatherNodeOverlay';
import WeatherWindOverlay from './WeatherWindOverlay';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface WeatherOverlayLayerProps {
  map: RegionMap;
  registration: MapImageRegistration;
  imageSize: Size;
  viewportSize: Size;
  scale: number;
  pan: Point;
}

export default function WeatherOverlayLayer({
  map,
  registration,
  imageSize,
  viewportSize,
  scale,
  pan,
}: WeatherOverlayLayerProps) {
  const { state } = useRegionsState();

const {
  worldContext,
  configuration,
  movementCycle,
  pressureField,
  windField,
} = useWeather();

  const visibility =
    state.layerVisibility ??
    defaultLayerVisibility;

  const showNodes =
    visibility.weatherNodes;

  const showWind =
    visibility.weatherWind;

// Initial atmospheric position.
// Temporary until SimClock is connected.
const movementStep = 0;

  return (
    <>
{showNodes &&
  pressureField && (
    <WeatherNodeOverlay
      map={map}
      registration={registration}
      imageSize={imageSize}
      viewportSize={viewportSize}
      scale={scale}
      pan={pan}
      pressureField={pressureField}
    />
  )}

      {showWind &&
        configuration &&
        movementCycle &&
        windField &&
        movementStep !== null && (
          <WeatherWindOverlay
            map={map}
            registration={registration}
            imageSize={imageSize}
            viewportSize={viewportSize}
            scale={scale}
            pan={pan}
            windField={windField}
            movementCycle={movementCycle}
            configuration={configuration}
            movementStep={movementStep}
          />
        )}
    </>
  );
}
