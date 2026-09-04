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
import type { SectionKind } from '../models/Section';
import type { Piece } from '../models/Piece';
import { isPieceTracked } from '../models/Piece';

const LAYER_OPTIONS: { id: RegionsLayer; label: string }[] = [
  { id: 'features', label: 'Features' },
  { id: 'locations', label: 'Locations' },
  { id: 'areas', label: 'Areas' },
  { id: 'zones', label: 'Zones' },
  { id: 'borders', label: 'Borders' },
  { id: 'boundary', label: 'Boundary' },
];

interface MenuBarProps {
  onNewProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
  onCloseProject: () => void;
  onDeleteProject: () => void;
  onGoToMap: () => void;
  onGoToParentMap: () => void;
  onDeleteMap: () => void;
  onAddPiece: () => void;
  onGoToPiece: () => void;
  onMigratePiece: () => void;
  onAssignMapImage: () => void;
  onOpenSettings: () => void;
  onManageFeatureTypes: () => void;
  sectionMode: SectionKind | null;
  onSectionModeChange: (mode: SectionKind | null) => void;

  projectName?: string;
  mapActive: boolean;
  parentMapAvailable: boolean;
  addPieceEnabled: boolean;
  pieces: Piece[];
  focusedPieceId?: string;
  onFocusPiece: (pieceId: string | null) => void;

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
  onGoToMap,
  onGoToParentMap,
  onDeleteMap,
  onAddPiece,
  onGoToPiece,
  onMigratePiece,
  onAssignMapImage,
  onOpenSettings,
  onManageFeatureTypes,
  sectionMode,
  onSectionModeChange,
  projectName,
  mapActive,
  parentMapAvailable,
  addPieceEnabled,
  pieces,
  focusedPieceId,
  onFocusPiece,

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
  const [pieceMenuOpen, setPieceMenuOpen] = useState(false);
  const [sectionsMenuOpen, setSectionsMenuOpen] = useState(false);
  const trackedPieces = pieces.filter(isPieceTracked);

  useEffect(() => {
    if (!fileMenuOpen && !mapMenuOpen && !settingsMenuOpen &&
        !pieceMenuOpen && !sectionsMenuOpen) return;

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
        setPieceMenuOpen(false);
        setSectionsMenuOpen(false);
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
  }, [
    fileMenuOpen,
    mapMenuOpen,
    pieceMenuOpen,
    sectionsMenuOpen,
    settingsMenuOpen,
  ]);

  function closeMenus() {
    setFileMenuOpen(false);
    setMapMenuOpen(false);
    setLayersMenuOpen(false);
    setSettingsMenuOpen(false);
    setPieceMenuOpen(false);
    setSectionsMenuOpen(false);
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
            setSectionsMenuOpen(false);
            setPieceMenuOpen(false);
            setSectionsMenuOpen(false);
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
            setPieceMenuOpen(false);
            setSectionsMenuOpen(false);
          }}
        >
          Map
        </button>

        {mapMenuOpen && (
          <div className="dropdown-menu">
            <button
              type="button"
              className="dropdown-item"
              disabled={!mapActive}
              onClick={() => {
                closeMenus();
                onGoToMap();
              }}
            >
              Go to Map...
            </button>

            <div className="dropdown-separator" />

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
              disabled={!addPieceEnabled}
              onClick={() => {
                closeMenus();
                onAddPiece();
              }}
            >
              Add Piece...
            </button>

            <button
              type="button"
              className="dropdown-item"
              disabled={pieces.length === 0}
              onClick={() => {
                closeMenus();
                onGoToPiece();
              }}
            >
              Go to Piece...
            </button>

            <button
              type="button"
              className="dropdown-item"
              disabled={!addPieceEnabled || pieces.length === 0}
              onClick={() => {
                closeMenus();
                onMigratePiece();
              }}
            >
              Migrate Piece...
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
                    const visible = layerVisibility[option.id] ?? true;

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

            <div className="dropdown-separator" />

            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                closeMenus();
                onDeleteMap();
              }}
            >
              Delete Map...
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
            setSectionsMenuOpen((open) => !open);
            setFileMenuOpen(false);
            setMapMenuOpen(false);
            setLayersMenuOpen(false);
            setSettingsMenuOpen(false);
            setPieceMenuOpen(false);
          }}
        >
          Sections
        </button>

        {sectionsMenuOpen && (
          <div className="dropdown-menu">
            {(['area', 'zone', 'border', 'boundary'] as SectionKind[])
              .map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    onSectionModeChange(kind);
                    closeMenus();
                  }}
                >
                  <span className="dropdown-check">
                    {sectionMode === kind ? '✓' : ''}
                  </span>
                  {kind[0].toUpperCase() + kind.slice(1)}
                </button>
              ))}
            <div className="dropdown-separator" />
            <button
              type="button"
              className="dropdown-item"
              disabled={!sectionMode}
              onClick={() => {
                onSectionModeChange(null);
                closeMenus();
              }}
            >
              Exit Section Mode
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
            setLayersMenuOpen(false);
            setPieceMenuOpen(false);
            setSectionsMenuOpen(false);
          }}
        >
          Settings
        </button>

        {settingsMenuOpen && (
          <div className="dropdown-menu">
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                closeMenus();
                onOpenSettings();
              }}
            >
              Settings...
            </button>

            <button
              type="button"
              className="dropdown-item"
              disabled={!projectName}
              onClick={() => {
                closeMenus();
                onManageFeatureTypes();
              }}
            >
              Feature Types...
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

      <div className="menu-piece-control">
        <button
          type="button"
          disabled={!projectName}
          onClick={() => {
            setPieceMenuOpen((open) => !open);
            setFileMenuOpen(false);
            setMapMenuOpen(false);
            setLayersMenuOpen(false);
            setSettingsMenuOpen(false);
            setSectionsMenuOpen(false);
          }}
        >
          {trackedPieces.find((piece) => {
            return piece.id === focusedPieceId;
          })?.name ?? (
            trackedPieces.length > 0 ? 'Piece' : 'No Tracked Pieces'
          )}{' '}
          <span aria-hidden="true">▾</span>
        </button>

        {pieceMenuOpen && (
          <div className="dropdown-menu menu-piece-dropdown">
            {trackedPieces.length === 0 && (
              <span className="dropdown-empty">No tracked Pieces</span>
            )}
            {[...trackedPieces]
              .sort((left, right) => left.name.localeCompare(right.name))
              .map((piece) => (
                <button
                  key={piece.id}
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setPieceMenuOpen(false);
                    onFocusPiece(piece.id);
                  }}
                >
                  {piece.id === focusedPieceId ? '✓ ' : ''}
                  {piece.name}
                </button>
              ))}
          </div>
        )}
      </div>

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
