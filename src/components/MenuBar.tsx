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

  projectName?: string;
}

function MenuBar({
  onNewProject,
  onLoadProject,
  onSaveProject,
  onCloseProject,
  onDeleteProject,
  projectName,
}: MenuBarProps) {
  const menuBarRef =
    useRef<HTMLDivElement>(null);

  const [
    fileMenuOpen,
    setFileMenuOpen,
  ] = useState(false);

  useEffect(() => {
    if (!fileMenuOpen) {
      return;
    }

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
        setFileMenuOpen(
          false
        );
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
  }, [fileMenuOpen]);

  function closeMenus() {
    setFileMenuOpen(
      false
    );
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
            setFileMenuOpen(
              (open) => !open
            );
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
    </div>
  );
}

export default MenuBar;