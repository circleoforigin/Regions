
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
