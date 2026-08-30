import {
  useEffect,
  useRef,
  useState,
} from 'react';

interface MenuBarProps {
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onCloseProject: () => void;
  onDeleteProject: () => void;
  onAssignMapImage: () => void;
  autoSave: boolean;
  onAutoSaveChange: (enabled: boolean) => void;

  projectName?: string;
  mapActive: boolean;

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
  onAssignMapImage,
  autoSave,
  onAutoSaveChange,
  projectName,
  mapActive,

  zoomValue,
  zoomMin,
  zoomMax,
  zoomStep,
  zoomDisabled,
  onZoomChange,
  onFitMap,
}: MenuBarProps) {
  const menuBarRef =
    useRef<HTMLDivElement>(null);

  const [
    fileMenuOpen,
    setFileMenuOpen,
  ] = useState(false);

  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);

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
              onClick={() => {
                closeMenus();
                onAssignMapImage();
              }}
            >
              Assign Map Image...
            </button>
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
