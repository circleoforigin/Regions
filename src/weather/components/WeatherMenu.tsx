
import { useRegionsState } from '../../state/RegionsStateContext';
import { defaultLayerVisibility } from '../../state/RegionsState';

interface WeatherMenuProps
{
  projectActive: boolean;
}

export default function WeatherMenu({
  projectActive,
}: WeatherMenuProps)
{
  const { state, dispatch } = useRegionsState();

  const visible =
    state.layerVisibility?.weatherNodes ??
    defaultLayerVisibility.weatherNodes;

  const windVisible =
    state.layerVisibility?.weatherWind ??
    defaultLayerVisibility.weatherWind;

  const temperatureVisible =
    state.layerVisibility?.weatherTemperature ??
    defaultLayerVisibility.weatherTemperature;

  return (
    <div className="dropdown-menu">
      <button
        type="button"
        className="dropdown-item"
        role="menuitemcheckbox"
        aria-checked={visible}
        disabled={!projectActive}
        onClick={() =>
        {
          dispatch({
            type: 'layers.setVisibility',
            layer: 'weatherNodes',
            visible: !visible,
          });
        }}
      >
        <span className="dropdown-check">
          {visible ? '✓' : ''}
        </span>
        Show Nodes
      </button>
      <button
  type="button"
  className="dropdown-item"
  role="menuitemcheckbox"
  aria-checked={windVisible}
  disabled={!projectActive}
  onClick={() =>
  {
    dispatch({
      type: 'layers.setVisibility',
      layer: 'weatherWind',
      visible: !windVisible,
    });
  }}
>
  <span className="dropdown-check">
    {windVisible ? '✓' : ''}
  </span>
  Show Wind
</button>

<button
  type="button"
  className="dropdown-item"
  role="menuitemcheckbox"
  aria-checked={temperatureVisible}
  disabled={!projectActive}
  onClick={() => {
    dispatch({
      type: 'layers.setVisibility',
      layer: 'weatherTemperature',
      visible: !temperatureVisible,
    });
  }}
>
  <span className="dropdown-check">
    {temperatureVisible ? '✓' : ''}
  </span>
  Show Temperature
</button>
      <div className="dropdown-separator" />

      <button
        type="button"
        className="dropdown-item"
        disabled
      >
        Configure...
      </button>
    </div>
  );
}
