import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
  MapViewportHandle,
} from './components/MapViewport';
import FeatureTypesDialog from './components/FeatureTypesDialog';
import type { Project } from './models/Project';
import type { Map as RegionMap } from './models/Map';
import type { Feature } from './models/Feature';
import type { RichTextDocument } from './models/RichText';
import type { FeatureTypeDefinition } from './models/FeatureTypeDefinition';
import type { Piece, PieceShape } from './models/Piece';
import {
  DEFAULT_REGIONS_SETTINGS,
  regionsSettingsRepository,
  type RegionsSettings,
} from './settings/RegionsSettingsRepository';
import type {
  Section,
  SectionEdge,
  SectionKind,
  SectionNode,
} from './models/Section';
import { featureRepository } from './features/FeatureRepository';
import { sectionRepository } from './sections/SectionRepository';
import { sectionEdgeRepository } from './sections/SectionEdgeRepository';
import { sectionNodeRepository } from './sections/SectionNodeRepository';
import {
  getSectionPolygon,
  isPointInPolygon,
} from './sections/SectionGeometry';

import { mapRepository} from './maps/MapRepository';
import { createDefaultMap } from './maps/DefaultMap';
import {
  ensureValidPieceFocus,
  projectRepository,
} from './projects/ProjectRepository';;
import {
  hostedMapImageService,
} from './services/maps/HostedMapImageService';
import { useRegionsState } from './state/RegionsStateContext';

type ProjectActionOutcome = 'unchanged' | 'saved' | 'discarded';
type SpatialNavigationSource =
  | 'manual'
  | 'go-to-map'
  | 'piece'
  | 'piece-focus';

interface IncomingLocationReference {
  mapId: string;
  feature: Feature;
}

interface MapDeletionAnalysis {
  map: RegionMap;
  isWorldRoot: boolean;
  childMaps: RegionMap[];
  pieces: Piece[];
  incomingLocations: IncomingLocationReference[];
  ownedFeatureCount: number;
}

type NavigationFeatureKind = 'location' | 'connection';
type ArrivalMode =
  | 'manual-placement'
  | 'connection'
  | 'legacy-location'
  | 'migration';

interface PendingArrivalIntent {
  mode: ArrivalMode;
  pieceId?: string;
  sourceMapId: string;
  sourceMapName: string;
  sourcePosition?: Feature['position'];
  destinationMapId: string;
  sourceFeatureId?: string;
  destinationFeatureId?: string;
}

