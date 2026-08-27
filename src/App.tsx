import { useEffect, useState } from 'react';

import './App.css';

import { modulePresence } from './host/ModulePresence';
import MenuBar from './components/MenuBar'
import type { Project} from './models/Project';

import { projectRepository} from './projects/ProjectRepository';;

function App() {
    const [
    activeProject,
    setActiveProject,
  ] = useState<Project | null>(
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

  useEffect(() => {
    modulePresence.start();

    modulePresence.announceReady();

    return () => {
      modulePresence.stop();
    };
  }, []);

    function handleNewProject() {
    setNewProjectName('');
    setShowNewProjectDialog(true);
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

      setActiveProject(
        project
      );

      setNewProjectName('');
      setShowNewProjectDialog(false);
    } catch (error) {
      console.error(
        'Unable to create project:',
        error
      );
    }
  }

  return (
    <div className="regions-app">
      <MenuBar
  onNewProject={
    handleNewProject
  }
  onLoadProject={() => {}}
  onSaveProject={() => {}}
  onCloseProject={() => {}}
  onDeleteProject={() => {}}
  projectName={
    activeProject?.name
  }
/>

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

      <main className="regions-workspace">
  <section className="regions-map-workspace">
    {!activeProject ? (
      <div className="regions-empty-map">
        <h2>No Project Loaded</h2>

        <p>
          Create or load a project to get started.
        </p>
      </div>
    ) : (
      <div className="regions-empty-map">
        <h2>No Map Selected</h2>

        <button
          type="button"
          onClick={() => {
            // Assign Map behavior comes next.
          }}
        >
          Assign Map
        </button>
      </div>
    )}
  </section>
</main>
    </div>
  );
}

export default App;