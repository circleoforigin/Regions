import { useEffect, useRef, useState } from 'react';

import './App.css';

import { modulePresence } from './host/ModulePresence';
import MenuBar from './components/MenuBar'
import MapViewport from './components/MapViewport';
import type { Project} from './models/Project';
import type {Map as RegionMap} from './models/Map';

import { mapRepository} from './maps/MapRepository';
import { projectRepository} from './projects/ProjectRepository';;
import { hostedMapImageService} from './services/maps/HostedMapImageService';

function App() {
  const [
    activeProject,
    setActiveProject,
  ] = useState<Project | null>(
    null
  );

  const [
    activeMap,
    setActiveMap,
  ] = useState<RegionMap | null>(
    null
  );

  const [
    activeMapImageUrl,
    setActiveMapImageUrl,
  ] = useState<string | null>(
    null
  );

  const assignMapInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

    const [
  zoomControl,
  setZoomControl,
] = useState<{
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  setZoom: (
    value: number
  ) => void;
} | null>(
  null
);

  const [
    showNewProjectDialog,
    setShowNewProjectDialog,
  ] = useState(false);

  const [
    newProjectName,
    setNewProjectName,
  ] = useState('');

const [
  showLoadProjectDialog,
  setShowLoadProjectDialog,
] = useState(false);

const [
  savedProjects,
  setSavedProjects,
] = useState<Project[]>([]);

const [
  projectDirty,
  setProjectDirty,
] = useState(false);

const [
  showUnsavedChangesDialog,
  setShowUnsavedChangesDialog,
] = useState(false);

const pendingProjectActionRef =
  useRef<(() => void) | null>(
    null
  );

  const [
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,
  ] = useState(false);

  useEffect(() => {
    modulePresence.start();

    modulePresence.announceReady();

    return () => {
      modulePresence.stop();
    };
  }, []);

    function openNewProjectDialog() {
  setNewProjectName('');
  setShowNewProjectDialog(true);
}

function handleNewProject() {
  requestProjectAction(
    openNewProjectDialog
  );
}

  async function handleCreateProject() {
    const trimmedName =
      newProjectName.trim();

    if (!trimmedName) {
      return;
    }

    const now =
      new Date();

    const project: Project = {
      id:
        crypto.randomUUID(),

      name:
        trimmedName,

      mapIds: [],

      createdAt:
        now,

      updatedAt:
        now,
    };

    try {
      await projectRepository
        .saveProject(
          project
        );

      setActiveProject(project);
      setActiveMap(null);
      setProjectDirty(false);

      setNewProjectName('');
      setShowNewProjectDialog(false);
    } catch (error) {
      console.error(
        'Unable to create project:',
        error
      );
    }
  }

  async function openLoadProjectDialog() {
  try {
    const projects =
      await projectRepository
        .loadProjects();

    setSavedProjects(
      projects
    );

    setShowLoadProjectDialog(
      true
    );
  } catch (error) {
    console.error(
      'Unable to load projects:',
      error
    );
  }
}

function handleLoadProject() {
  requestProjectAction(() => {
    void openLoadProjectDialog();
  });
}

function clearActiveMapImage() {
  if (activeMapImageUrl) {
    URL.revokeObjectURL(
      activeMapImageUrl
    );
  }

  setActiveMapImageUrl(
    null
  );
}

async function loadMapImage(
  map: RegionMap
) {
  clearActiveMapImage();

  if (!map.imageFileId) {
    return;
  }

  try {
    const imageAsset =
      await hostedMapImageService
        .loadAsset(
          map.imageFileId
        );

    if (!imageAsset) {
      console.error(
        'Map image asset was not found.'
      );

      return;
    }

    const blob =
      await hostedMapImageService
        .readImage(
          imageAsset
        );

    if (!blob) {
      console.error(
        'Map image file was not found.'
      );

      return;
    }

    const imageUrl =
      URL.createObjectURL(
        blob
      );

    setActiveMapImageUrl(
      imageUrl
    );
  } catch (error) {
    console.error(
      'Unable to load map image:',
      error
    );
  }
}

async function handleSelectProject(
  project: Project
) {
  setActiveProject(
    project
  );

  setActiveMap(
    null
  );

  if (project.activeMapId) {
    try {
      const map =
        await mapRepository.loadMap(
          project.activeMapId
        );

      setActiveMap(map);
      clearActiveMapImage();

      if (map) {
        await loadMapImage(map);
      }
    } catch (error) {
      console.error(
        'Unable to load active map:',
        error
      );
    }
  }

  setProjectDirty(false);

  setShowLoadProjectDialog(
    false
  );
}

async function saveActiveProject(): Promise<boolean> {
  if (!activeProject) {
    return true;
  }

  const updatedProject: Project = {
    ...activeProject,
    updatedAt: new Date(),
  };

  try {
    await projectRepository.saveProject(
      updatedProject
    );

    setActiveProject(
      updatedProject
    );

    setProjectDirty(false);

    return true;
  } catch (error) {
    console.error(
      'Unable to save project:',
      error
    );

    return false;
  }
}

function handleSaveProject() {
  void saveActiveProject();
}

function closeProject() {
  setActiveProject(
    null
  );

  setActiveMap(
    null
  );

  clearActiveMapImage();

  setProjectDirty(false);
}

function handleCloseProject() {
  requestProjectAction(
    closeProject
  );
}

function requestProjectAction(
  action: () => void
) {
  if (!projectDirty) {
    action();
    return;
  }

  pendingProjectActionRef.current =
    action;

  setShowUnsavedChangesDialog(
    true
  );
}

async function finishPendingProjectAction(
  saveChanges: boolean
) {
  if (saveChanges) {
    const saved =
      await saveActiveProject();

    if (!saved) {
      return;
    }
  } else {
    setProjectDirty(false);
  }

  const action =
    pendingProjectActionRef.current;

  pendingProjectActionRef.current =
    null;

  setShowUnsavedChangesDialog(
    false
  );

  action?.();
}

function cancelPendingProjectAction() {
  pendingProjectActionRef.current =
    null;

  setShowUnsavedChangesDialog(
    false
  );
}

async function handleDeleteProject() {
  try {
    const projects =
      await projectRepository
        .loadProjects();

    setSavedProjects(
      projects
    );

    setShowDeleteProjectDialog(
      true
    );
  } catch (error) {
    console.error(
      'Unable to load projects for deletion:',
      error
    );
  }
}

async function handleDeleteSelectedProject(
  project: Project
) {
  const confirmed =
    window.confirm(
      `Delete "${project.name}"? This cannot be undone.`
    );

  if (!confirmed) {
    return;
  }

  try {
    const deleted =
      await projectRepository
        .deleteProject(
          project.id
        );

    if (!deleted) {
      console.error(
        'Project was not deleted.'
      );

      return;
    }

    setSavedProjects(
      (current) =>
        current.filter(
          (candidate) =>
            candidate.id !==
            project.id
        )
    );

    setShowDeleteProjectDialog(
      false
    );
  } catch (error) {
    console.error(
      'Unable to delete project:',
      error
    );
  }
}

async function handleAssignMapFile(
  file: File
) {
  if (!activeProject) {
    return;
  }

  try {
    const imageAsset =
      await hostedMapImageService
        .importLocalFile(
          file
        );

    const now =
      new Date();

    let updatedMap: RegionMap;

    if (activeMap) {
      updatedMap = {
        ...activeMap,

        imageFileId:
          imageAsset.id,

        updatedAt:
          now,
      };
    } else {
      updatedMap = {
        id:
          crypto.randomUUID(),

        name:
          file.name.replace(
            /\.[^/.]+$/,
            ''
          ),

        imageFileId:
          imageAsset.id,

        features: [],

        createdAt:
          now,

        updatedAt:
          now,
      };
    }

    await mapRepository.saveMap(
      updatedMap
    );

    const isNewMap =
      !activeProject.mapIds.includes(
        updatedMap.id
      );

    const updatedProject: Project = {
      ...activeProject,

      mapIds:
        isNewMap
          ? [
              ...activeProject.mapIds,
              updatedMap.id,
            ]
          : activeProject.mapIds,

      rootMapId:
        activeProject.rootMapId ??
        updatedMap.id,

      activeMapId:
        updatedMap.id,

      updatedAt:
        now,
    };

    setActiveMap(updatedMap);
    await loadMapImage(updatedMap);
    setActiveProject(updatedProject);

    setProjectDirty(true);
  } catch (error) {
    console.error(
      'Unable to assign map:',
      error
    );
  }
}

const deletableProjects =
  savedProjects.filter(
    (project) =>
      project.id !==
      activeProject?.id
  );

  return (
    <div className="regions-app">
      <MenuBar
  onNewProject={
    handleNewProject
  }
  onLoadProject={
    handleLoadProject
  }
  onSaveProject={() =>
    void handleSaveProject()
  }
  onCloseProject={
    handleCloseProject
  }
  onDeleteProject={() =>
    void handleDeleteProject()
  }
  projectName={
  activeProject?.name
}

zoomValue={
  zoomControl?.value
}

zoomMin={
  zoomControl?.min
}

zoomMax={
  zoomControl?.max
}

zoomStep={
  zoomControl?.step
}

zoomDisabled={
  zoomControl?.disabled
}

onZoomChange={
  zoomControl?.setZoom
}
/>

{showUnsavedChangesDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>
        Unsaved Changes
      </h2>

      <p>
        Save changes to the current project?
      </p>

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() =>
            void finishPendingProjectAction(
              true
            )
          }
        >
          Save
        </button>

        <button
          type="button"
          onClick={() =>
            void finishPendingProjectAction(
              false
            )
          }
        >
          Don't Save
        </button>

        <button
          type="button"
          onClick={
            cancelPendingProjectAction
          }
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{showNewProjectDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>
        New Project
      </h2>

      <input
        type="text"
        placeholder="Project name"
        value={newProjectName}
        onChange={(event) =>
          setNewProjectName(
            event.target.value
          )
        }
        onKeyDown={(event) => {
          if (
            event.key === 'Enter'
          ) {
            void handleCreateProject();
          }
        }}
        autoFocus
      />

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() =>
            setShowNewProjectDialog(
              false
            )
          }
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={
            !newProjectName.trim()
          }
          onClick={() =>
            void handleCreateProject()
          }
        >
          Create
        </button>
      </div>
    </div>
  </div>
)}

{showLoadProjectDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>
        Load Project
      </h2>

      <div className="project-picker-list">
        {savedProjects.length === 0 ? (
          <p>
            No saved projects.
          </p>
        ) : (
          savedProjects.map(
            (project) => (
              <button
                key={project.id}
                type="button"
                className="project-picker-item"
                onClick={() =>
                  void handleSelectProject(
                    project
                  )
                }
              >
                {project.name}
              </button>
            )
          )
        )}
      </div>

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() =>
            setShowLoadProjectDialog(
              false
            )
          }
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{showDeleteProjectDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>
        Delete Project
      </h2>

      <p>
        Select a project to delete.
      </p>

      <div className="project-picker-list">
        {deletableProjects.length === 0 ? (
          <p>
            No projects available to delete.
          </p>
        ) : (
          deletableProjects.map(
            (project) => (
              <button
                key={project.id}
                type="button"
                className="project-picker-item"
                onClick={() =>
                  void handleDeleteSelectedProject(
                    project
                  )
                }
              >
                {project.name}
              </button>
            )
          )
        )}
      </div>

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() =>
            setShowDeleteProjectDialog(
              false
            )
          }
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

<input
  ref={assignMapInputRef}
  type="file"
  accept="image/*"
  hidden
  onChange={(event) => {
    const file =
      event.target.files?.[0];

    if (file) {
      void handleAssignMapFile(
        file
      );
    }

    event.target.value = '';
  }}
/>

      <main className="regions-workspace">
  <section className="regions-map-workspace">
    {!activeProject ? (
      <div className="regions-empty-map">
        <h2>
          No Project Loaded
        </h2>

        <p>
          Create or load a project to get started.
        </p>
      </div>
    ) : !activeMap ? (
      <div className="regions-empty-map">
        <h2>
          No Map Selected
        </h2>

        <button
          type="button"
          onClick={() =>
            assignMapInputRef.current?.click()
          }
        >
          Assign Map
        </button>
      </div>
    ) : !activeMap.imageFileId ? (
      <div className="regions-empty-map">
        <h2>
          No Map Selected
        </h2>

        <button
          type="button"
          onClick={() =>
            assignMapInputRef.current?.click()
          }
        >
          Assign Map
        </button>
      </div>
    ) : activeMapImageUrl ? (
      <MapViewport
  imageUrl={
    activeMapImageUrl
  }
  mapName={
    activeMap.name
  }
  onZoomStateChange={
    setZoomControl
  }
/>
    ) : (
  <div className="regions-empty-map">
    <h2>
      Loading Map...
    </h2>
  </div>
)}
  </section>
</main>
    </div>
  );
}

export default App;