function App() {
  const { dispatch } = useRegionsState();
  const mapViewportRef = useRef<MapViewportHandle | null>(null);
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
  const [activeSections, setActiveSections] = useState<Section[]>([]);
  const [activeSectionNodes, setActiveSectionNodes] =
    useState<SectionNode[]>([]);
  const [activeSectionEdges, setActiveSectionEdges] =
    useState<SectionEdge[]>([]);
  const [sectionMode, setSectionMode] = useState<SectionKind | null>(null);
  const [deletedSectionIds, setDeletedSectionIds] =
    useState<Set<string>>(() => new Set());
  const [deletedSectionNodeIds, setDeletedSectionNodeIds] =
    useState<Set<string>>(() => new Set());
  const [deletedSectionEdgeIds, setDeletedSectionEdgeIds] =
    useState<Set<string>>(() => new Set());

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

const [regionsSettings, setRegionsSettings] = useState<RegionsSettings>(
  DEFAULT_REGIONS_SETTINGS
);
const [showSettingsDialog, setShowSettingsDialog] = useState(false);
const [settingsDraft, setSettingsDraft] = useState<RegionsSettings>(
  DEFAULT_REGIONS_SETTINGS
);
const autoSave = regionsSettings.autosaveEnabled;

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

  const [selectedExistingMapId, setSelectedExistingMapId] =
    useState<string | null>(null);

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
  const [navigationFeatureKind, setNavigationFeatureKind] =
    useState<NavigationFeatureKind>('location');
  const [newConnectionName, setNewConnectionName] = useState('');
  const [pendingArrival, setPendingArrival] =
    useState<PendingArrivalIntent | null>(null);

  const [pendingMaps, setPendingMaps] = useState<RegionMap[]>([]);

  const [pendingFeatures, setPendingFeatures] =
    useState<Feature[]>([]);

  const [pendingMapDeletionIds, setPendingMapDeletionIds] =
    useState<Set<string>>(() => new Set());

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

  const [viewportCenter, setViewportCenter] =
    useState({ x: 0, y: 0 });

  const [focusPiecePosition, setFocusPiecePosition] =
    useState<{ x: number; y: number } | null>(null);

  const [focusPieceRequestId, setFocusPieceRequestId] = useState(0);

  const [editingPieceId, setEditingPieceId] =
    useState<string | null>(null);

  const [pieceNameDraft, setPieceNameDraft] = useState('');
  const [pieceShapeDraft, setPieceShapeDraft] =
    useState<PieceShape>('circle');
  const [pieceFillDraft, setPieceFillDraft] = useState('#e4e4e4');
  const [pieceBorderDraft, setPieceBorderDraft] = useState('#222222');
  const [pieceToDelete, setPieceToDelete] = useState<Piece | null>(null);
  const [showGoToPieceDialog, setShowGoToPieceDialog] = useState(false);
  const [showMigratePieceDialog, setShowMigratePieceDialog] =
    useState(false);
  const [pieceSearch, setPieceSearch] = useState('');
  const [selectedPieceId, setSelectedPieceId] =
    useState<string | null>(null);

  const [showDeleteMapDialog, setShowDeleteMapDialog] = useState(false);
  const [deleteMapSearch, setDeleteMapSearch] = useState('');
  const [deleteMapTypeFilter, setDeleteMapTypeFilter] = useState('all');
  const [selectedDeleteMapId, setSelectedDeleteMapId] =
    useState<string | null>(null);
  const [confirmDeleteMap, setConfirmDeleteMap] = useState(false);
  const [showDeleteMapBlocker, setShowDeleteMapBlocker] = useState(false);
  const [mapDeletionAnalysis, setMapDeletionAnalysis] =
    useState<MapDeletionAnalysis | null>(null);
  const deleteMapAnalysisRunIdRef = useRef(0);
  const [mapToMakeRoot, setMapToMakeRoot] =
    useState<RegionMap | null>(null);

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
    if (!navigationError) return;
    const timeoutId = window.setTimeout(() => {
      setNavigationError(null);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [navigationError]);

  useEffect(() => {
    if (!activeProjectId) return;

    dispatch({
      type: 'map.activate',
      mapId: activeMapId,
    });
  }, [activeMapId, activeProjectId, dispatch]);

  useEffect(() => {
    void regionsSettingsRepository.load()
      .then((settings) => {
        setRegionsSettings(settings);
        setSettingsDraft(settings);
      })
      .catch((error) => {
        console.error('Unable to load Regions settings:', error);
      });
  }, []);

  useLayoutEffect(() => {
    mapViewportRef.current?.cancelInteractions();
    setSectionMode(null);
  // Active Map identity is the sole authority for this cleanup.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapId]);

  useEffect(() => {
    let cancelled = false;
    const map = activeMap;

    async function loadSections() {
      await Promise.resolve();
      if (cancelled) return;
      setActiveSections([]);
      setActiveSectionNodes([]);
      setActiveSectionEdges([]);
      if (!map) return;
      const sections = await sectionRepository.loadSections(
        map.sectionIds ?? []
      );
      const sectionsById = new Map(sections.map((section) => {
        return [section.id, section];
      }));
      const orderedSections = (map.sectionIds ?? [])
        .map((id) => sectionsById.get(id))
        .filter((section): section is Section => Boolean(section));
      let boundaryFound = false;
      const normalizedSections = orderedSections.filter((section) => {
        if (section.kind !== 'boundary') return true;
        const valid = section.mapId === map.id &&
          section.edgeIds.length >= 3;
        if (!valid || boundaryFound) return false;
        boundaryFound = true;
        return true;
      });
      const removedSections = orderedSections.filter((section) => {
        return !normalizedSections.includes(section);
      });
      const edgeIds = normalizedSections.flatMap((section) => {
        return section.edgeIds;
      });
      const edges = await sectionEdgeRepository.loadEdges(edgeIds);
      const nodeIds = Array.from(new Set(edges.flatMap((edge) => {
        return [edge.startNodeId, edge.endNodeId];
      })));
      const nodes = await sectionNodeRepository.loadNodes(nodeIds);
      if (cancelled) return;
      setActiveSections(normalizedSections);
      setActiveSectionEdges(edges);
      setActiveSectionNodes(nodes);
      if (removedSections.length > 0) {
        setDeletedSectionIds((current) => new Set([
          ...current,
          ...removedSections.map((section) => section.id),
        ]));
        setActiveMap({
          ...map,
          sectionIds: normalizedSections.map((section) => section.id),
        });
        markProjectDirty();
      }
    }

    void loadSections().catch((error) => {
      if (!cancelled) console.error('Unable to load Sections:', error);
    });
    return () => {
      cancelled = true;
    };
  // Section IDs change locally after creation; reload only on Map identity.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMap?.id]);

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
        if (pendingMapDeletionIds.has(mapId)) return [];
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
  }, [activeProject, pendingMapDeletionIds, pendingMaps]);

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

function handleSectionModeChange(mode: SectionKind | null) {
  mapViewportRef.current?.cancelInteractions();
  setSectionMode(mode);
}

function resetProjectDirty() {
  dirtyGenerationRef.current += 1;
  setProjectDirty(false);
}

function openNewProjectDialog() {
  mapViewportRef.current?.cancelInteractions();
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

      pieces: [],

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
      setDeletedSectionIds(new Set());
      setDeletedSectionNodeIds(new Set());
      setDeletedSectionEdgeIds(new Set());
      setSectionMode(null);
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
  mapViewportRef.current?.cancelInteractions();
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
  const sectionIds = Array.isArray(map.sectionIds) ? map.sectionIds : [];
  const normalized = { ...map, featureIds, sectionIds };

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

function getMapArrivalCenter(map: RegionMap): Feature['position'] {
  return {
    x: map.imageRegistration?.offsetX ?? 0,
    y: map.imageRegistration?.offsetY ?? 0,
  };
}

async function loadEffectiveMapWithFeatures(mapId: string) {
  const effectiveMap = activeMap?.id === mapId
    ? activeMap
    : pendingMaps.find((map) => map.id === mapId) ??
      projectMaps.find((map) => map.id === mapId);
  if (!effectiveMap) return loadMapWithFeatures(mapId);
  return {
    map: normalizeMap(effectiveMap),
    features: await loadEffectiveMapFeatures(effectiveMap),
  };
}

function findParentLocation(childMap: RegionMap, features: Feature[]) {
  const byId = childMap.parentLocationId
    ? features.find((feature) => {
        return feature.id === childMap.parentLocationId;
      })
    : undefined;
  const validById = byId?.type === 'location' &&
    byId.targetMapId === childMap.id
    ? byId
    : undefined;
  return validById ?? features.find((feature) => {
    return feature.type === 'location' && feature.targetMapId === childMap.id;
  });
}

async function resolveParentLocation(childMap: RegionMap) {
  if (!childMap.parentMapId) return null;
  const parent = await loadEffectiveMapWithFeatures(childMap.parentMapId);
  const parentLocation = findParentLocation(childMap, parent.features);
  if (!parentLocation) return null;
  return {
    parentMap: parent.map,
    parentFeatures: parent.features,
    parentLocation,
  };
}

async function commitPieceParentExit(
  piece: Piece,
  childMap: RegionMap,
  parent: NonNullable<Awaited<ReturnType<typeof resolveParentLocation>>>,
  follow: boolean
) {
  if (!activeProject) return;
  const movedPiece = {
    ...piece,
    mapId: parent.parentMap.id,
    position: parent.parentLocation.position,
  };
  const updatedProject = {
    ...activeProject,
    pieces: activeProject.pieces.map((item) => {
      return item.id === piece.id ? movedPiece : item;
    }),
    activeMapId: follow
      ? parent.parentMap.id
      : activeProject.activeMapId,
  };
  setActiveProject(updatedProject);
  markProjectDirty();
  handleMapEntered(
    parent.parentMap,
    updatedProject,
    childMap.name,
    'piece',
    piece.id
  );
  if (!follow) return;
  setActiveMap(parent.parentMap);
  setActiveFeatures(parent.parentFeatures);
  setPendingFocusFeatureId(parent.parentLocation.id);
  await loadMapImage(parent.parentMap);
  setFocusPiecePosition(parent.parentLocation.position);
  setFocusPieceRequestId((current) => current + 1);
}

function handleMapEntered(
  map: RegionMap,
  project: Project,
  parentMapName?: string,
  source: SpatialNavigationSource = 'manual',
  sourcePieceId?: string
) {
  if (project.pieces.length > 0) {
    const pieceNavigation = source === 'piece' ||
      source === 'piece-focus';
    if (!pieceNavigation) return;
    if (sourcePieceId !== project.focusedPieceId) return;
  }

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
  setPendingMapDeletionIds(new Set());
  setPendingFocusFeatureId(null);
  setPendingArrival(null);
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

    if (!feature.targetMapId ||
        (feature.type !== 'location' && feature.type !== 'connection')) {
      throw new Error('This Feature has no valid navigation target.');
    }

    const destination = discardChanges
      ? await loadMapWithFeatures(feature.targetMapId)
      : await loadEffectiveMapWithFeatures(feature.targetMapId);
    const targetFeature = feature.targetFeatureId
      ? destination.features.find((candidate) => {
          return candidate.id === feature.targetFeatureId;
        })
      : undefined;
    if (feature.targetFeatureId && !targetFeature) {
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
    setPendingFocusFeatureId(targetFeature?.connectionPlacementPending
      ? null
      : targetFeature?.id ?? null);
    await loadMapImage(destination.map);
    if (targetFeature?.connectionPlacementPending) {
      setFocusPiecePosition(getMapArrivalCenter(destination.map));
      setFocusPieceRequestId((current) => current + 1);
      setPendingArrival({
        mode: 'connection',
        sourceMapId,
        sourceMapName,
        destinationMapId: destination.map.id,
        sourceFeatureId: feature.id,
        destinationFeatureId: targetFeature.id,
      });
      return;
    }
    if (!targetFeature) {
      setFocusPiecePosition(getMapArrivalCenter(destination.map));
      setFocusPieceRequestId((current) => current + 1);
    }
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
  if (!feature.targetMapId ||
      (feature.type !== 'location' && feature.type !== 'connection')) return;
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

async function navigateToParentMap(discardChanges: boolean) {
  if (!activeProject || !activeMap?.parentMapId) return;
  let project = activeProject;
  let sourceMap = activeMap;
  if (discardChanges) {
    const restored = await restorePersistedSource(activeProject.id, activeMap.id);
    project = restored.project;
    sourceMap = restored.map;
  }
  if (!sourceMap.parentMapId) return;
  const containedParent = discardChanges
    ? null
    : await resolveParentLocation(sourceMap);
  const destination = containedParent
    ? {
        map: containedParent.parentMap,
        features: containedParent.parentFeatures,
      }
    : discardChanges
      ? await loadMapWithFeatures(sourceMap.parentMapId)
      : await loadEffectiveMapWithFeatures(sourceMap.parentMapId);
  const parentLocation = containedParent?.parentLocation ??
    findParentLocation(sourceMap, destination.features);
  const updatedProject = { ...project, activeMapId: destination.map.id };
  dispatch({
    type: 'navigation.push',
    entry: { mapId: sourceMap.id },
  });
  setActiveProject(updatedProject);
  setActiveMap(destination.map);
  setActiveFeatures(destination.features);
  setPendingFocusFeatureId(parentLocation?.id ?? null);
  await loadMapImage(destination.map);
  const focusPosition = parentLocation?.position ??
    getMapArrivalCenter(destination.map);
  setFocusPiecePosition(focusPosition);
  setFocusPieceRequestId((current) => current + 1);
  handleMapEntered(destination.map, updatedProject, sourceMap.name, 'manual');
}

async function handleGoToParentMap() {
  if (!activeMap?.parentMapId) return;
  if (projectDirty && !autoSave) {
    requestProjectAction((outcome) => {
      void navigateToParentMap(outcome === 'discarded');
    });
    return;
  }
  if (projectDirty || saveInProgressRef.current) {
    const saved = await saveActiveProject();
    if (!saved) return;
  }
  await navigateToParentMap(false);
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
  mapViewportRef.current?.cancelInteractions();
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
  let sourceMapName = activeMap.name;

  try {
    if (discardChanges) {
  const source = await restorePersistedSource(
    activeProject.id,
    activeMap.id
  );

  project = source.project;
  sourceMapName = source.map.name;
}

    const destination = await loadMapWithFeatures(mapId);
    setActiveProject({ ...project, activeMapId: destination.map.id });
    setActiveMap(destination.map);
    setActiveFeatures(destination.features);
    setPendingFocusFeatureId(null);
    await loadMapImage(destination.map);
    handleMapEntered(destination.map, project, sourceMapName, 'go-to-map');
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

function getNextPieceName(pieces: Piece[]): string {
  const names = new Set(pieces.map((piece) => piece.name));
  if (!names.has('Piece')) return 'Piece';
  let suffix = 2;
  while (names.has(`Piece ${suffix}`)) suffix += 1;
  return `Piece ${suffix}`;
}

function handleAddPiece() {
  if (!activeProject || !activeMap || !activeMapImageUrl) return;

  const piece: Piece = {
    id: crypto.randomUUID(),
    kind: 'piece',
    name: getNextPieceName(activeProject.pieces),
    mapId: activeMap.id,
    tracked: true,
    position: viewportCenter,
    appearance: {
      shape: 'circle',
      fillColor: '#e4e4e4',
      borderColor: '#222222',
    },
  };
  setActiveProject({
    ...activeProject,
    pieces: [...activeProject.pieces, piece],
    focusedPieceId: ensureValidPieceFocus(
      [...activeProject.pieces, piece],
      activeProject.focusedPieceId
    ),
  });
  markProjectDirty();
}

function openPieceBrowser(mode: 'go' | 'migrate') {
  if (!activeProject) return;
  mapViewportRef.current?.cancelInteractions();
  setPieceSearch('');
  setSelectedPieceId(activeProject.pieces[0]?.id ?? null);
  setShowGoToPieceDialog(mode === 'go');
  setShowMigratePieceDialog(mode === 'migrate');
}

function closePieceBrowsers() {
  setShowGoToPieceDialog(false);
  setShowMigratePieceDialog(false);
  setSelectedPieceId(null);
}

async function goToPiece(pieceId: string, discardChanges: boolean) {
  if (!activeProject || !activeMap) return;
  let project = activeProject;
  try {
    if (discardChanges) {
      const source = await restorePersistedSource(
        activeProject.id,
        activeMap.id
      );
      project = source.project;
    }
    const piece = project.pieces.find((item) => item.id === pieceId);
    if (!piece) throw new Error('The selected Piece was not found.');
    if (activeMap?.id !== piece.mapId) {
      const destination = await loadMapWithFeatures(piece.mapId);
      setActiveProject({ ...project, activeMapId: piece.mapId });
      setActiveMap(destination.map);
      setActiveFeatures(destination.features);
      setPendingFocusFeatureId(null);
      await loadMapImage(destination.map);
    }
    setFocusPiecePosition(piece.position);
    setFocusPieceRequestId((current) => current + 1);
    closePieceBrowsers();
  } catch (error) {
    console.error('Unable to go to Piece:', error);
    setNavigationError('Unable to go to this Piece.');
  }
}

async function handleGoToPiece() {
  if (!activeProject || !activeMap || !selectedPieceId) return;
  const piece = activeProject.pieces.find((item) => {
    return item.id === selectedPieceId;
  });
  if (!piece) return;
  if (piece.mapId === activeMap.id) {
    setFocusPiecePosition(piece.position);
    setFocusPieceRequestId((current) => current + 1);
    closePieceBrowsers();
    return;
  }
  const pieceId = piece.id;
  if (projectDirty && !autoSave) {
    requestProjectAction((outcome) => {
      void goToPiece(pieceId, outcome === 'discarded');
    });
    return;
  }
  if (projectDirty || saveInProgressRef.current) {
    const saved = await saveActiveProject();
    if (!saved) return;
  }
  await goToPiece(pieceId, false);
}

function handleBeginPieceMigration() {
  if (!activeProject || !activeMap || !selectedPieceId) return;
  const piece = activeProject.pieces.find((item) => {
    return item.id === selectedPieceId;
  });
  if (!piece) return;
  const sourceMapName = projectMaps.find((map) => {
    return map.id === piece.mapId;
  })?.name ?? 'Unknown Map';
  setPendingArrival({
    mode: 'migration',
    pieceId: piece.id,
    sourceMapId: piece.mapId,
    sourceMapName,
    sourcePosition: piece.position,
    destinationMapId: activeMap.id,
  });
  closePieceBrowsers();
}

function handlePieceTrackedChange(pieceId: string, tracked: boolean) {
  if (!activeProject) return;
  setActiveProject({
    ...activeProject,
    pieces: activeProject.pieces.map((piece) => {
      return piece.id === pieceId ? { ...piece, tracked } : piece;
    }),
  });
  markProjectDirty();
}

function openSettingsDialog() {
  setSettingsDraft(regionsSettings);
  setShowSettingsDialog(true);
}

async function saveSettings() {
  try {
    await regionsSettingsRepository.save(settingsDraft);
    setRegionsSettings(settingsDraft);
    setShowSettingsDialog(false);
  } catch (error) {
    console.error('Unable to save Regions settings:', error);
    setNavigationError('Unable to save Regions settings.');
  }
}

function updatePiecePosition(pieceId: string, position: Feature['position']) {
  if (!activeProject) return;
  setActiveProject({
    ...activeProject,
    pieces: activeProject.pieces.map((piece) => {
      return piece.id === pieceId ? { ...piece, position } : piece;
    }),
  });
  markProjectDirty();
}

async function handlePieceDrop(
  pieceId: string,
  position: Feature['position'],
  location?: Feature
) {
  if (!activeProject || !activeMap) return;
  const piece = activeProject.pieces.find((item) => item.id === pieceId);
  if (!piece) return;

  const navigable = location?.type === 'location' ||
    location?.type === 'connection';
  if (!navigable || !location?.targetMapId) {
    const boundary = activeSections.find((section) => {
      return section.kind === 'boundary' && section.edgeIds.length >= 3;
    });
    const polygon = boundary
      ? getSectionPolygon(
          boundary,
          activeSectionEdges,
          activeSectionNodes
        )
      : [];
    const crossesBoundary = polygon.length >= 3 &&
      isPointInPolygon(piece.position, polygon) &&
      !isPointInPolygon(position, polygon);
    if (crossesBoundary && activeMap.parentMapId) {
      try {
        const parent = await resolveParentLocation(activeMap);
        if (!parent) {
          setNavigationError(
            'This Map has no valid parent Location for Boundary exit.'
          );
          return;
        }
        const focused = piece.id === activeProject.focusedPieceId;
        await commitPieceParentExit(piece, activeMap, parent, focused);
      } catch (error) {
        console.error('Unable to exit Boundary:', error);
        setNavigationError('Unable to exit this Map Boundary.');
      }
      return;
    }
    updatePiecePosition(pieceId, position);
    return;
  }

  try {
    const destination = await loadEffectiveMapWithFeatures(
      location.targetMapId
    );
    const targetFeature = location.targetFeatureId
      ? destination.features.find((feature) => {
          return feature.id === location.targetFeatureId;
        })
      : undefined;
    if (location.targetFeatureId && !targetFeature) {
      throw new Error('The target Feature could not be resolved.');
    }
    const isFocused = pieceId === activeProject.focusedPieceId;
    const needsManualPlacement = !targetFeature ||
      targetFeature.connectionPlacementPending;
    if (needsManualPlacement) {
      const updatedProject = {
        ...activeProject,
        activeMapId: destination.map.id,
      };
      setActiveProject(updatedProject);
      setActiveMap(destination.map);
      setActiveFeatures(destination.features);
      setPendingFocusFeatureId(null);
      await loadMapImage(destination.map);
      setFocusPiecePosition(getMapArrivalCenter(destination.map));
      setFocusPieceRequestId((current) => current + 1);
      setPendingArrival({
        mode: targetFeature ? 'connection' : 'manual-placement',
        pieceId,
        sourceMapId: activeMap.id,
        sourceMapName: activeMap.name,
        sourcePosition: piece.position,
        destinationMapId: destination.map.id,
        sourceFeatureId: location.id,
        destinationFeatureId: targetFeature?.id,
      });
      return;
    }

    const movedPiece = {
      ...piece,
      mapId: destination.map.id,
      position: targetFeature.position,
    };
    const updatedProject = {
      ...activeProject,
      pieces: activeProject.pieces.map((item) => {
        return item.id === pieceId ? movedPiece : item;
      }),
      activeMapId: isFocused
        ? destination.map.id
        : activeProject.activeMapId,
    };
    setActiveProject(updatedProject);
    markProjectDirty();

    if (!isFocused) return;
    setActiveMap(destination.map);
    setActiveFeatures(destination.features);
    setPendingFocusFeatureId(null);
    await loadMapImage(destination.map);
    setFocusPiecePosition(movedPiece.position);
    setFocusPieceRequestId((current) => current + 1);
    handleMapEntered(
      destination.map,
      updatedProject,
      activeMap.name,
      'piece',
      pieceId
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to move this Piece through the Location.';
    console.error('Unable to traverse Location with Piece:', error);
    setNavigationError(message);
  }
}

async function commitPendingArrival(position: Feature['position']) {
  if (!pendingArrival || !activeProject || !activeMap) return;
  if (pendingArrival.destinationFeatureId) {
    updateFeatureEverywhere(
      pendingArrival.destinationFeatureId,
      (feature) => ({
        ...feature,
        position,
        connectionPlacementPending: undefined,
      })
    );
  }
  let updatedProject = activeProject;
  if (pendingArrival.pieceId) {
    updatedProject = {
      ...activeProject,
      pieces: activeProject.pieces.map((piece) => {
        return piece.id === pendingArrival.pieceId
          ? { ...piece, mapId: activeMap.id, position }
          : piece;
      }),
      activeMapId: activeMap.id,
    };
    setActiveProject(updatedProject);
    setFocusPiecePosition(position);
    setFocusPieceRequestId((current) => current + 1);
  }
  setPendingArrival(null);
  markProjectDirty();
  const sameMapMigration = pendingArrival.mode === 'migration' &&
    pendingArrival.sourceMapId === activeMap.id;
  if (!sameMapMigration) {
    handleMapEntered(
      activeMap,
      updatedProject,
      pendingArrival.sourceMapName,
      pendingArrival.pieceId ? 'piece' : 'manual',
      pendingArrival.pieceId
    );
  }
}

async function cancelPendingArrival() {
  if (!pendingArrival || !activeProject) return;
  if (pendingArrival.mode === 'migration') {
    setPendingArrival(null);
    return;
  }
  try {
    const source = await loadEffectiveMapWithFeatures(
      pendingArrival.sourceMapId
    );
    setActiveProject({
      ...activeProject,
      activeMapId: source.map.id,
    });
    setActiveMap(source.map);
    setActiveFeatures(source.features);
    setPendingFocusFeatureId(pendingArrival.sourceFeatureId ?? null);
    setPendingArrival(null);
    await loadMapImage(source.map);
    if (pendingArrival.sourcePosition) {
      setFocusPiecePosition(pendingArrival.sourcePosition);
      setFocusPieceRequestId((current) => current + 1);
    }
  } catch (error) {
    console.error('Unable to cancel pending arrival:', error);
    setNavigationError('Unable to return to the source Map.');
  }
}

async function handleFocusPiece(pieceId: string | null) {
  if (!activeProject) return;
  if (pieceId === null) {
    return;
  }
  const piece = activeProject.pieces.find((item) => item.id === pieceId);
  if (!piece) return;

  const focusChanged = activeProject.focusedPieceId !== piece.id;
  const updatedProject = focusChanged
    ? { ...activeProject, focusedPieceId: piece.id }
    : activeProject;
  if (focusChanged) {
    setActiveProject(updatedProject);
    markProjectDirty();
  }

  try {
    let destinationMap = activeMap;
    if (activeMap?.id !== piece.mapId) {
      const destination = await loadMapWithFeatures(piece.mapId);
      destinationMap = destination.map;
      setActiveProject({ ...updatedProject, activeMapId: piece.mapId });
      setActiveMap(destination.map);
      setActiveFeatures(destination.features);
      setPendingFocusFeatureId(null);
      await loadMapImage(destination.map);
    }

    if (!destinationMap) return;
    setFocusPiecePosition(piece.position);
    setFocusPieceRequestId((current) => current + 1);
    if (focusChanged) {
      handleMapEntered(
        destinationMap,
        updatedProject,
        undefined,
        'piece-focus',
        piece.id
      );
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unable to focus this Piece.';
    console.error('Unable to focus Piece:', error);
    setNavigationError(message);
  }
}

function handleEditPiece(piece: Piece) {
  mapViewportRef.current?.cancelInteractions();
  setEditingPieceId(piece.id);
  setPieceNameDraft(piece.name);
  setPieceShapeDraft(piece.appearance.shape);
  setPieceFillDraft(piece.appearance.fillColor);
  setPieceBorderDraft(piece.appearance.borderColor);
}

function handleSavePiece() {
  if (!activeProject || !editingPieceId) return;
  const name = pieceNameDraft.trim();
  if (!name) return;
  setActiveProject({
    ...activeProject,
    pieces: activeProject.pieces.map((piece) => {
      return piece.id === editingPieceId
        ? {
            ...piece,
            name,
            appearance: {
              shape: pieceShapeDraft,
              fillColor: pieceFillDraft,
              borderColor: pieceBorderDraft,
            },
          }
        : piece;
    }),
  });
  setEditingPieceId(null);
  markProjectDirty();
}

function handleDeletePiece() {
  if (!activeProject || !pieceToDelete) return;
  const pieces = activeProject.pieces.filter((piece) => {
    return piece.id !== pieceToDelete.id;
  });
  setActiveProject({
    ...activeProject,
    pieces,
    focusedPieceId: ensureValidPieceFocus(
      pieces,
      activeProject.focusedPieceId
    ),
  });
  setPieceToDelete(null);
  markProjectDirty();
}

async function loadEffectiveMapFeatures(map: RegionMap): Promise<Feature[]> {
  if (map.id === activeMap?.id) return activeFeatures;
  const storedFeatures = await featureRepository.loadFeatures(map.featureIds);
  const storedById = new Map(
    storedFeatures.map((feature) => [feature.id, feature])
  );
  const pendingById = new Map(
    pendingFeatures.map((feature) => [feature.id, feature])
  );
  return map.featureIds
    .map((featureId) => {
      return pendingById.get(featureId) ?? storedById.get(featureId);
    })
    .filter((feature): feature is Feature => Boolean(feature))
    .filter((feature) => !pendingFeatureDeletionIds.has(feature.id));
}

async function analyzeMapDeletion(
  map: RegionMap
): Promise<MapDeletionAnalysis | null> {
  if (!activeProject) return null;
  const runId = ++deleteMapAnalysisRunIdRef.current;
  const childMaps = projectMaps.filter((candidate) => {
    return candidate.parentMapId === map.id;
  });
  const pieces = activeProject.pieces.filter((piece) => {
    return piece.mapId === map.id;
  });
  const deletedFeatureIds = new Set(map.featureIds);
  const incomingLocations: IncomingLocationReference[] = [];

  await Promise.all(projectMaps.map(async (ownerMap) => {
    if (ownerMap.id === map.id) return;
    const features = await loadEffectiveMapFeatures(ownerMap);
    features.forEach((feature) => {
      const targetsMap = feature.targetMapId === map.id;
      const targetsOwnedFeature = Boolean(
        feature.targetFeatureId &&
        deletedFeatureIds.has(feature.targetFeatureId)
      );
      if (!targetsMap && !targetsOwnedFeature) return;
      incomingLocations.push({ mapId: ownerMap.id, feature });
    });
  }));

  if (runId !== deleteMapAnalysisRunIdRef.current) return null;
  const analysis: MapDeletionAnalysis = {
    map,
    isWorldRoot: activeProject.rootMapId === map.id,
    childMaps,
    pieces,
    incomingLocations,
    ownedFeatureCount: map.featureIds.length,
  };
  setMapDeletionAnalysis(analysis);
  return analysis;
}

function selectDeleteMap(map: RegionMap) {
  setSelectedDeleteMapId(map.id);
  setConfirmDeleteMap(false);
  setShowDeleteMapBlocker(false);
  setMapDeletionAnalysis(null);
  void loadGoToMapPreview(map);
  void analyzeMapDeletion(map).catch((error) => {
    console.error('Unable to analyze Map deletion:', error);
  });
}

function handleOpenDeleteMap() {
  if (!activeProject || !activeMap) return;
  mapViewportRef.current?.cancelInteractions();
  setDeleteMapSearch('');
  setDeleteMapTypeFilter('all');
  setShowDeleteMapDialog(true);
  selectDeleteMap(activeMap);
}

function closeDeleteMapDialog() {
  deleteMapAnalysisRunIdRef.current += 1;
  clearGoToMapPreview();
  setShowDeleteMapDialog(false);
  setSelectedDeleteMapId(null);
  setMapDeletionAnalysis(null);
  setConfirmDeleteMap(false);
  setShowDeleteMapBlocker(false);
}

async function handleDeleteMapRequest() {
  if (!selectedDeleteMap) return;
  const currentAnalysis = mapDeletionAnalysis?.map.id === selectedDeleteMap.id
    ? mapDeletionAnalysis
    : await analyzeMapDeletion(selectedDeleteMap);
  if (!currentAnalysis) return;
  const blocked = currentAnalysis.isWorldRoot ||
    currentAnalysis.childMaps.length > 0 ||
    currentAnalysis.pieces.length > 0;
  if (blocked) {
    setConfirmDeleteMap(false);
    setShowDeleteMapBlocker(true);
    return;
  }
  setConfirmDeleteMap(true);
}

async function stageDeleteMap() {
  if (!activeProject || !activeMap || !mapDeletionAnalysis) return;
  const analysis = mapDeletionAnalysis;
  if (analysis.isWorldRoot ||
      analysis.childMaps.length > 0 ||
      analysis.pieces.length > 0) return;

  const deletedMap = analysis.map;
  const deletedFeatureIds = new Set(deletedMap.featureIds);
  const ownedSections = deletedMap.id === activeMap.id
    ? activeSections
    : await sectionRepository.loadSections(deletedMap.sectionIds ?? []);
  const ownedEdges = deletedMap.id === activeMap.id
    ? activeSectionEdges
    : await sectionEdgeRepository.loadEdges(ownedSections.flatMap((section) => {
        return section.edgeIds;
      }));
  const ownedNodeIds = new Set(ownedEdges.flatMap((edge) => {
    return [edge.startNodeId, edge.endNodeId];
  }));
  setDeletedSectionIds((current) => new Set([
    ...current,
    ...ownedSections.map((section) => section.id),
  ]));
  setDeletedSectionEdgeIds((current) => new Set([
    ...current,
    ...ownedEdges.map((edge) => edge.id),
  ]));
  setDeletedSectionNodeIds((current) => new Set([
    ...current,
    ...ownedNodeIds,
  ]));
  const pendingFeatureIds = new Set(
    pendingFeatures.map((feature) => feature.id)
  );
  const convertedFeatures = analysis.incomingLocations.map(({ feature }) => {
    return {
      ...feature,
      type: 'feature' as const,
      targetMapId: undefined,
      targetFeatureId: undefined,
      connectionPlacementPending: undefined,
    };
  });
  const convertedById = new Map(
    convertedFeatures.map((feature) => [feature.id, feature])
  );
  clearParentLocationReferences(new Set([
    ...deletedFeatureIds,
    ...convertedById.keys(),
  ]));

  if (deletedMap.id !== activeMap.id) {
    setActiveFeatures((current) => current.map((feature) => {
      return convertedById.get(feature.id) ?? feature;
    }));
  }
  setPendingFeatures((current) => {
    const retained = current.filter((feature) => {
      return !deletedFeatureIds.has(feature.id) &&
        !convertedById.has(feature.id);
    });
    return [...retained, ...convertedFeatures];
  });
  setPendingFeatureDeletionIds((current) => {
    const next = new Set(current);
    deletedFeatureIds.forEach((featureId) => {
      if (!pendingFeatureIds.has(featureId)) next.add(featureId);
    });
    return next;
  });
  setPendingMaps((current) => {
    return current.filter((map) => map.id !== deletedMap.id);
  });
  setPendingMapDeletionIds((current) => {
    const next = new Set(current);
    next.add(deletedMap.id);
    return next;
  });

  let fallbackMapId = activeProject.activeMapId;
  if (deletedMap.id === activeMap.id) {
    fallbackMapId = deletedMap.parentMapId ?? activeProject.rootMapId;
  }
  const updatedProject = {
    ...activeProject,
    mapIds: activeProject.mapIds.filter((mapId) => mapId !== deletedMap.id),
    activeMapId: fallbackMapId,
  };
  setActiveProject(updatedProject);
  setSelectedDeleteMapId(null);
  setMapDeletionAnalysis(null);
  setConfirmDeleteMap(false);
  clearGoToMapPreview();
  markProjectDirty();

  if (deletedMap.id !== activeMap.id || !fallbackMapId) return;
  try {
    const fallbackMap = projectMaps.find((map) => map.id === fallbackMapId);
    const destination = fallbackMap
      ? { map: fallbackMap, features: await loadEffectiveMapFeatures(fallbackMap) }
      : await loadMapWithFeatures(fallbackMapId);
    setActiveMap(destination.map);
    setActiveFeatures(destination.features.map((feature) => {
      return convertedById.get(feature.id) ?? feature;
    }));
    setPendingFocusFeatureId(null);
    await loadMapImage(destination.map);
    handleMapEntered(destination.map, updatedProject, deletedMap.name, 'manual');
  } catch (error) {
    console.error('Unable to load fallback Map:', error);
    setNavigationError('The Map was staged for deletion, but its fallback failed.');
  }
}

function getDescendantMapIds(mapId: string): Set<string> {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    projectMaps.forEach((map) => {
      if (descendants.has(map.id) || map.id === mapId) return;
      if (map.parentMapId === mapId ||
          (map.parentMapId && descendants.has(map.parentMapId))) {
        descendants.add(map.id);
        changed = true;
      }
    });
  }
  return descendants;
}

function handleMapParentChange(parentMapId: string) {
  if (!activeMap || activeMap.id === activeProject?.rootMapId) return;
  if (parentMapId === activeMap.id) return;
  if (getDescendantMapIds(activeMap.id).has(parentMapId)) return;
  setActiveMap({
    ...activeMap,
    parentMapId,
    parentLocationId: undefined,
    updatedAt: new Date(),
  });
  markProjectDirty();
}

function handleConfirmMakeWorldRoot() {
  if (!activeProject || !activeMap || !mapToMakeRoot) return;
  const oldRoot = projectMaps.find((map) => {
    return map.id === activeProject.rootMapId;
  });
  if (!oldRoot || oldRoot.id === mapToMakeRoot.id) {
    setMapToMakeRoot(null);
    return;
  }

  const now = new Date();
  const newRoot = {
    ...mapToMakeRoot,
    parentMapId: undefined,
    parentLocationId: undefined,
    updatedAt: now,
  };
  const updatedOldRoot = {
    ...oldRoot,
    parentMapId: newRoot.id,
    parentLocationId: undefined,
    updatedAt: now,
  };
  setActiveProject({ ...activeProject, rootMapId: newRoot.id });
  setActiveMap(newRoot);
  setPendingMaps((current) => [
    ...current.filter((map) => {
      return map.id !== updatedOldRoot.id && map.id !== newRoot.id;
    }),
    updatedOldRoot,
  ]);
  setMapToMakeRoot(null);
  markProjectDirty();
}

async function handleSelectProject(project: Project) {
  setSectionMode(null);
  setDeletedSectionIds(new Set());
  setDeletedSectionNodeIds(new Set());
  setDeletedSectionEdgeIds(new Set());
  closeGoToMapDialog();
  deleteMapAnalysisRunIdRef.current += 1;
  setShowDeleteMapDialog(false);
  setSelectedDeleteMapId(null);
  setMapDeletionAnalysis(null);
  setConfirmDeleteMap(false);
  setShowDeleteMapBlocker(false);
  setMapToMakeRoot(null);
  setPendingMaps([]);
  setPendingFeatures([]);
  setPendingFeatureDeletionIds(
    new Set()
  );
  setPendingMapDeletionIds(new Set());
  setPendingFocusFeatureId(null);
  setPendingArrival(null);
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
  const mapsToDelete = pendingMapDeletionIds;
  const sections = activeSections;
  const sectionNodes = activeSectionNodes;
  const sectionEdges = activeSectionEdges;
  const sectionsToDelete = deletedSectionIds;
  const nodesToDelete = deletedSectionNodeIds;
  const edgesToDelete = deletedSectionEdgeIds;
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

      await Promise.all(sections.map((section) => {
        return sectionRepository.saveSection(section);
      }));
      await Promise.all(sectionNodes.map((node) => {
        return sectionNodeRepository.saveNode(node);
      }));
      await Promise.all(sectionEdges.map((edge) => {
        return sectionEdgeRepository.saveEdge(edge);
      }));

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
        Array.from(mapsToDelete).map((mapId) => {
          return mapRepository.deleteMap(mapId);
        })
      );
      await Promise.all(Array.from(sectionsToDelete).map((id) => {
        return sectionRepository.deleteSection(id);
      }));
      await Promise.all(Array.from(nodesToDelete).map((id) => {
        return sectionNodeRepository.deleteNode(id);
      }));
      await Promise.all(Array.from(edgesToDelete).map((id) => {
        return sectionEdgeRepository.deleteEdge(id);
      }));

      if (dirtyGenerationRef.current === generation) {
        if (updatedMap) setActiveMap(updatedMap);
        setActiveProject(updatedProject);
        setPendingMaps([]);
        setPendingFeatures([]);
        setPendingFeatureDeletionIds(
          new Set()
        );
        setPendingMapDeletionIds(new Set());
        setDeletedSectionIds(new Set());
        setDeletedSectionNodeIds(new Set());
        setDeletedSectionEdgeIds(new Set());
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
  setSectionMode(null);
  setDeletedSectionIds(new Set());
  setDeletedSectionNodeIds(new Set());
  setDeletedSectionEdgeIds(new Set());
  closeGoToMapDialog();
  closePieceBrowsers();
  setShowSettingsDialog(false);
  deleteMapAnalysisRunIdRef.current += 1;
  setShowDeleteMapDialog(false);
  setSelectedDeleteMapId(null);
  setMapDeletionAnalysis(null);
  setConfirmDeleteMap(false);
  setShowDeleteMapBlocker(false);
  setMapToMakeRoot(null);
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
  setPendingMapDeletionIds(new Set());
  setPendingFocusFeatureId(null);
  setPendingArrival(null);
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

  mapViewportRef.current?.cancelInteractions();
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
    setPendingMapDeletionIds(new Set());
    setPendingArrival(null);
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
  mapViewportRef.current?.cancelInteractions();
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

function updateFeatureEverywhere(
  featureId: string,
  update: (feature: Feature) => Feature
) {
  const updateList = (features: Feature[]) => {
    return features.map((feature) => {
      return feature.id === featureId ? update(feature) : feature;
    });
  };
  setActiveFeatures(updateList);
  setPendingFeatures(updateList);
}

function handleCreateSection(
  section: Section,
  nodes: SectionNode[],
  edges: SectionEdge[]
) {
  if (!activeMap) return;
  const boundaryExists = activeSections.some((item) => {
    return item.kind === 'boundary';
  });
  if (section.kind === 'boundary' && boundaryExists) return;
  setActiveSections([...activeSections, section]);
  setActiveSectionNodes((current) => {
    const byId = new Map(current.map((node) => [node.id, node]));
    nodes.forEach((node) => byId.set(node.id, node));
    return Array.from(byId.values());
  });
  setActiveSectionEdges((current) => {
    const byId = new Map(current.map((edge) => [edge.id, edge]));
    edges.forEach((edge) => byId.set(edge.id, edge));
    return Array.from(byId.values());
  });
  setActiveMap({
    ...activeMap,
    sectionIds: [...activeSections.map((item) => item.id), section.id],
    updatedAt: new Date(),
  });
  markProjectDirty();
}

function handleUpdateSectionData(
  sections: Section[],
  nodes: SectionNode[],
  edges: SectionEdge[]
) {
  const nextNodeIds = new Set(nodes.map((node) => node.id));
  const nextEdgeIds = new Set(edges.map((edge) => edge.id));
  setDeletedSectionNodeIds((current) => new Set([
    ...current,
    ...activeSectionNodes
      .filter((node) => !nextNodeIds.has(node.id))
      .map((node) => node.id),
  ]));
  setDeletedSectionEdgeIds((current) => new Set([
    ...current,
    ...activeSectionEdges
      .filter((edge) => !nextEdgeIds.has(edge.id))
      .map((edge) => edge.id),
  ]));
  setActiveSections(sections);
  setActiveSectionNodes(nodes);
  setActiveSectionEdges(edges);
  markProjectDirty();
}

function handleDeleteSection(sectionId: string) {
  if (!activeMap) return;
  const remainingSections = activeSections.filter((section) => {
    return section.id !== sectionId;
  });
  const retainedEdgeIds = new Set(remainingSections.flatMap((section) => {
    return section.edgeIds;
  }));
  const removedEdges = activeSectionEdges.filter((edge) => {
    return !retainedEdgeIds.has(edge.id);
  });
  const remainingEdges = activeSectionEdges.filter((edge) => {
    return retainedEdgeIds.has(edge.id);
  });
  const retainedNodeIds = new Set(remainingEdges.flatMap((edge) => {
    return [edge.startNodeId, edge.endNodeId];
  }));
  const removedNodes = activeSectionNodes.filter((node) => {
    return !retainedNodeIds.has(node.id);
  });
  setActiveSections(remainingSections);
  setActiveSectionEdges(remainingEdges);
  setActiveSectionNodes((current) => current.filter((node) => {
    return retainedNodeIds.has(node.id);
  }));
  setDeletedSectionIds((current) => new Set(current).add(sectionId));
  setDeletedSectionEdgeIds((current) => {
    return new Set([...current, ...removedEdges.map((edge) => edge.id)]);
  });
  setDeletedSectionNodeIds((current) => {
    return new Set([...current, ...removedNodes.map((node) => node.id)]);
  });
  setActiveMap({
    ...activeMap,
    sectionIds: remainingSections.map((section) => section.id),
    updatedAt: new Date(),
  });
  markProjectDirty();
}

function clearParentLocationReferences(locationIds: Set<string>) {
  if (activeMap?.parentLocationId &&
      locationIds.has(activeMap.parentLocationId)) {
    setActiveMap({ ...activeMap, parentLocationId: undefined });
  }
  const affectedMaps = projectMaps.filter((map) => {
    return map.id !== activeMap?.id &&
      Boolean(map.parentLocationId) &&
      locationIds.has(map.parentLocationId ?? '');
  });
  if (affectedMaps.length === 0) return;
  setPendingMaps((current) => {
    const next = new Map(current.map((map) => [map.id, map]));
    affectedMaps.forEach((map) => {
      next.set(map.id, { ...map, parentLocationId: undefined });
    });
    return Array.from(next.values());
  });
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

  updateFeatureEverywhere(featureId, (feature) => {
    return { ...feature, name: trimmedName };
  });

  markProjectDirty();
}

function handleSubtitleChange(featureId: string, subtitle: string) {
  updateFeatureEverywhere(featureId, (feature) => {
    return { ...feature, subtitle: subtitle || undefined };
  });

  markProjectDirty();
}

function handleDescriptionChange(
  featureId: string,
  description: RichTextDocument
) {
  updateFeatureEverywhere(featureId, (feature) => {
    return { ...feature, description };
  });
  markProjectDirty();
}

function handleShowLabelChange(featureId: string, showLabel: boolean) {
  updateFeatureEverywhere(featureId, (feature) => {
    return { ...feature, showLabel };
  });
  markProjectDirty();
}

function handleFeatureTypeChange(
  featureId: string,
  featureTypeId: string | undefined
) {
  const feature = activeFeatures.find((item) => item.id === featureId) ??
    pendingFeatures.find((item) => item.id === featureId);
  if (!feature || feature.featureTypeId === featureTypeId) return;
  updateFeatureEverywhere(featureId, (candidate) => {
    return { ...candidate, featureTypeId };
  });
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
  const clearType = (current: Feature[]) => current.map((feature) => {
    if (feature.featureTypeId !== id) return feature;
    return { ...feature, featureTypeId: undefined };
  });
  setActiveFeatures(clearType);
  setPendingFeatures(clearType);
  markProjectDirty();
}

function handleFeatureMove(
  featureId: string,
  position: Feature['position']
) {
  updateFeatureEverywhere(featureId, (feature) => {
    return { ...feature, position };
  });
  markProjectDirty();
}

async function handleDeleteFeature(
  feature: Feature
) {
  if (!activeMap) {
    return;
  }

  const confirmed = window.confirm(
    feature.type === 'connection'
      ? `Delete Connection "${feature.name}" and its paired Connection?`
      : feature.type === 'location'
        ? `Delete Location "${feature.name}"?`
        : `Delete Feature "${feature.name}"?`
  );

  if (!confirmed) {
    return;
  }

  const now = new Date();

  // Ordinary Features and Locations only remove themselves.
  if (
    feature.type !== 'connection' ||
    !feature.targetMapId ||
    !feature.targetFeatureId
  ) {
    if (feature.type === 'location') {
      clearParentLocationReferences(new Set([feature.id]));
    }
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
   * Same-map Connection.
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
   * Different-map Connection.
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
     * Remove the visible/source Connection
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
     * If either Connection was newly created
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
      'Unable to delete Connection:',
      error
    );

    setNavigationError(
      'Unable to delete this Connection.'
    );
  }
}

function handleNewFeatureRequest(x: number, y: number) {
  mapViewportRef.current?.cancelInteractions();
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
  mapViewportRef.current?.cancelInteractions();
  setNavigationFeatureKind('location');
  setNewLocationPosition({ x, y });
  setNewLocationName('');
  setNewConnectionName('');
  setNewLocationTypeId('');
  setNewLocationImage(null);
  setLocationSearch('');
  setLocationTypeFilter('all');
  setShowLocationChoiceDialog(true);
}

function handleNewConnectionRequest(x: number, y: number) {
  mapViewportRef.current?.cancelInteractions();
  setNavigationFeatureKind('connection');
  setNewLocationPosition({ x, y });
  setNewLocationName('');
  setNewConnectionName('');
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
  setSelectedExistingMapId(null);
  setNewLocationPosition(null);
}

function createLocationFeature(
  destinationMap: RegionMap,
  sourceName: string
): Feature | null {
  if (!activeProject || !activeMap || !newLocationPosition) return null;
  return {
    id: crypto.randomUUID(),
    name: sourceName,
    position: newLocationPosition,
    type: 'location',
    noteLinks: [],
    targetMapId: destinationMap.id,
  };
}

function createConnectionPair(
  destinationMap: RegionMap,
  sourceName: string
) {
  if (!activeMap || !newLocationPosition) return null;
  const sourceId = crypto.randomUUID();
  const destinationId = crypto.randomUUID();
  const sourceFeature: Feature = {
    id: sourceId,
    name: sourceName,
    position: newLocationPosition,
    type: 'connection',
    noteLinks: [],
    targetMapId: destinationMap.id,
    targetFeatureId: destinationId,
  };
  const destinationFeature: Feature = {
    id: destinationId,
    name: `Return to ${activeMap.name}`,
    position: getMapArrivalCenter(destinationMap),
    type: 'connection',
    noteLinks: [],
    targetMapId: activeMap.id,
    targetFeatureId: sourceId,
    connectionPlacementPending: true,
  };
  return { sourceFeature, destinationFeature };
}

async function handleCreateLocation() {
  if (!activeProject || !activeMap || !newLocationPosition) return;

  const name = newLocationName.trim();
  if (!name) return;

  const now = new Date();
  const childMap = createDefaultMap({
    id: crypto.randomUUID(),
    now,
    parentMapId: navigationFeatureKind === 'location'
      ? activeMap.id
      : undefined,
  });
  childMap.name = name;
  childMap.featureTypeId = newLocationTypeId || undefined;

  if (newLocationImage) {
    const image = await hostedMapImageService.importLocalFile(
      newLocationImage
    );
    childMap.imageFileId = image.id;
  }

  const sourceName = navigationFeatureKind === 'connection'
    ? newConnectionName.trim()
    : name;
  if (!sourceName) return;
  const location = navigationFeatureKind === 'location'
    ? createLocationFeature(childMap, sourceName)
    : null;
  const connection = navigationFeatureKind === 'connection'
    ? createConnectionPair(childMap, sourceName)
    : null;
  const sourceFeature = location ?? connection?.sourceFeature;
  if (!sourceFeature) return;
  if (location) childMap.parentLocationId = location.id;
  if (connection) childMap.featureIds = [connection.destinationFeature.id];

  setActiveFeatures((current) => [...current, sourceFeature]);
  setActiveMap({
    ...activeMap,
    featureIds: [...activeMap.featureIds, sourceFeature.id],
    updatedAt: now,
  });
  setActiveProject({
    ...activeProject,
    mapIds: [...activeProject.mapIds, childMap.id],
    updatedAt: now,
  });
  setPendingMaps((current) => [...current, childMap]);
  if (connection) {
    setPendingFeatures((current) => [
      ...current,
      connection.destinationFeature,
    ]);
  }

  markProjectDirty();
  closeLocationDialogs();
  setNewLocationName('');
}

function handleCreateExistingLocation(destinationMap: RegionMap) {
  if (!activeProject || !activeMap || !newLocationPosition) return;

  const now = new Date();
  const sourceName = navigationFeatureKind === 'connection'
    ? newConnectionName.trim()
    : destinationMap.name;
  if (!sourceName) return;
  const location = navigationFeatureKind === 'location'
    ? createLocationFeature(destinationMap, sourceName)
    : null;
  const connection = navigationFeatureKind === 'connection'
    ? createConnectionPair(destinationMap, sourceName)
    : null;
  const sourceFeature = location ?? connection?.sourceFeature;
  if (!sourceFeature) return;

  if (!connection || destinationMap.id === activeMap.id) {
    const additions = connection
      ? [sourceFeature, connection.destinationFeature]
      : [sourceFeature];
    setActiveFeatures((current) => [...current, ...additions]);
    setActiveMap({
      ...activeMap,
      featureIds: [
        ...activeMap.featureIds,
        ...additions.map((feature) => feature.id),
      ],
      updatedAt: now,
    });
  } else {
    const updatedDestination = {
      ...destinationMap,
      featureIds: [
        ...destinationMap.featureIds,
        connection.destinationFeature.id,
      ],
      updatedAt: now,
    };
    setActiveFeatures((current) => [...current, sourceFeature]);
    setActiveMap({
      ...activeMap,
      featureIds: [...activeMap.featureIds, sourceFeature.id],
      updatedAt: now,
    });
    setPendingMaps((current) => [
      ...current.filter((map) => map.id !== updatedDestination.id),
      updatedDestination,
    ]);
    setPendingFeatures((current) => [
      ...current,
      connection.destinationFeature,
    ]);
  }

  markProjectDirty();
  closeLocationDialogs();
}

function handleConfirmExistingNavigationFeature() {
  if (!selectedExistingMapId) return;
  const destinationMap = projectMaps.find((map) => {
    return map.id === selectedExistingMapId;
  });
  if (!destinationMap) return;
  handleCreateExistingLocation(destinationMap);
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
const pieceBrowserItems = (activeProject?.pieces ?? [])
  .map((piece) => ({
    piece,
    mapName: projectMaps.find((map) => map.id === piece.mapId)?.name ??
      'Missing Map',
  }))
  .filter(({ piece, mapName }) => {
    const search = pieceSearch.trim().toLocaleLowerCase();
    return piece.name.toLocaleLowerCase().includes(search) ||
      mapName.toLocaleLowerCase().includes(search);
  })
  .sort((left, right) => left.piece.name.localeCompare(right.piece.name));
const selectedPiece = activeProject?.pieces.find((piece) => {
  return piece.id === selectedPieceId;
}) ?? null;
const deleteMapMaps = projectMaps
  .filter((map) => {
    const search = deleteMapSearch.trim().toLocaleLowerCase();
    const matchesSearch = map.name.toLocaleLowerCase().includes(search);
    const matchesType = deleteMapTypeFilter === 'all' ||
      (deleteMapTypeFilter === 'none' && !map.featureTypeId) ||
      map.featureTypeId === deleteMapTypeFilter;
    return matchesSearch && matchesType;
  })
  .sort((left, right) => left.name.localeCompare(right.name));
const selectedDeleteMap = projectMaps.find((map) => {
  return map.id === selectedDeleteMapId;
}) ?? null;
const selectedDeleteMapType = activeProject?.featureTypes.find((type) => {
  return type.id === selectedDeleteMap?.featureTypeId;
})?.name ?? 'No Type';
const activeMapDescendants = activeMap
  ? getDescendantMapIds(activeMap.id)
  : new Set<string>();
const parentMapOptions = projectMaps
  .filter((map) => {
    return map.id !== activeMap?.id && !activeMapDescendants.has(map.id);
  })
  .sort((left, right) => left.name.localeCompare(right.name));
const parentMapName = activeMap?.parentMapId
  ? projectMaps.find((map) => map.id === activeMap.parentMapId)?.name ??
    'Missing Map'
  : activeMap?.id === activeProject?.rootMapId
    ? 'World Root'
    : 'Unassigned';
const pendingArrivalConnection = pendingArrival?.destinationFeatureId
  ? activeFeatures.find((feature) => {
      return feature.id === pendingArrival.destinationFeatureId;
    })
  : undefined;
const pendingArrivalPiece = pendingArrival?.pieceId
  ? activeProject?.pieces.find((piece) => {
      return piece.id === pendingArrival.pieceId;
    })
  : undefined;

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
  onDeleteMap={handleOpenDeleteMap}
  onAddPiece={handleAddPiece}
  onGoToPiece={() => openPieceBrowser('go')}
  onMigratePiece={() => openPieceBrowser('migrate')}
  onAssignMapImage={() => assignMapInputRef.current?.click()}
  onOpenSettings={openSettingsDialog}
  onManageFeatureTypes={() => {
    mapViewportRef.current?.cancelInteractions();
    setShowFeatureTypesDialog(true);
  }}
  sectionMode={sectionMode}
  onSectionModeChange={handleSectionModeChange}
  projectName={
    activeProject?.name
  }
  mapActive={activeMap !== null}
  parentMapAvailable={Boolean(activeMap?.parentMapId)}
  addPieceEnabled={Boolean(activeProject && activeMap && activeMapImageUrl)}
  pieces={activeProject?.pieces ?? []}
  focusedPieceId={activeProject?.focusedPieceId}
  onFocusPiece={(pieceId) => void handleFocusPiece(pieceId)}
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

{showSettingsDialog && (
  <div className="dialog-backdrop">
    <div className="dialog regions-settings-dialog">
      <h2>Regions Settings</h2>
      <fieldset>
        <legend>General</legend>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settingsDraft.autosaveEnabled}
            onChange={(event) => setSettingsDraft({
              ...settingsDraft,
              autosaveEnabled: event.target.checked,
            })}
          />
          Autosave
        </label>
      </fieldset>
      <fieldset>
        <legend>Navigation</legend>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={settingsDraft.edgeScrollingEnabled}
            onChange={(event) => setSettingsDraft({
              ...settingsDraft,
              edgeScrollingEnabled: event.target.checked,
            })}
          />
          Edge Scrolling
        </label>
      </fieldset>
      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() => setShowSettingsDialog(false)}
        >
          Cancel
        </button>
        <button type="button" onClick={() => void saveSettings()}>
          Save
        </button>
      </div>
    </div>
  </div>
)}

{(showGoToPieceDialog || showMigratePieceDialog) && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog piece-browser-dialog">
      <h2>
        {showGoToPieceDialog ? 'Go to Piece' : 'Migrate Piece'}
      </h2>
      <input
        type="search"
        placeholder="Search Pieces"
        value={pieceSearch}
        onChange={(event) => setPieceSearch(event.target.value)}
        autoFocus
      />
      <div className="piece-browser-list">
        {pieceBrowserItems.length === 0 && (
          <span className="piece-browser-empty">No Pieces found.</span>
        )}
        {pieceBrowserItems.map(({ piece, mapName }) => (
          <button
            key={piece.id}
            type="button"
            className={piece.id === selectedPieceId ? 'selected' : ''}
            onClick={() => setSelectedPieceId(piece.id)}
            onDoubleClick={() => {
              setSelectedPieceId(piece.id);
            }}
          >
            <span>{piece.name}</span>
            <small>{mapName}</small>
          </button>
        ))}
      </div>
      <div className="dialog-buttons">
        <button type="button" onClick={closePieceBrowsers}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedPiece}
          onClick={() => {
            if (showGoToPieceDialog) {
              void handleGoToPiece();
              return;
            }
            handleBeginPieceMigration();
          }}
        >
          {showGoToPieceDialog ? 'Go' : 'Migrate'}
        </button>
      </div>
    </div>
  </div>
)}

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

{showDeleteMapDialog && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog delete-map-dialog">
      <h2>Delete Map</h2>

      <div className="go-to-map-layout">
        <div className="go-to-map-browser">
          <input
            type="search"
            placeholder="Search Maps"
            value={deleteMapSearch}
            onChange={(event) => setDeleteMapSearch(event.target.value)}
            autoFocus
          />

          <select
            value={deleteMapTypeFilter}
            onChange={(event) => {
              setDeleteMapTypeFilter(event.target.value);
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
            {deleteMapMaps.map((map) => (
              <button
                key={map.id}
                type="button"
                className={[
                  'go-to-map-item',
                  map.id === selectedDeleteMapId ? 'selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectDeleteMap(map)}
              >
                <span>{map.name}</span>
                <small>
                  {activeProject.featureTypes.find((type) => {
                    return type.id === map.featureTypeId;
                  })?.name ?? 'No Type'}
                </small>
              </button>
            ))}
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

          <strong>{selectedDeleteMap?.name ?? 'Select a Map'}</strong>
          {selectedDeleteMap && <span>Type: {selectedDeleteMapType}</span>}
        </div>
      </div>

      {confirmDeleteMap && selectedDeleteMap && mapDeletionAnalysis && (
        <div className="delete-map-confirmation">
          <strong>Delete “{selectedDeleteMap.name}”?</strong>
          <span>
            This will delete the Map and all Features on it.
          </span>
          <span>
            {mapDeletionAnalysis.incomingLocations.length} connected
            {' '}Location(s) or Connection(s) on other Maps will be
            {' '}converted into normal Features.
          </span>
          <span>
            This cannot be undone after the Project is saved.
          </span>
        </div>
      )}

      <div className="dialog-buttons">
        <button type="button" onClick={closeDeleteMapDialog}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedDeleteMap}
          onClick={() => {
            if (confirmDeleteMap) {
              void stageDeleteMap();
              return;
            }
            void handleDeleteMapRequest();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)}

{showDeleteMapBlocker && selectedDeleteMap && mapDeletionAnalysis && (
  <div className="dialog-backdrop delete-map-blocker-backdrop">
    <div className="dialog delete-map-blocker-dialog">
      <h2>Cannot Delete Map</h2>
      <p>“{selectedDeleteMap.name}” cannot be deleted because:</p>
      <ul>
        {mapDeletionAnalysis.isWorldRoot && (
          <li>It is the current World Root.</li>
        )}
        {mapDeletionAnalysis.pieces.length > 0 && (
          <li>
            It contains {mapDeletionAnalysis.pieces.length} Piece(s).
          </li>
        )}
        {mapDeletionAnalysis.childMaps.length > 0 && (
          <li>
            It has {mapDeletionAnalysis.childMaps.length} child Map(s).
          </li>
        )}
      </ul>
      {mapDeletionAnalysis.isWorldRoot && (
        <p>Assign another Map as World Root before deleting it.</p>
      )}
      {mapDeletionAnalysis.pieces.length > 0 &&
        mapDeletionAnalysis.childMaps.length > 0 && (
        <p>
          Move or delete the Pieces and reparent or delete the child Maps
          {' '}before deleting {selectedDeleteMap.name}.
        </p>
      )}
      {mapDeletionAnalysis.pieces.length > 0 &&
        mapDeletionAnalysis.childMaps.length === 0 && (
        <p>
          Move or delete the Pieces before deleting
          {' '}{selectedDeleteMap.name}.
        </p>
      )}
      {mapDeletionAnalysis.childMaps.length > 0 &&
        mapDeletionAnalysis.pieces.length === 0 && (
        <p>
          Reparent or delete the child Maps before deleting
          {' '}{selectedDeleteMap.name}.
        </p>
      )}
      <div className="dialog-buttons">
        <button
          type="button"
          onClick={() => setShowDeleteMapBlocker(false)}
          autoFocus
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

{mapToMakeRoot && activeProject && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>Make World Root</h2>
      <p>
        Make “{mapToMakeRoot.name}” the World Root?
      </p>
      <p>
        The current World Root will become its child Map.
      </p>
      <div className="dialog-buttons">
        <button type="button" onClick={() => setMapToMakeRoot(null)}>
          Cancel
        </button>
        <button type="button" onClick={handleConfirmMakeWorldRoot}>
          Make World Root
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

{editingPieceId && (
  <div className="dialog-backdrop">
    <div className="dialog piece-editor-dialog">
      <h2>Edit Piece</h2>

      <label>
        Name
        <input
          type="text"
          value={pieceNameDraft}
          onChange={(event) => setPieceNameDraft(event.target.value)}
          autoFocus
        />
      </label>

      <label>
        Shape
        <select
          value={pieceShapeDraft}
          onChange={(event) => {
            setPieceShapeDraft(event.target.value as PieceShape);
          }}
        >
          <option value="circle">Circle</option>
          <option value="square">Square</option>
          <option value="diamond">Diamond</option>
          <option value="triangle">Triangle</option>
          <option value="hexagon">Hexagon</option>
        </select>
      </label>

      <label>
        Fill Color
        <input
          type="color"
          value={pieceFillDraft}
          onChange={(event) => setPieceFillDraft(event.target.value)}
        />
      </label>

      <label>
        Border Color
        <input
          type="color"
          value={pieceBorderDraft}
          onChange={(event) => setPieceBorderDraft(event.target.value)}
        />
      </label>

      <div className="dialog-buttons">
        <button type="button" onClick={() => setEditingPieceId(null)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={!pieceNameDraft.trim()}
          onClick={handleSavePiece}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

{pieceToDelete && (
  <div className="dialog-backdrop">
    <div className="dialog">
      <h2>Delete Piece</h2>
      <p>Delete &quot;{pieceToDelete.name}&quot;?</p>
      <div className="dialog-buttons">
        <button type="button" onClick={() => setPieceToDelete(null)}>
          Cancel
        </button>
        <button type="button" onClick={handleDeletePiece}>
          Delete
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
      <h2>
        New {navigationFeatureKind === 'connection'
          ? 'Connection'
          : 'Location'}
      </h2>

      <p>Choose a new or existing destination Map.</p>

      <div className="location-choice-buttons">
        <button
          type="button"
          onClick={() => {
            setShowLocationChoiceDialog(false);

            requestAnimationFrame(() => {
              setShowNewLocationDialog(true);
            });
          }}
        >
          New...
        </button>

        <button
          type="button"
          onClick={() => {
            setShowLocationChoiceDialog(false);

            requestAnimationFrame(() => {
              setSelectedExistingMapId(null);
              setShowExistingLocationDialog(true);
            });
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
      <h2>
        New {navigationFeatureKind === 'connection'
          ? 'Connection'
          : 'Location Map'}
      </h2>

      {navigationFeatureKind === 'connection' && (
        <input
          type="text"
          placeholder="Connection name"
          value={newConnectionName}
          onChange={(event) => setNewConnectionName(event.target.value)}
          autoFocus
        />
      )}

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
        autoFocus={navigationFeatureKind === 'location'}
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
          disabled={!newLocationName.trim() ||
            (navigationFeatureKind === 'connection' &&
              !newConnectionName.trim())}
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
      <h2>
        Existing {navigationFeatureKind === 'connection'
          ? 'Connection'
          : 'Location'}
      </h2>

      {navigationFeatureKind === 'connection' && (
        <input
          type="text"
          placeholder="Connection name"
          value={newConnectionName}
          onChange={(event) => setNewConnectionName(event.target.value)}
          autoFocus
        />
      )}

      <div className="location-map-filters">
        <input
          type="search"
          placeholder="Search Maps"
          value={locationSearch}
          onChange={(event) => setLocationSearch(event.target.value)}
          autoFocus={navigationFeatureKind === 'location'}
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
                className={[
                  'location-map-item',
                  map.id === selectedExistingMapId ? 'selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setSelectedExistingMapId(map.id)}
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
        <button
          type="button"
          disabled={!selectedExistingMapId ||
            (navigationFeatureKind === 'connection' &&
              !newConnectionName.trim())}
          onClick={handleConfirmExistingNavigationFeature}
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
        ref={mapViewportRef}
        imageUrl={activeMapImageUrl}
        mapId={activeMap.id}
        mapName={activeMap.name}
        mapTypeId={activeMap.featureTypeId}
        parentMapName={parentMapName}
        parentMapId={activeMap.parentMapId}
        isWorldRoot={activeProject.rootMapId === activeMap.id}
        parentMapOptions={parentMapOptions}
        onParentMapChange={handleMapParentChange}
        onMakeWorldRoot={() => {
          mapViewportRef.current?.cancelInteractions();
          setMapToMakeRoot(activeMap);
        }}
        imageRegistration={activeMap.imageRegistration}
        features={activeFeatures}
        pieces={activeProject.pieces.filter((piece) => {
          return piece.mapId === activeMap.id &&
            piece.id !== pendingArrival?.pieceId;
        })}
        focusedPieceId={activeProject.focusedPieceId}
        edgeScrollingEnabled={regionsSettings.edgeScrollingEnabled}
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
        onPieceDrop={(pieceId, position, location) => {
          void handlePieceDrop(pieceId, position, location);
        }}
        onEditPiece={handleEditPiece}
        onDeletePiece={(piece) => {
          mapViewportRef.current?.cancelInteractions();
          setPieceToDelete(piece);
        }}
        onPieceTrackedChange={handlePieceTrackedChange}
        onFocusPiece={(pieceId) => void handleFocusPiece(pieceId)}
        onViewportCenterChange={setViewportCenter}
        focusPiecePosition={focusPiecePosition}
        focusPieceRequestId={focusPieceRequestId}
        onFocusPieceComplete={() => setFocusPiecePosition(null)}
        onDeleteFeature={handleDeleteFeature}
        onNewFeatureRequest={handleNewFeatureRequest}
        onNewLocationRequest={handleNewLocationRequest}
        onNewConnectionRequest={handleNewConnectionRequest}
        pendingArrivalPlacement={pendingArrival ? {
          connection: pendingArrivalConnection,
          piece: pendingArrivalPiece,
        } : undefined}
        onPendingArrivalCommit={(position) => {
          void commitPendingArrival(position);
        }}
        onPendingArrivalCancel={() => {
          void cancelPendingArrival();
        }}
        sections={activeSections}
        sectionNodes={activeSectionNodes}
        sectionEdges={activeSectionEdges}
        sectionMode={sectionMode}
        onSectionModeChange={handleSectionModeChange}
        onCreateSection={handleCreateSection}
        onUpdateSectionData={handleUpdateSectionData}
        onDeleteSection={handleDeleteSection}
        onSectionError={setNavigationError}
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
