import { useEffect, useMemo, useRef, useState } from 'react';

import './App.css';
import type {
  ProjectLoadAcceptedPayload,
  ProjectLoadFailedPayload,
  ProjectLoadedPayload,
  ProjectLoadRequest,
} from '@settingforge/module-sdk';

import { modulePresence } from './host/ModulePresence';
import { moduleEventBus } from './host/ModuleBus';
import MenuBar from './components/MenuBar'
import MapViewport from './components/MapViewport';
import type {
  LocationMapMetadata,
} from './components/MapViewport';
import FeatureTypesDialog from './components/FeatureTypesDialog';
import type { Project } from './models/Project';
import type { Map as RegionMap } from './models/Map';
import type { Feature } from './models/Feature';
import type { RichTextDocument } from './models/RichText';
import type { FeatureTypeDefinition } from './models/FeatureTypeDefinition';
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

  const [showLocationChoiceDialog, setShowLocationChoiceDialog] =
    useState(false);

  const [showExistingLocationDialog, setShowExistingLocationDialog] =
    useState(false);

  const [newLocationName, setNewLocationName] = useState('');

  const [newLocationTypeId, setNewLocationTypeId] =
    useState('');

  const [newLocationImage, setNewLocationImage] =
    useState<File | null>(null);

  const [projectMaps, setProjectMaps] = useState<RegionMap[]>([]);

  const [showGoToMapDialog, setShowGoToMapDialog] = useState(false);

  const [goToMapSearch, setGoToMapSearch] = useState('');

  const [goToMapTypeFilter, setGoToMapTypeFilter] = useState('all');

  const [selectedGoToMapId, setSelectedGoToMapId] =
    useState<string | null>(null);

  const [goToMapPreviewUrl, setGoToMapPreviewUrl] =
    useState<string | null>(null);

  const goToMapPreviewUrlRef = useRef<string | null>(null);
  const goToMapPreviewRunIdRef = useRef(0);

  const [locationSearch, setLocationSearch] = useState('');

  const [locationTypeFilter, setLocationTypeFilter] =
    useState('all');

  const [newLocationPosition, setNewLocationPosition] =
    useState<{ x: number; y: number } | null>(null);

  const [pendingMaps, setPendingMaps] = useState<RegionMap[]>([]);

  const [pendingFeatures, setPendingFeatures] =
    useState<Feature[]>([]);

  const [
    pendingFeatureDeletionIds,
    setPendingFeatureDeletionIds,
  ] = useState<Set<string>>(
    () => new Set()
  );

  const [pendingFocusFeatureId, setPendingFocusFeatureId] =
    useState<string | null>(null);

  const [navigationError, setNavigationError] =
    useState<string | null>(null);

  const [showFeatureTypesDialog, setShowFeatureTypesDialog] =
    useState(false);

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
    let cancelled = false;

    async function loadProjectLocationMaps() {
      if (!activeProject) {
        setProjectMaps([]);
        return;
      }

      const storedMaps = await mapRepository.loadMaps();
      if (cancelled) return;

      const availableMaps = new Map<string, RegionMap>();
      storedMaps.forEach((map) => availableMaps.set(map.id, map));
      pendingMaps.forEach((map) => availableMaps.set(map.id, map));

      const maps = activeProject.mapIds.flatMap((mapId) => {
        const map = availableMaps.get(mapId);
        return map ? [normalizeMap(map)] : [];
      });

      setProjectMaps(maps);
    }

    void loadProjectLocationMaps().catch((error) => {
      if (cancelled) return;
      console.error('Unable to load Project Maps:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [activeProject, pendingMaps]);

  const locationMapMetadata = useMemo(() => {
    if (!activeProject) return {};
    const availableMaps = new Map<string, RegionMap>();
    projectMaps.forEach((map) => availableMaps.set(map.id, map));
    pendingMaps.forEach((map) => availableMaps.set(map.id, map));
    if (activeMap) availableMaps.set(activeMap.id, activeMap);

    const metadata: Record<string, LocationMapMetadata> = {};
    activeFeatures.forEach((feature) => {
      if (!feature.targetMapId) return;
      const targetMap = availableMaps.get(feature.targetMapId);
      if (!targetMap) return;
      const typeName = activeProject.featureTypes.find((type) => {
        return type.id === targetMap.featureTypeId;
      })?.name ?? 'No Type';

      metadata[feature.id] = {
        mapId: targetMap.id,
        mapName: targetMap.name,
        typeName,
      };
    });
    return metadata;
  }, [
    activeFeatures,
    activeMap,
    activeProject,
    pendingMaps,
    projectMaps,
  ]);

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
          ],
        },
      ]).catch(() => undefined);
    }

    return () => {
      modulePresence.stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (goToMapPreviewUrlRef.current) {
        URL.revokeObjectURL(goToMapPreviewUrlRef.current);
      }
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
          | Partial<ProjectLoadRequest>
          | undefined;

        if (!payload?.projectId || !payload.loadId) {
          throw new Error(
            'project.load requires projectId and loadId.'
          );
        }

        const project =
          await projectRepository.loadProject(payload.projectId);

        if (!project) {
          throw new Error(
            `Project "${payload.projectId}" was not found.`
          );
        }

        const projectId = project.id;
        const loadId = payload.loadId;

        void handleSelectProject(project)
          .then(() => {
            const loaded: ProjectLoadedPayload = {
              projectId,
              loadId,
            };
            moduleEventBus.emit('project.loaded', loaded);
          })
          .catch((error: unknown) => {
            const failed: ProjectLoadFailedPayload = {
              projectId,
              loadId,
              error: error instanceof Error
                ? error.message
                : 'Project restoration failed.',
            };
            moduleEventBus.emit('project.loadFailed', failed);
          });

        const accepted: ProjectLoadAcceptedPayload = {
          accepted: true,
          projectId,
          loadId,
        };

        return accepted;
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

      featureTypes: [],

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

function handleMapEntered(
  map: RegionMap,
  project: Project,
  parentMapName?: string
) {
  const semanticType =
    project.featureTypes.find(
      (type) =>
        type.id === map.featureTypeId
    )?.name ?? '';

  moduleEventBus.emit(
    'Regions.LocationEntered',
    {
      area: 'Location',
      parentMap:
        parentMapName ?? '',
      name: map.name,
      type: semanticType,
      mapId: map.id,
    }
  );
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
  setPendingFeatureDeletionIds(
    new Set()
  );
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
    handleMapEntered(
  destination.map,
  project,
  sourceMapName
);
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

function clearGoToMapPreview() {
  goToMapPreviewRunIdRef.current += 1;
  if (goToMapPreviewUrlRef.current) {
    URL.revokeObjectURL(goToMapPreviewUrlRef.current);
  }
  goToMapPreviewUrlRef.current = null;
  setGoToMapPreviewUrl(null);
}

async function loadGoToMapPreview(map: RegionMap) {
  clearGoToMapPreview();
  if (!map.imageFileId) return;

  const runId = goToMapPreviewRunIdRef.current;

  try {
    const asset = await hostedMapImageService.loadAsset(map.imageFileId);
    if (!asset || runId !== goToMapPreviewRunIdRef.current) return;
    const image = await hostedMapImageService.readImage(asset);
    if (!image || runId !== goToMapPreviewRunIdRef.current) return;

    const previewUrl = URL.createObjectURL(image);
    if (runId !== goToMapPreviewRunIdRef.current) {
      URL.revokeObjectURL(previewUrl);
      return;
    }

    goToMapPreviewUrlRef.current = previewUrl;
    setGoToMapPreviewUrl(previewUrl);
  } catch (error) {
    console.error('Unable to load Map preview:', error);
  }
}

function selectGoToMap(map: RegionMap) {
  setSelectedGoToMapId(map.id);
  void loadGoToMapPreview(map);
}

function closeGoToMapDialog() {
  clearGoToMapPreview();
  setShowGoToMapDialog(false);
  setSelectedGoToMapId(null);
}

function handleOpenGoToMap() {
  if (!activeProject || !activeMap) return;
  setGoToMapSearch('');
  setGoToMapTypeFilter('all');
  setSelectedGoToMapId(activeMap.id);
  setShowGoToMapDialog(true);
  void loadGoToMapPreview(activeMap);
}

async function goDirectlyToMap(
  mapId: string,
  discardChanges: boolean
) {
  if (!activeProject || !activeMap) return;

  setNavigationError(null);
  let project = activeProject;

  try {
    if (discardChanges) {
      const source = await restorePersistedSource(
        activeProject.id,
        activeMap.id
      );
      project = source.project;
    }

    const destination = await loadMapWithFeatures(mapId);
    setActiveProject({ ...project, activeMapId: destination.map.id });
    setActiveMap(destination.map);
    setActiveFeatures(destination.features);
    setPendingFocusFeatureId(null);
    await loadMapImage(destination.map);
    closeGoToMapDialog();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to go to this Map.';
    console.error('Unable to go directly to Map:', error);
    setNavigationError(message);
  }
}

async function handleConfirmGoToMap() {
  if (!selectedGoToMapId || !activeMap) return;

  if (selectedGoToMapId === activeMap.id) {
    closeGoToMapDialog();
    return;
  }

  const destinationId = selectedGoToMapId;
  if (projectDirty && !autoSave) {
    requestProjectAction((outcome) => {
      void goDirectlyToMap(destinationId, outcome === 'discarded');
    });
    return;
  }

  if (projectDirty || saveInProgressRef.current) {
    const saved = await saveActiveProject();
    if (!saved) return;
  }

  await goDirectlyToMap(destinationId, false);
}

async function handleSelectProject(project: Project) {
  closeGoToMapDialog();
  setPendingMaps([]);
  setPendingFeatures([]);
  setPendingFeatureDeletionIds(
    new Set()
  ); 
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
        const featuresPromise = featureRepository.loadFeatures(
          normalizedMap.featureIds
        );
        const imagePromise = loadMapImage(normalizedMap);
        const features = await featuresPromise;

        setActiveFeatures(features);
        await imagePromise;
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
        Array.from(
          pendingFeatureDeletionIds
        ).map((featureId) => {
          return featureRepository.deleteFeature(
            featureId
          );
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
        setPendingFeatureDeletionIds(
          new Set()
        );
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
  closeGoToMapDialog();
  setActiveProject(
    null
  );

  setActiveMap(
    null
  );

  setActiveFeatures([]);
  setPendingMaps([]);
  setPendingFeatures([]);
  setPendingFeatureDeletionIds(
    new Set()
  );
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
    setPendingFeatureDeletionIds(
      new Set()
    );
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

function handleMapMetadataChange(
  name: string,
  featureTypeId: string | undefined
) {
  if (!activeMap) {
    return;
  }

  const trimmedName =
    name.trim();

  if (!trimmedName) {
    return;
  }

  if (
    activeMap.name === trimmedName &&
    activeMap.featureTypeId === featureTypeId
  ) {
    return;
  }

  setActiveMap({
    ...activeMap,
    name: trimmedName,
    featureTypeId,
    updatedAt: new Date(),
  });

  markProjectDirty();
}

function handleFeatureNameChange(
  featureId: string,
  name: string
) {
  const trimmedName =
    name.trim();

  if (!trimmedName) {
    return;
  }

  setActiveFeatures((current) =>
    current.map((feature) =>
      feature.id === featureId
        ? {
            ...feature,
            name: trimmedName,
          }
        : feature
    )
  );

  markProjectDirty();
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

function handleShowLabelChange(featureId: string, showLabel: boolean) {
  setActiveFeatures((current) => current.map((feature) => {
    return feature.id === featureId ? { ...feature, showLabel } : feature;
  }));
  markProjectDirty();
}

function handleFeatureTypeChange(
  featureId: string,
  featureTypeId: string | undefined
) {
  const feature = activeFeatures.find((item) => item.id === featureId);
  if (!feature || feature.featureTypeId === featureTypeId) return;
  setActiveFeatures((current) => current.map((feature) => {
    if (feature.id !== featureId) return feature;
    return { ...feature, featureTypeId };
  }));
  markProjectDirty();
}

function featureTypeNameExists(name: string, excludedId?: string): boolean {
  const normalizedName = name.trim().toLocaleLowerCase();
  return activeProject?.featureTypes.some((type) => {
    return type.id !== excludedId &&
      type.name.toLocaleLowerCase() === normalizedName;
  }) ?? false;
}

function handleAddFeatureType(name: string): boolean {
  if (!activeProject || featureTypeNameExists(name)) return false;
  const featureType: FeatureTypeDefinition = {
    id: crypto.randomUUID(),
    name: name.trim(),
  };
  setActiveProject({
    ...activeProject,
    featureTypes: [...activeProject.featureTypes, featureType],
  });
  markProjectDirty();
  return true;
}

function handleRenameFeatureType(id: string, name: string): boolean {
  if (!activeProject || featureTypeNameExists(name, id)) return false;
  const current = activeProject.featureTypes.find((type) => type.id === id);
  if (!current) return false;
  const trimmedName = name.trim();
  if (current.name === trimmedName) return true;
  setActiveProject({
    ...activeProject,
    featureTypes: activeProject.featureTypes.map((type) => {
      return type.id === id ? { ...type, name: trimmedName } : type;
    }),
  });
  markProjectDirty();
  return true;
}

function handleDeleteFeatureType(id: string) {
  if (!activeProject) return;
  setActiveProject({
    ...activeProject,
    featureTypes: activeProject.featureTypes.filter((type) => type.id !== id),
  });
  setActiveFeatures((current) => current.map((feature) => {
    if (feature.featureTypeId !== id) return feature;
    return { ...feature, featureTypeId: undefined };
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

async function handleDeleteFeature(
  feature: Feature
) {
  if (!activeMap) {
    return;
  }

  const confirmed = window.confirm(
    feature.targetMapId &&
      feature.targetFeatureId
      ? `Delete Location "${feature.name}" and its paired Location?`
      : `Delete Feature "${feature.name}"?`
  );

  if (!confirmed) {
    return;
  }

  const now = new Date();

  // Ordinary Feature: only remove this Feature.
  if (
    !feature.targetMapId ||
    !feature.targetFeatureId
  ) {
    setActiveFeatures((current) =>
      current.filter(
        (candidate) =>
          candidate.id !== feature.id
      )
    );

    setActiveMap({
      ...activeMap,
      featureIds:
        activeMap.featureIds.filter(
          (featureId) =>
            featureId !== feature.id
        ),
      updatedAt: now,
    });

    setPendingFeatureDeletionIds(
      (current) => {
        const next =
          new Set(current);

        next.add(feature.id);

        return next;
      }
    );

    markProjectDirty();
    return;
  }

  const pairedFeatureId =
    feature.targetFeatureId;

  /*
   * Same-map Location.
   *
   * Both ends of the connection live in
   * activeFeatures / activeMap.
   */
  if (
    feature.targetMapId ===
    activeMap.id
  ) {
    setActiveFeatures((current) =>
      current.filter(
        (candidate) =>
          candidate.id !== feature.id &&
          candidate.id !==
            pairedFeatureId
      )
    );

    setActiveMap({
      ...activeMap,
      featureIds:
        activeMap.featureIds.filter(
          (featureId) =>
            featureId !== feature.id &&
            featureId !==
              pairedFeatureId
        ),
      updatedAt: now,
    });

    setPendingFeatureDeletionIds(
      (current) => {
        const next =
          new Set(current);

        next.add(feature.id);
        next.add(pairedFeatureId);

        return next;
      }
    );

    markProjectDirty();
    return;
  }

  /*
   * Different-map Location.
   *
   * Load the destination Map so its paired
   * return Feature can be removed from that
   * Map's featureIds.
   */
  try {
    const destinationMap =
      pendingMaps.find(
        (map) =>
          map.id ===
          feature.targetMapId
      ) ??
      await mapRepository.loadMap(
        feature.targetMapId
      );

    if (!destinationMap) {
      throw new Error(
        'The destination Map could not be found.'
      );
    }

    const updatedDestinationMap = {
      ...normalizeMap(
        destinationMap
      ),
      featureIds:
        destinationMap.featureIds.filter(
          (featureId) =>
            featureId !==
            pairedFeatureId
        ),
      updatedAt: now,
    };

    /*
     * Remove the visible/source Location
     * from the current Map.
     */
    setActiveFeatures((current) =>
      current.filter(
        (candidate) =>
          candidate.id !== feature.id
      )
    );

    setActiveMap({
      ...activeMap,
      featureIds:
        activeMap.featureIds.filter(
          (featureId) =>
            featureId !== feature.id
        ),
      updatedAt: now,
    });

    /*
     * Stage the modified destination Map.
     * Replacing an existing pending version
     * prevents duplicate pending Maps.
     */
    setPendingMaps((current) => [
      ...current.filter(
        (map) =>
          map.id !==
          updatedDestinationMap.id
      ),
      updatedDestinationMap,
    ]);

    /*
     * If either Location was newly created
     * and hasn't been saved yet, remove it
     * from pendingFeatures as well.
     */
    const pendingFeatureIds =
  new Set(
    pendingFeatures.map(
      (candidate) =>
        candidate.id
    )
  );

setPendingFeatures((current) =>
  current.filter(
    (candidate) =>
      candidate.id !== feature.id &&
      candidate.id !==
        pairedFeatureId
  )
);

setPendingFeatureDeletionIds(
  (current) => {
    const next =
      new Set(current);

    if (
      !pendingFeatureIds.has(
        feature.id
      )
    ) {
      next.add(feature.id);
    }

    if (
      !pendingFeatureIds.has(
        pairedFeatureId
      )
    ) {
      next.add(
        pairedFeatureId
      );
    }

    return next;
  }
);

    markProjectDirty();
  } catch (error) {
    console.error(
      'Unable to delete Location:',
      error
    );

    setNavigationError(
      'Unable to delete this Location.'
    );
  }
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
  setNewLocationTypeId('');
  setNewLocationImage(null);
  setLocationSearch('');
  setLocationTypeFilter('all');
  setShowLocationChoiceDialog(true);
}

function closeLocationDialogs() {
  setShowLocationChoiceDialog(false);
  setShowNewLocationDialog(false);
  setShowExistingLocationDialog(false);
  setNewLocationPosition(null);
}

function createLocationPair(
  destinationMap: RegionMap,
  sourceName: string
) {
  if (!activeProject || !activeMap || !newLocationPosition) return;
  const featureAId = crypto.randomUUID();
  const featureBId = crypto.randomUUID();
  const sourceFeature: Feature = {
    id: featureAId,
    name: sourceName,
    position: newLocationPosition,
    type: 'location',
    noteLinks: [],
    targetMapId: destinationMap.id,
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

  return { sourceFeature, returnFeature };
}

async function handleCreateLocation() {
  if (!activeProject || !activeMap || !newLocationPosition) return;

  const name = newLocationName.trim();
  if (!name) return;

  const now = new Date();
  const childMap = createDefaultMap({
    id: crypto.randomUUID(),
    now,
    parentMapId: activeMap.id,
  });
  childMap.name = name;
  childMap.featureTypeId = newLocationTypeId || undefined;

  if (newLocationImage) {
    const image = await hostedMapImageService.importLocalFile(
      newLocationImage
    );
    childMap.imageFileId = image.id;
  }

  const pair = createLocationPair(childMap, name);
  if (!pair) return;

  childMap.featureIds = [pair.returnFeature.id];

  setActiveFeatures((current) => [...current, pair.sourceFeature]);
  setActiveMap({
    ...activeMap,
    featureIds: [...activeMap.featureIds, pair.sourceFeature.id],
    updatedAt: now,
  });
  setActiveProject({
    ...activeProject,
    mapIds: [...activeProject.mapIds, childMap.id],
    updatedAt: now,
  });
  setPendingMaps((current) => [...current, childMap]);
  setPendingFeatures((current) => [...current, pair.returnFeature]);

  markProjectDirty();
  closeLocationDialogs();
  setNewLocationName('');
}

function handleCreateExistingLocation(destinationMap: RegionMap) {
  if (!activeProject || !activeMap || !newLocationPosition) return;

  const now = new Date();
  const pair = createLocationPair(destinationMap, destinationMap.name);
  if (!pair) return;

  if (destinationMap.id === activeMap.id) {
    setActiveFeatures((current) => [
      ...current,
      pair.sourceFeature,
      pair.returnFeature,
    ]);
    setActiveMap({
      ...activeMap,
      featureIds: [
        ...activeMap.featureIds,
        pair.sourceFeature.id,
        pair.returnFeature.id,
      ],
      updatedAt: now,
    });
  } else {
    const updatedDestination = {
      ...destinationMap,
      featureIds: [...destinationMap.featureIds, pair.returnFeature.id],
      updatedAt: now,
    };
    setActiveFeatures((current) => [...current, pair.sourceFeature]);
    setActiveMap({
      ...activeMap,
      featureIds: [...activeMap.featureIds, pair.sourceFeature.id],
      updatedAt: now,
    });
    setPendingMaps((current) => [
      ...current.filter((map) => map.id !== updatedDestination.id),
      updatedDestination,
    ]);
    setPendingFeatures((current) => [
      ...current,
      pair.returnFeature,
    ]);
  }

  markProjectDirty();
  closeLocationDialogs();
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

const goToMapMaps = projectMaps.map((map) => {
  return map.id === activeMap?.id ? activeMap : map;
});
const selectedGoToMap = goToMapMaps.find((map) => {
  return map.id === selectedGoToMapId;
}) ?? null;
const selectedGoToMapType = activeProject?.featureTypes.find((type) => {
  return type.id === selectedGoToMap?.featureTypeId;
})?.name ?? 'No Type';

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
  onGoToMap={handleOpenGoToMap}
  onGoToParentMap={handleGoToParentMap}
  onAssignMapImage={() => assignMapInputRef.current?.click()}
  autoSave={autoSave}
  onAutoSaveChange={setAutoSave}
  onManageFeatureTypes={() => setShowFeatureTypesDialog(true)}
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

{showGoToMapDialog && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog go-to-map-dialog">
      <h2>Go to Map</h2>

      <div className="go-to-map-layout">
        <div className="go-to-map-browser">
          <input
            type="search"
            placeholder="Search Maps"
            value={goToMapSearch}
            onChange={(event) => setGoToMapSearch(event.target.value)}
            autoFocus
          />

          <select
            value={goToMapTypeFilter}
            onChange={(event) => {
              setGoToMapTypeFilter(event.target.value);
            }}
          >
            <option value="all">All Types</option>
            <option value="none">No Type</option>
            {activeProject.featureTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>

          <div className="go-to-map-list">
            {goToMapMaps
              .filter((map) => {
                const search = goToMapSearch.trim().toLocaleLowerCase();
                const matchesSearch = map.name
                  .toLocaleLowerCase()
                  .includes(search);
                const matchesType = goToMapTypeFilter === 'all' ||
                  (goToMapTypeFilter === 'none' && !map.featureTypeId) ||
                  map.featureTypeId === goToMapTypeFilter;
                return matchesSearch && matchesType;
              })
              .sort((left, right) => left.name.localeCompare(right.name))
              .map((map) => {
                const typeName = activeProject.featureTypes.find((type) => {
                  return type.id === map.featureTypeId;
                })?.name ?? 'No Type';
                const className = [
                  'go-to-map-item',
                  map.id === selectedGoToMapId ? 'selected' : '',
                  map.id === activeMap?.id ? 'current' : '',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={map.id}
                    type="button"
                    className={className}
                    onClick={() => selectGoToMap(map)}
                  >
                    <span>{map.name}</span>
                    <small>{typeName}</small>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="go-to-map-preview">
          <div className="go-to-map-preview-image">
            {goToMapPreviewUrl ? (
              <img src={goToMapPreviewUrl} alt="" />
            ) : (
              <span>No Map Image</span>
            )}
          </div>

          <strong>{selectedGoToMap?.name ?? 'Select a Map'}</strong>
          {selectedGoToMap && (
            <span>Type: {selectedGoToMapType}</span>
          )}
        </div>
      </div>

      <div className="dialog-buttons">
        <button type="button" onClick={closeGoToMapDialog}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedGoToMap}
          onClick={() => void handleConfirmGoToMap()}
        >
          Go
        </button>
      </div>
    </div>
  </div>
)}

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

{showFeatureTypesDialog && activeProject && (
  <FeatureTypesDialog
    featureTypes={activeProject.featureTypes}
    onAdd={handleAddFeatureType}
    onRename={handleRenameFeatureType}
    onDelete={handleDeleteFeatureType}
    onClose={() => setShowFeatureTypesDialog(false)}
  />
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

{showLocationChoiceDialog && (
  <div className="dialog-backdrop">
    <div className="dialog location-choice-dialog">
      <h2>New Location</h2>

      <p>Choose a new or existing destination Map.</p>

      <div className="location-choice-buttons">
        <button
          type="button"
          onClick={() => {
            setShowLocationChoiceDialog(false);
            setShowNewLocationDialog(true);
          }}
        >
          New...
        </button>

        <button
          type="button"
          onClick={() => {
            setShowLocationChoiceDialog(false);
            setShowExistingLocationDialog(true);
          }}
        >
          Existing...
        </button>
      </div>

      <div className="dialog-buttons">
        <button type="button" onClick={closeLocationDialogs}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

{showNewLocationDialog && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog location-editor-dialog">
      <h2>New Location Map</h2>

      <input
        type="text"
        placeholder="Map name"
        value={newLocationName}
        onChange={(event) => {
          setNewLocationName(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleCreateLocation();
        }}
        autoFocus
      />

      <label>
        Type
        <select
          value={newLocationTypeId}
          onChange={(event) => {
            setNewLocationTypeId(event.target.value);
          }}
        >
          <option value="">No Type</option>
          {activeProject.featureTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Map Image (optional)
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            setNewLocationImage(event.target.files?.[0] ?? null);
          }}
        />
      </label>

      <div className="dialog-buttons">
        <button
          type="button"
          onClick={closeLocationDialogs}
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!newLocationName.trim()}
          onClick={() => void handleCreateLocation()}
        >
          Create
        </button>
      </div>
    </div>
  </div>
)}

{showExistingLocationDialog && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog existing-location-dialog">
      <h2>Existing Location</h2>

      <div className="location-map-filters">
        <input
          type="search"
          placeholder="Search Maps"
          value={locationSearch}
          onChange={(event) => setLocationSearch(event.target.value)}
          autoFocus
        />

        <select
          value={locationTypeFilter}
          onChange={(event) => {
            setLocationTypeFilter(event.target.value);
          }}
        >
          <option value="all">All Types</option>
          <option value="none">No Type</option>
          {activeProject.featureTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className="location-map-list">
        {projectMaps
          .filter((map) => {
            const matchesName = map.name.toLocaleLowerCase().includes(
              locationSearch.trim().toLocaleLowerCase()
            );
            const matchesType = locationTypeFilter === 'all' ||
              (locationTypeFilter === 'none' && !map.featureTypeId) ||
              map.featureTypeId === locationTypeFilter;
            return matchesName && matchesType;
          })
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((map) => {
            const typeName = activeProject.featureTypes.find((type) => {
              return type.id === map.featureTypeId;
            })?.name ?? 'No Type';

            return (
              <button
                key={map.id}
                type="button"
                className="location-map-item"
                onClick={() => handleCreateExistingLocation(map)}
              >
                <span>{map.name}</span>
                <small>{typeName}</small>
              </button>
            );
          })}

        {projectMaps.length === 0 && (
          <p>No Maps found.</p>
        )}
      </div>

      <div className="dialog-buttons">
        <button type="button" onClick={closeLocationDialogs}>
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
        mapTypeId={activeMap.featureTypeId}
        imageRegistration={activeMap.imageRegistration}
        features={activeFeatures}
        featureTypes={activeProject.featureTypes}
        locationMapMetadata={locationMapMetadata}
        onMapMetadataChange={handleMapMetadataChange}
        focusFeatureId={pendingFocusFeatureId}
        onFocusFeatureComplete={() => setPendingFocusFeatureId(null)}
        onEnterFeature={(feature) => void handleEnterFeature(feature)}
        onFeatureNameChange={handleFeatureNameChange}
        onSubtitleChange={handleSubtitleChange}
        onDescriptionChange={handleDescriptionChange}
        onShowLabelChange={handleShowLabelChange}
        onFeatureTypeChange={handleFeatureTypeChange}
        onFeatureMove={handleFeatureMove}
        onDeleteFeature={handleDeleteFeature}
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
