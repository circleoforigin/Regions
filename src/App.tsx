import { useEffect, useRef, useState } from 'react';

import './App.css';

import { modulePresence } from './host/ModulePresence';
import { moduleEventBus } from './host/ModuleBus';
import MenuBar from './components/MenuBar'
import MapViewport from './components/MapViewport';
import type { Project } from './models/Project';
import type { Map as RegionMap } from './models/Map';
import type { Feature } from './models/Feature';
import type { RichTextDocument } from './models/RichText';
import { featureRepository } from './features/FeatureRepository';

import { mapRepository} from './maps/MapRepository';
import { createDefaultMap } from './maps/DefaultMap';
import { projectRepository } from './projects/ProjectRepository';;
import {
  hostedMapImageService,
} from './services/maps/HostedMapImageService';
import { useRegionsState } from './state/RegionsStateContext';

type ProjectActionOutcome = 'unchanged' | 'saved' | 'discarded';

function App() {
  const { dispatch } = useRegionsState();
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

  const [activeFeatures, setActiveFeatures] = useState<Feature[]>([]);

  const [
    activeMapImageUrl,
    setActiveMapImageUrl,
  ] = useState<string | null>(
    null
  );

  const activeProjectId = activeProject?.id ?? null;
  const activeMapId = activeMap?.id ?? null;

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
  fitMap: () => void;
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

const [autoSave, setAutoSave] = useState(false);

const [dirtyRevision, setDirtyRevision] = useState(0);

const [saveCompletionRevision, setSaveCompletionRevision] =
  useState(0);

const dirtyGenerationRef = useRef(0);

const saveInProgressRef = useRef<Promise<boolean> | null>(null);

const saveActiveProjectRef = useRef<() => Promise<boolean>>(
  async () => true
);

const [
  showUnsavedChangesDialog,
  setShowUnsavedChangesDialog,
] = useState(false);

const pendingProjectActionRef =
  useRef<((outcome: ProjectActionOutcome) => void) | null>(
    null
  );

  const [
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,
  ] = useState(false);

  const [showNewFeatureDialog, setShowNewFeatureDialog] =
  useState(false);

  const [newFeatureName, setNewFeatureName] = useState('');

  const [newFeaturePosition, setNewFeaturePosition] =
    useState<{ x: number; y: number } | null>(null);

  const [showNewLocationDialog, setShowNewLocationDialog] =
    useState(false);

  const [newLocationName, setNewLocationName] = useState('');

  const [newLocationPosition, setNewLocationPosition] =
    useState<{ x: number; y: number } | null>(null);

  const [pendingMaps, setPendingMaps] = useState<RegionMap[]>([]);

  const [pendingFeatures, setPendingFeatures] =
    useState<Feature[]>([]);

  const [pendingFocusFeatureId, setPendingFocusFeatureId] =
    useState<string | null>(null);

  const [navigationError, setNavigationError] =
    useState<string | null>(null);

  useEffect(() => {
    if (activeProjectId) {
      dispatch({
        type: 'project.activate',
        projectId: activeProjectId,
      });
      return;
    }

    dispatch({ type: 'session.reset' });
  }, [activeProjectId, dispatch]);

  useEffect(() => {
    if (!activeProjectId) return;

    dispatch({
      type: 'map.activate',
      mapId: activeMapId,
    });
  }, [activeMapId, activeProjectId, dispatch]);

  useEffect(() => {
    modulePresence.start();

    modulePresence.announceReady();

    if (moduleEventBus.hosted) {
      void moduleEventBus.registerActions([
        {
          id: 'Regions.LocationEntered',
          label: 'Location Entered',
          description: 'Raised when navigation into a Location completes.',
          fields: [
            { key: 'area', label: 'Area', type: 'string' },
            { key: 'parentMap', label: 'Parent Map', type: 'string' },
            { key: 'name', label: 'Name', type: 'string' },
            { key: 'type', label: 'Type', type: 'string' },
            { key: 'mapId', label: 'Map ID', type: 'string' },
            { key: 'featureId', label: 'Feature ID', type: 'string' },
          ],
        },
      ]).catch(() => undefined);
    }

    return () => {
      modulePresence.stop();
    };
  }, []);

  useEffect(() => {
  const unregisterStatus =
    moduleEventBus.registerRequestHandler(
      'project.status',
      () => ({
        projectId: activeProject?.id,
        projectName: activeProject?.name,
        dirty: projectDirty,
      })
    );

  const unregisterLoad =
    moduleEventBus.registerRequestHandler(
      'project.load',
      async (request) => {
        const payload = request.payload as
          | { projectId?: string }
          | undefined;

        if (!payload?.projectId) {
          throw new Error('project.load requires a projectId.');
        }

        const project =
          await projectRepository.loadProject(payload.projectId);

        if (!project) {
          throw new Error(
            `Project "${payload.projectId}" was not found.`
          );
        }

        await handleSelectProject(project);

        return {
          loaded: true,
          projectId: project.id,
          projectName: project.name,
        };
      }
    );

  const unregisterSave =
  moduleEventBus.registerRequestHandler(
    'project.save',
    async () => {
      if (!activeProject) {
        return {
          saved: false,
          projectId: undefined,
        };
      }

      const saved = await saveActiveProject();

      if (!saved) {
        throw new Error('Unable to save the active project.');
      }

      return {
        saved: true,
        projectId: activeProject.id,
      };
    }
  );

  const unregisterClose =
    moduleEventBus.registerRequestHandler(
      'project.close',
      (request) => {
        const payload = request.payload as
          | { discardChanges?: boolean }
          | undefined;

        if (projectDirty && !payload?.discardChanges) {
          throw new Error('Project has unsaved changes.');
        }

        closeProject();

        return {
          closed: true,
        };
      }
    );

  return () => {
    unregisterStatus();
    unregisterLoad();
    unregisterSave();
    unregisterClose();
  };
}, [activeProject, projectDirty]);  

function markProjectDirty() {
  dirtyGenerationRef.current += 1;
  setProjectDirty(true);
  setDirtyRevision((current) => current + 1);
}

function resetProjectDirty() {
  dirtyGenerationRef.current += 1;
  setProjectDirty(false);
}

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

    const rootMap = createDefaultMap({
      id: crypto.randomUUID(),
      now,
    });
    const project: Project = {
      id:
        crypto.randomUUID(),

      name:
        trimmedName,

      mapIds: [rootMap.id],

      rootMapId: rootMap.id,

      activeMapId: rootMap.id,

      createdAt:
        now,

      updatedAt:
        now,
    };

    try {
      await mapRepository.saveMap(rootMap);
      await projectRepository
        .saveProject(
          project
        );

      setActiveProject(project);
      setActiveMap(rootMap);
      setActiveFeatures([]);
      setPendingMaps([]);
      setPendingFeatures([]);
      setZoomControl(null);
      await loadMapImage(rootMap);
      resetProjectDirty();

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

  setZoomControl(
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

function normalizeMap(map: RegionMap): RegionMap {
  const featureIds = Array.isArray(map.featureIds)
    ? map.featureIds
    : [];
  const normalized = { ...map, featureIds };

  delete (normalized as RegionMap & { features?: Feature[] }).features;
  return normalized;
}

async function loadMapWithFeatures(mapId: string) {
  const map = await mapRepository.loadMap(mapId);
  if (!map) throw new Error(`Map "${mapId}" was not found.`);

  const normalizedMap = normalizeMap(map);
  const features = await featureRepository.loadFeatures(
    normalizedMap.featureIds
  );
  return { map: normalizedMap, features };
}

async function restorePersistedSource(
  projectId: string,
  mapId: string
) {
  const project = await projectRepository.loadProject(projectId);
  if (!project) throw new Error('The active Project was not found.');

  const source = await loadMapWithFeatures(mapId);
  setActiveProject(project);
  setActiveMap(source.map);
  setActiveFeatures(source.features);
  setPendingMaps([]);
  setPendingFeatures([]);
  setPendingFocusFeatureId(null);
  await loadMapImage(source.map);
  return { project, ...source };
}

async function navigateToFeatureTarget(
  sourceFeature: Feature,
  discardChanges: boolean
) {
  if (!activeProject || !activeMap) return;

  setNavigationError(null);
  const sourceMapId = activeMap.id;
  let sourceMapName = activeMap.name;
  let project = activeProject;
  let feature = sourceFeature;

  try {
    if (discardChanges) {
      const source = await restorePersistedSource(
        activeProject.id,
        sourceMapId
      );
      project = source.project;
      sourceMapName = source.map.name;
      const persistedFeature = source.features.find((candidate) => {
        return candidate.id === sourceFeature.id;
      });

      if (!persistedFeature) {
        throw new Error('The discarded Location no longer exists.');
      }
      feature = persistedFeature;
    }

    if (!feature.targetMapId || !feature.targetFeatureId) {
      throw new Error('This Feature has no valid navigation target.');
    }

    const destination = await loadMapWithFeatures(feature.targetMapId);
    const targetFeature = destination.features.find((candidate) => {
      return candidate.id === feature.targetFeatureId;
    });

    if (!targetFeature) {
      throw new Error('The target Feature could not be resolved.');
    }

    dispatch({
      type: 'navigation.push',
      entry: { mapId: sourceMapId, focusFeatureId: feature.id },
    });
    setActiveProject({
      ...project,
      activeMapId: destination.map.id,
    });
    setActiveMap(destination.map);
    setActiveFeatures(destination.features);
    setPendingFocusFeatureId(targetFeature.id);
    await loadMapImage(destination.map);
    moduleEventBus.emit('Regions.LocationEntered', {
      area: 'Location',
      parentMap: sourceMapName,
      name: targetFeature.name,
      type: targetFeature.type,
      mapId: destination.map.id,
      featureId: targetFeature.id,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to enter this Location.';
    console.error('Unable to enter Location:', error);
    setNavigationError(message);
  }
}

async function handleEnterFeature(feature: Feature) {
  if (!feature.targetMapId || !feature.targetFeatureId) return;
  dispatch({ type: 'featureMove.cancel' });

  if (projectDirty && !autoSave) {
    requestProjectAction((outcome) => {
      void navigateToFeatureTarget(feature, outcome === 'discarded');
    });
    return;
  }

  if (projectDirty || saveInProgressRef.current) {
    const saved = await saveActiveProject();
    if (!saved) return;
  }

  await navigateToFeatureTarget(feature, false);
}

function handleGoToParentMap() {
  if (!activeMap?.parentMapId) return;

  const returnFeatures = activeFeatures.filter((feature) => {
    return feature.targetMapId === activeMap.parentMapId &&
      Boolean(feature.targetFeatureId);
  });
  const returnFeature = returnFeatures.sort((left, right) => {
    return left.id.localeCompare(right.id);
  })[0];

  if (!returnFeature) {
    setNavigationError('No valid return Location was found.');
    return;
  }

  void handleEnterFeature(returnFeature);
}

async function handleSelectProject(project: Project) {
  setPendingMaps([]);
  setPendingFeatures([]);
  setPendingFocusFeatureId(null);
  setNavigationError(null);
  setActiveProject(
    project
  );

  setActiveMap(
    null
  );
  setActiveFeatures([]);

  if (project.activeMapId) {
    try {
      const map =
        await mapRepository.loadMap(
          project.activeMapId
        );

      const normalizedMap = map ? normalizeMap(map) : null;

      setActiveMap(normalizedMap);
      clearActiveMapImage();

      if (normalizedMap) {
        const features = await featureRepository.loadFeatures(
          normalizedMap.featureIds
        );

        setActiveFeatures(features);
        await loadMapImage(normalizedMap);
      }
    } catch (error) {
      console.error(
        'Unable to load active map:',
        error
      );
    }
  }

  resetProjectDirty();

  setShowLoadProjectDialog(
    false
  );
}

async function saveActiveProject(): Promise<boolean> {
  if (!activeProject) return true;
  if (saveInProgressRef.current) return saveInProgressRef.current;

  const project = activeProject;
  const map = activeMap;
  const features = activeFeatures;
  const maps = pendingMaps;
  const featuresToSave = pendingFeatures;
  const generation = dirtyGenerationRef.current;
  const savedAt = new Date();
  const updatedProject: Project = {
    ...project,
    updatedAt: savedAt,
  };
  const updatedMap = map
    ? normalizeMap({ ...map, updatedAt: savedAt })
    : null;

  const save = (async () => {
    try {
      if (updatedMap) {
        await Promise.all(
          features.map((feature) => {
            return featureRepository.saveFeature(feature);
          })
        );
        await mapRepository.saveMap(updatedMap);
      }

      await Promise.all(
        featuresToSave.map((feature) => {
          return featureRepository.saveFeature(feature);
        })
      );

      await Promise.all(
        maps.map((pendingMap) => {
          return mapRepository.saveMap(pendingMap);
        })
      );

      await projectRepository.saveProject(updatedProject);

      if (dirtyGenerationRef.current === generation) {
        if (updatedMap) setActiveMap(updatedMap);
        setActiveProject(updatedProject);
        setPendingMaps([]);
        setPendingFeatures([]);
        setProjectDirty(false);
      } else {
        setSaveCompletionRevision((current) => current + 1);
      }

      return true;
    } catch (error) {
      console.error('Unable to save project:', error);
      return false;
    } finally {
      saveInProgressRef.current = null;
    }
  })();

  saveInProgressRef.current = save;
  return save;
}

saveActiveProjectRef.current = saveActiveProject;

useEffect(() => {
  if (!projectDirty || !autoSave) return;
  if (saveInProgressRef.current) return;

  void saveActiveProjectRef.current();
}, [
  autoSave,
  projectDirty,
  dirtyRevision,
  saveCompletionRevision,
]);

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

  setActiveFeatures([]);

  setPendingMaps([]);

  setPendingFeatures([]);

  setPendingFocusFeatureId(null);

  setNavigationError(null);

  clearActiveMapImage();

  resetProjectDirty();
}

function handleCloseProject() {
  requestProjectAction(
    closeProject
  );
}

function requestProjectAction(
  action: (outcome: ProjectActionOutcome) => void
) {
  if (!projectDirty) {
    action('unchanged');
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
  let outcome: ProjectActionOutcome;

  if (saveChanges) {
    const saved =
      await saveActiveProject();

    if (!saved) {
      return;
    }
    outcome = 'saved';
  } else {
    setPendingMaps([]);
    setPendingFeatures([]);
    resetProjectDirty();
    outcome = 'discarded';
  }

  const action =
    pendingProjectActionRef.current;

  pendingProjectActionRef.current =
    null;

  setShowUnsavedChangesDialog(
    false
  );

  action?.(outcome);
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

function handleSubtitleChange(featureId: string, subtitle: string) {
  setActiveFeatures((current) =>
    current.map((feature) =>
      feature.id === featureId
        ? {
            ...feature,
            subtitle: subtitle || undefined,
          }
        : feature
    )
  );

  markProjectDirty();
}

function handleDescriptionChange(
  featureId: string,
  description: RichTextDocument
) {
  setActiveFeatures((current) => current.map((feature) => {
    return feature.id === featureId ? { ...feature, description } : feature;
  }));
  markProjectDirty();
}

function handleFeatureMove(
  featureId: string,
  position: Feature['position']
) {
  setActiveFeatures((current) => current.map((feature) => {
    return feature.id === featureId ? { ...feature, position } : feature;
  }));
  markProjectDirty();
}

function handleNewFeatureRequest(x: number, y: number) {
  setNewFeaturePosition({ x, y });
  setNewFeatureName('');
  setShowNewFeatureDialog(true);
}

function handleCreateFeature() {
  if (!activeMap || !newFeaturePosition) {
    return;
  }

  const name = newFeatureName.trim();

  if (!name) {
    return;
  }

  const feature: Feature = {
    id: crypto.randomUUID(),
    name,
    position: newFeaturePosition,
    type: 'feature',
    noteLinks: [],
  };

  setActiveFeatures((current) => [...current, feature]);
  setActiveMap({
    ...activeMap,
    featureIds: [...activeMap.featureIds, feature.id],
    updatedAt: new Date(),
  });

  markProjectDirty();
  setShowNewFeatureDialog(false);
  setNewFeaturePosition(null);
  setNewFeatureName('');
}

function handleNewLocationRequest(x: number, y: number) {
  setNewLocationPosition({ x, y });
  setNewLocationName('');
  setShowNewLocationDialog(true);
}

function handleCreateLocation() {
  if (!activeProject || !activeMap || !newLocationPosition) return;

  const name = newLocationName.trim();
  if (!name) return;

  const now = new Date();
  const featureAId = crypto.randomUUID();
  const featureBId = crypto.randomUUID();
  const childMap = createDefaultMap({
    id: crypto.randomUUID(),
    now,
    parentMapId: activeMap.id,
  });
  const feature: Feature = {
    id: featureAId,
    name,
    position: newLocationPosition,
    type: 'location',
    noteLinks: [],
    targetMapId: childMap.id,
    targetFeatureId: featureBId,
  };
  const returnFeature: Feature = {
    id: featureBId,
    name: 'Return',
    position: {
      x: 0,
      y: 0,
    },
    type: 'location',
    noteLinks: [],
    targetMapId: activeMap.id,
    targetFeatureId: featureAId,
  };

  childMap.featureIds = [returnFeature.id];

  setActiveFeatures((current) => [...current, feature]);
  setActiveMap({
    ...activeMap,
    featureIds: [...activeMap.featureIds, feature.id],
    updatedAt: now,
  });
  setActiveProject({
    ...activeProject,
    mapIds: [...activeProject.mapIds, childMap.id],
    updatedAt: now,
  });
  setPendingMaps((current) => [...current, childMap]);
  setPendingFeatures((current) => [...current, returnFeature]);

  markProjectDirty();
  setShowNewLocationDialog(false);
  setNewLocationPosition(null);
  setNewLocationName('');
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

imageRegistration: {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
},

featureIds: [],

        createdAt:
          now,

        updatedAt:
          now,
      };
    }

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
    if (!activeMap) setActiveFeatures([]);
    await loadMapImage(updatedMap);
    setActiveProject(updatedProject);

    markProjectDirty();
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
  onGoToParentMap={handleGoToParentMap}
  onAssignMapImage={() => assignMapInputRef.current?.click()}
  autoSave={autoSave}
  onAutoSaveChange={setAutoSave}
  projectName={
    activeProject?.name
  }
  mapActive={activeMap !== null}
  parentMapAvailable={Boolean(activeMap?.parentMapId)}
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
  onFitMap={
    zoomControl?.fitMap
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

{showNewFeatureDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>New Feature</h2>

      <input
        type="text"
        placeholder="Feature name"
        value={newFeatureName}
        onChange={(event) =>
          setNewFeatureName(event.target.value)
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            handleCreateFeature();
          }
        }}
        autoFocus
      />

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() => {
            setShowNewFeatureDialog(false);
            setNewFeaturePosition(null);
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!newFeatureName.trim()}
          onClick={handleCreateFeature}
        >
          Create
        </button>
      </div>
    </div>
  </div>
)}

{showNewLocationDialog && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>New Location</h2>

      <input
        type="text"
        placeholder="Location name"
        value={newLocationName}
        onChange={(event) => {
          setNewLocationName(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleCreateLocation();
        }}
        autoFocus
      />

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() => {
            setShowNewLocationDialog(false);
            setNewLocationPosition(null);
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!newLocationName.trim()}
          onClick={handleCreateLocation}
        >
          Create
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
  {navigationError && (
    <div className="regions-navigation-error" role="alert">
      {navigationError}
    </div>
  )}
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
      </div>
    ) : !activeMap.imageFileId ? (
      <div className="regions-empty-map">
        <h2>No Map Image</h2>
        <p>Use Map → Assign Map Image...</p>
      </div>
    ) : activeMapImageUrl ? (
      <MapViewport
        key={activeMap.id}
        imageUrl={activeMapImageUrl}
        mapName={activeMap.name}
        imageRegistration={activeMap.imageRegistration}
        features={activeFeatures}
        focusFeatureId={pendingFocusFeatureId}
        onFocusFeatureComplete={() => setPendingFocusFeatureId(null)}
        onEnterFeature={(feature) => void handleEnterFeature(feature)}
        onSubtitleChange={handleSubtitleChange}
        onDescriptionChange={handleDescriptionChange}
        onFeatureMove={handleFeatureMove}
        onNewFeatureRequest={handleNewFeatureRequest}
        onNewLocationRequest={handleNewLocationRequest}
        onZoomStateChange={setZoomControl}
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
