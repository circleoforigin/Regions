import { useEffect, useRef, useState } from 'react';

import './App.css';

import { modulePresence } from './host/ModulePresence';
import MenuBar from './components/MenuBar'
import type { Project} from './models/Project';
import type {Map as RegionMap} from './models/Map';

import { mapRepository} from './maps/MapRepository';
import { projectRepository} from './projects/ProjectRepository';;

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

      setActiveMap(
        map
      );
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
          onClick={() => {
            // Assign Map behavior comes next.
          }}
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
          onClick={() => {
            // Assign Map behavior comes next.
          }}
        >
          Assign Map
        </button>
      </div>
    ) : (
      <div className="regions-empty-map">
        <h2>
          {activeMap.name}
        </h2>

        <p>
          Map image rendering comes next.
        </p>
      </div>
    )}
  </section>
</main>
    </div>
  );
}

export default App;