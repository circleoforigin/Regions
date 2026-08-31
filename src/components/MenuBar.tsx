import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRegionsState } from '../state/RegionsStateContext';
import {
  defaultLayerVisibility,
  type RegionsLayer,
} from '../state/RegionsState';

const LAYER_OPTIONS: { id: RegionsLayer; label: string }[] = [
  { id: 'names', label: 'Names' },
  { id: 'features', label: 'Features' },
  { id: 'locations', label: 'Locations' },
];

interface MenuBarProps {
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onCloseProject: () => void;
  onDeleteProject: () => void;
  onGoToParentMap: () => void;
  onAssignMapImage: () => void;
  autoSave: boolean;
  onAutoSaveChange: (enabled: boolean) => void;

  projectName?: string;
  mapActive: boolean;
  parentMapAvailable: boolean;

  zoomValue?: number;
  zoomMin?: number;
  zoomMax?: number;
  zoomStep?: number;
  zoomDisabled?: boolean;
  onZoomChange?: (
    value: number
  ) => void;
  onFitMap?: () => void;
}

function MenuBar({
  onNewProject,
  onLoadProject,
  onSaveProject,
  onCloseProject,
  onDeleteProject,
  onGoToParentMap,
  onAssignMapImage,
  autoSave,
  onAutoSaveChange,
  projectName,
  mapActive,
  parentMapAvailable,

  zoomValue,
  zoomMin,
  zoomMax,
  zoomStep,
  zoomDisabled,
  onZoomChange,
  onFitMap,
}: MenuBarProps) {
  const { state, dispatch } = useRegionsState();
  const layerVisibility =
    state.layerVisibility ?? defaultLayerVisibility;
  const menuBarRef =
    useRef<HTMLDivElement>(null);

  const [
    fileMenuOpen,
    setFileMenuOpen,
  ] = useState(false);

  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);

  useEffect(() => {
    if (!fileMenuOpen && !mapMenuOpen && !settingsMenuOpen) return;

    function handleOutsidePointerDown(
      event: PointerEvent
    ) {
      const target =
        event.target;

      if (
        target instanceof Node &&
        !menuBarRef.current?.contains(
          target
        )
      ) {
        setFileMenuOpen(false);
        setMapMenuOpen(false);
        setLayersMenuOpen(false);
        setSettingsMenuOpen(false);
      }
    }

    document.addEventListener(
      'pointerdown',
      handleOutsidePointerDown
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown
      );
    };
  }, [fileMenuOpen, mapMenuOpen, settingsMenuOpen]);

  function closeMenus() {
    setFileMenuOpen(false);
    setMapMenuOpen(false);
    setLayersMenuOpen(false);
    setSettingsMenuOpen(false);
  }

  function handleNewProject() {
    closeMenus();
    onNewProject();
  }

  function handleLoadProject() {
    closeMenus();
    onLoadProject();
  }

  function handleSaveProject() {
    closeMenus();
    onSaveProject();
  }

  function handleCloseProject() {
    closeMenus();
    onCloseProject();
  }

  function handleDeleteProject() {
    closeMenus();
    onDeleteProject();
  }

  return (
    <div
      ref={menuBarRef}
      className="menu-bar"
    >
      <div className="menu-group">
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setFileMenuOpen((open) => !open);
            setMapMenuOpen(false);
            setLayersMenuOpen(false);
            setSettingsMenuOpen(false);
          }}
        >
          Project
        </button>

        {fileMenuOpen && (
          <div className="dropdown-menu">
            <button
              type="button"
              className="dropdown-item"
              onClick={
                handleNewProject
              }
            >
              New Project...
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={
                handleLoadProject
              }
            >
              Load Project...
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={
                handleSaveProject
              }
              disabled={!projectName}
            >
              Save Project
            </button>

            <button
              type="button"
              className="dropdown-item"
              onClick={
                handleCloseProject
              }
              disabled={!projectName}
            >
              Close Project
            </button>

            <div
              className="dropdown-separator"
            />

            <button
              type="button"
              className="dropdown-item"
              onClick={
                handleDeleteProject
              }
            >
              Delete Project...
            </button>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          type="button"
          className="menu-item"
          disabled={!mapActive}
          onClick={() => {
            setMapMenuOpen((open) => !open);
            setLayersMenuOpen(false);
            setFileMenuOpen(false);
            setSettingsMenuOpen(false);
          }}
        >
          Map
        </button>

        {mapMenuOpen && (
          <div className="dropdown-menu">
            <button
              type="button"
              className="dropdown-item"
              disabled={!parentMapAvailable}
              onClick={() => {
                closeMenus();
                onGoToParentMap();
              }}
            >
              Go to Parent Map
            </button>

            <div className="dropdown-separator" />

            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                closeMenus();
                onAssignMapImage();
              }}
            >
              Assign Map Image...
            </button>

            <div
              className="dropdown-submenu-host"
              onPointerEnter={() => setLayersMenuOpen(true)}
            >
              <button
                type="button"
                className="dropdown-item dropdown-submenu-trigger"
                aria-haspopup="menu"
                aria-expanded={layersMenuOpen}
                onClick={() => setLayersMenuOpen((open) => !open)}
              >
                <span>Layers</span>
                <span aria-hidden="true">▸</span>
              </button>

              {layersMenuOpen && (
                <div className="dropdown-menu dropdown-submenu">
                  {LAYER_OPTIONS.map((option) => {
                    const visible = layerVisibility[option.id];

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className="dropdown-item"
                        role="menuitemcheckbox"
                        aria-checked={visible}
                        onClick={() => dispatch({
                          type: 'layers.setVisibility',
                          layer: option.id,
                          visible: !visible,
                        })}
                      >
                        <span className="dropdown-check">
                          {visible ? '✓' : ''}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          type="button"
          className="menu-item"
          onClick={() => {
            setSettingsMenuOpen((open) => !open);
            setFileMenuOpen(false);
            setMapMenuOpen(false);
            setLayersMenuOpen(false);
          }}
        >
          Settings
        </button>

        {settingsMenuOpen && (
          <div className="dropdown-menu">
            <button
              type="button"
              className="dropdown-item"
              role="menuitemcheckbox"
              aria-checked={autoSave}
              onClick={() => {
                onAutoSaveChange(!autoSave);
                closeMenus();
              }}
            >
              <span className="dropdown-check">
                {autoSave ? '✓' : ''}
              </span>
              Autosave
            </button>
          </div>
        )}
      </div>

      {projectName && (
        <div className="menu-project-name">
          {projectName}.proj
        </div>
      )}

      <div className="menu-bar-spacer" />

{zoomValue !== undefined &&
  zoomMin !== undefined &&
  zoomMax !== undefined &&
  zoomStep !== undefined &&
  onZoomChange && (
    <div className="menu-zoom-control">
      <span>
        −
      </span>

      <input
        type="range"
        min={zoomMin}
        max={zoomMax}
        step={zoomStep}
        value={zoomValue}
        disabled={
          zoomDisabled
        }
        onChange={(event) =>
          onZoomChange(
            Number(
              event.target.value
            )
          )
        }
      />

      <span>
        +
      </span>
      <button
        type="button"
        className="menu-fit-map"
        disabled={zoomDisabled}
        onClick={onFitMap}
        >
        Fit
      </button>
    </div>
  )}
    </div>
  );
}

export default MenuBar;
