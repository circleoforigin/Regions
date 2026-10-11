import AreaMediaSlotsDialog from './AreaMediaSlotsDialog';
import type { Map as RegionMap, MapImageRegistration } from '../models/Map';
import type { GlobalMediaSlot, MediaSlotOverride } from '../models/MediaSlot';
import type { BoundaryAlignment } from '../models/Map';
import { isValidAlignment, transformBoundaryPoint } from '../sections/BoundaryTransform';
import { getInteractionModePermissions } from '../interaction/InteractionModePermissions';
import DistanceMeasurementOverlay from '../interaction/distance/DistanceMeasurementOverlay';
import { useDistanceMeasurement } from '../interaction/distance/useDistanceMeasurement';
import type { DistanceAnchor } from '../interaction/distance/DistanceMeasurement';
import { resolveDistanceAnchors } from '../interaction/distance/resolveDistanceAnchors';
import type { Feature } from '../models/Feature';
import type { InteractionMode } from '../interaction/InteractionMode';
import ModeHelp from '../interaction/ModeHelp';
import type { PiecePathDock } from '../models/Piece';
import type {
  Route,
  RouteLegProfile,
  RouteNode,
  RouteTraversalPoint,
} from '../models/Route';
import { routeNodesToDistanceAnchors } from '../navigation/RouteDistance';
import {
  findFirstNavigationBoundaryCrossing,
  findNavigationAreaCrossings,
} from '../navigation/NavigationBoundary';
import type { RulesetExtensionData } from '../models/RulesetExtensionData';
import RulesetInteractionPanel from '../rules/RulesetInteractionPanel';
import { useRulesetInteraction } from '../rules/useRulesetInteraction';
import { convertMapDistance } from '../interaction/distance/DistanceMeasurement';
import {
  findSectorCrossings,
  OVERWORLD_SECTOR_RESOLUTION,
} from '../spatial/Sector';
import { resolveSpatialContext } from '../spatial/SpatialContextResolver';
import { resolveWorldPosition } from '../spatial/WorldPositionResolver';
import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useRegionsState } from '../state/RegionsStateContext';
import { defaultLayerVisibility } from '../state/RegionsState';
import MapKey from './MapKey';
import RichTextEditor from './RichTextEditor';
import type { RichTextDocument } from '../models/RichText';
import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';
import { isPieceTracked, type Piece } from '../models/Piece';
import {
  SECTION_DEFAULTS,
  type Section,
  type SectionEdge,
  type SectionKind,
  type SectionNode,
  type SectionPoint,
} from '../models/Section';
import {
  isPointInPolygon,
  getAreaLabelPosition,
  getSectionPolygon,
  getSectionNodeIds,
  closestPointOnSegment,
  pointToSegmentDistance,
  findFirstPolygonBoundaryIntersection,
} from '../sections/SectionGeometry';
import { findAreaReturnPath, validateAreaSegment } from '../sections/AreaDrawing';
import { useProximityDismiss } from '../hooks/useProximityDismiss';
import type {
  Map as PathMap,
} from '../models/Map';

import type {
  PathSegment,
} from '../models/Path';

import {
  savePathSegment,
  type PathNetwork,
} from '../paths/PathNetwork';

import {
  usePathInteraction,
} from '../paths/usePathInteraction';

import {
  resolvePathSegments,
  resolvePathTerminal,
} from '../paths/PathMapState';

import {
  projectPointOntoPathDock, resolvePathDockPosition
} from '../paths/PathGeometry';

import {
  getDistanceSegmentsWithPaths,
} from '../interaction/distance/DistancePathRouting';

import PathOverlay
  from '../paths/PathOverlay';

import PathSegmentPopup
  from '../paths/PathSegmentPopup';

const OVERSCROLL_RATIO = 0.5;
const FEATURE_MARKER_MIN_DISTANCE = 24;
const NODE_SNAP_DISTANCE = 8;
const PATH_SNAP_DISTANCE = 5;
const NAVIGATION_ZOOM_RATIO = 0.5;
const EDGE_SCROLL_ZONE_PX = 60;
const EDGE_SCROLL_DELAY_MS = 250;
const EDGE_SCROLL_MAX_SPEED = 600;
const EDGE_SCROLL_SUPPRESS_SELECTOR = [
  '.feature-popup',
  '.map-key',
  '.map-context-menu',
  '.piece-context-menu',
  '.dialog-backdrop',
].join(',');

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

function clampPanToViewport(
  candidate: Point,
  candidateScale: number,
  mapSize: Size,
  viewportSize: Size
): Point {
  const scaledWidth = mapSize.width * candidateScale;
  const scaledHeight = mapSize.height * candidateScale;
  const normalMaxX = Math.max(
    0,
    (scaledWidth - viewportSize.width) / 2
  );
  const normalMaxY = Math.max(
    0,
    (scaledHeight - viewportSize.height) / 2
  );
  const maxX = normalMaxX + viewportSize.width * OVERSCROLL_RATIO;
  const maxY = normalMaxY + viewportSize.height * OVERSCROLL_RATIO;

  return {
    x: Math.max(-maxX, Math.min(maxX, candidate.x)),
    y: Math.max(-maxY, Math.min(maxY, candidate.y)),
  };
}

function isLocation(feature: Feature): boolean {
  return feature.type === 'location';
}

function isConnection(feature: Feature): boolean {
  return feature.type === 'connection';
}

function isNavigableFeature(feature: Feature): boolean {
  return isLocation(feature) || isConnection(feature);
}

export interface FeaturePopupAction {
  id: string;
  label: string;
  disabled?: boolean;
  onInvoke?: () => void;
  children?: FeaturePopupAction[];
}

export interface LocationMapMetadata {
  mapId: string;
  mapName: string;
  typeName: string;
}

interface MapViewportProps {
  imageUrl: string;
  mapId: string;
  map: RegionMap;
  mapName: string;
  mapTypeId?: string;
  parentMapName: string;
  parentMapId?: string;
  isWorldRoot: boolean;
  parentMapOptions: { id: string; name: string }[];
  onParentMapChange: (mapId: string) => void;
  onMakeWorldRoot: () => void;
  imageRegistration?: MapImageRegistration;
  calibrationActive?: boolean;
  calibrationFirstPoint?: Point | null;
  calibrationSecondPoint?: Point | null;

onCalibrationPoint?: (point: Point) => void;

onCalibrationPointMove?: (
  pointIndex: 0 | 1,
  point: Point
) => void;
features: Feature[];
projectFeatures?: Feature[];
projectSections?: Section[];
projectSectionEdges?: SectionEdge[];
projectSectionNodes?: SectionNode[];
pathNetwork: PathNetwork;

onPathNetworkChange: (
  network: PathNetwork
) => void;

onPathMapChange: (
  updater: (
    map: PathMap
  ) => Promise<PathMap>
) => Promise<void>;
pieces?: Piece[];
allPieces?: Piece[];
focusedPieceId?: string;
edgeScrollingEnabled?: boolean;
featureTypes: FeatureTypeDefinition[];
locationMapMetadata?: Record<string, LocationMapMetadata>;
focusFeatureId?: string | null;

onFeatureNameChange?: (
  featureId: string,
  name: string
) => void;

onMapMetadataChange?: (
  name: string,
  featureTypeId: string | undefined
) => void;

onFocusFeatureComplete?: () => void;

onEnterFeature?: (feature: Feature) => void;
onSubtitleChange?: (featureId: string, subtitle: string) => void;
onDescriptionChange?: (
  featureId: string,
  description: RichTextDocument
) => void;
onFeatureRulesetDataChange?: (
  featureId: string,
  rulesetData: RulesetExtensionData
) => void;
onShowLabelChange?: (featureId: string, showLabel: boolean) => void;
onFeatureTypeChange?: (
  featureId: string,
  featureTypeId: string | undefined
) => void;
onFeatureMove?: (featureId: string, position: Point) => void;
onPieceDrop?: (
  pieceId: string,
  position: Point,
  location?: Feature,
  targetPiece?: Piece,
  pathDock?: PiecePathDock,
  routeNodeIndex?: number
) => void;
onPieceAreaBoundaryEnterRequest?: (
  pieceId: string,
  area: Section,
  position: Point
) => void;
onPieceBoundaryExitRequest?: (
  pieceId: string,
  position: Point
) => void;
onEditPiece?: (piece: Piece) => void;
onDeletePiece?: (piece: Piece) => void;
onRemovePartyMember?: (partyId: string, memberId: string) => void;
onDisbandParty?: (partyId: string) => void;
onPieceTrackedChange?: (pieceId: string, tracked: boolean) => void;
routes: Route[];
onSetPieceRoute?: (
  piece: Piece,
  nodes: Route['nodes'],
  legProfiles: RouteLegProfile[]
) => void;
onClearPieceRoute?: (
  piece: Piece
) => void;
onFocusPiece?: (pieceId: string) => void;
onViewportCenterChange?: (position: Point) => void;
focusPiecePosition?: Point | null;
focusPieceRequestId?: number;
onFocusPieceComplete?: () => void;
secondaryActions?: (
  feature: Feature,
  targetKind: 'feature' | 'area'
) => FeaturePopupAction[];
pathSecondaryActions?: (
  segment: PathSegment
) => FeaturePopupAction[];
onSelectedPathChange?: (
  segmentId: string | null
) => void;
onDeleteFeature?: (
  feature: Feature
) => void;
onNewFeatureRequest?: (
  x: number,
  y: number
) => void;
onPromotePathTerminal?: (
  terminalId: string
) => void;
onNewLocationRequest?: (
  x: number,
  y: number
) => void;

onNewConnectionRequest?: (
  x: number,
  y: number
) => void;

pendingArrivalPlacement?: {
  connection?: Feature;
  piece?: Piece;
};
onPendingArrivalCommit?: (position: Point) => void;
  onPendingArrivalCancel?: () => void;
  interactionMode: InteractionMode;
  sections?: Section[];
  sectionNodes?: SectionNode[];
  sectionEdges?: SectionEdge[];
  sectionMode?: SectionKind | null;
  onSectionModeChange?: (mode: SectionKind | null) => void;
  onCreateSection?: (
    section: Section,
    nodes: SectionNode[],
    edges: SectionEdge[]
  ) => void;
  onUpdateSectionData?: (
    sections: Section[],
    nodes: SectionNode[],
    edges: SectionEdge[]
  ) => void;
  onDeleteSection?: (sectionId: string) => void;
  globalMediaSlots?: GlobalMediaSlot[];
  mapMediaOverrides?: MediaSlotOverride[];
  locationMaps?: RegionMap[];
  boundaryAlignment?: BoundaryAlignment;
  onBoundaryAlignmentChange?: (alignment: BoundaryAlignment) => void;
  onAddAreaLocation?: (area: Section) => void;
  onOpenAreaLocation?: (area: Section) => void;
  onUnlinkAreaLocation?: (area: Section) => void;
  onSectionError?: (message: string) => void;

  onZoomStateChange?: (
    state: {
      value: number;
      min: number;
      max: number;
      step: number;
      disabled: boolean;
      setZoom: (
        value: number
      ) => void;
      fitMap: () => void;
    }
  ) => void;
}

export interface MapViewportHandle {
  cancelInteractions(): void;
  cancelSectionDraft(): void;
}

const MapViewport = forwardRef<MapViewportHandle, MapViewportProps>(
function MapViewport({
  imageUrl,
  mapId,
  map,
  mapName,
  mapTypeId,
  parentMapName,
  parentMapId,
  isWorldRoot,
  parentMapOptions,
  onParentMapChange,
  onMakeWorldRoot,
  imageRegistration,
  calibrationActive = false,
  calibrationFirstPoint,
  calibrationSecondPoint,
  onCalibrationPoint,
  onCalibrationPointMove,
  features,
  projectFeatures = features,
  pathNetwork,
  onPathNetworkChange,
  onPathMapChange,
  pieces = [],
  allPieces = pieces,
  focusedPieceId,
  edgeScrollingEnabled = true,
  featureTypes,
  locationMapMetadata = {},
  focusFeatureId,
  onFocusFeatureComplete,
  onEnterFeature,
  onFeatureNameChange,
  onSubtitleChange,
  onDescriptionChange,
  onFeatureRulesetDataChange,
  onShowLabelChange,
  onFeatureTypeChange,
  onFeatureMove,
  onPieceDrop,
  onPieceAreaBoundaryEnterRequest,
  onPieceBoundaryExitRequest,
  onEditPiece,
  onDeletePiece,
  onRemovePartyMember,
  onDisbandParty,
  onPieceTrackedChange,
  onSetPieceRoute,
  onClearPieceRoute,
  routes,
  onFocusPiece,
  onViewportCenterChange,
  focusPiecePosition,
  focusPieceRequestId,
  onFocusPieceComplete,
  onDeleteFeature,
  secondaryActions,
  pathSecondaryActions,
  onSelectedPathChange,
  onNewFeatureRequest,
  onPromotePathTerminal,
  onNewLocationRequest,
  onNewConnectionRequest,
  pendingArrivalPlacement,
  onPendingArrivalCommit,
  onPendingArrivalCancel,
  interactionMode,
  sections = [],
  sectionNodes = [],
  sectionEdges = [],
  projectSections = sections,
  projectSectionEdges = sectionEdges,
  projectSectionNodes = sectionNodes,
  sectionMode = null,
  onSectionModeChange,
  onCreateSection,
  onUpdateSectionData,
  onDeleteSection,
  globalMediaSlots = [],
  mapMediaOverrides = [],
  locationMaps = [],
  boundaryAlignment,
  onBoundaryAlignmentChange,
  onAddAreaLocation,
  onOpenAreaLocation,
  onUnlinkAreaLocation,
  onSectionError,
  onZoomStateChange,
  onMapMetadataChange,
}: MapViewportProps, ref) {
  const { state, dispatch } = useRegionsState();
  const {
    interaction: featureRulesetInteraction,
    loading: featureRulesetLoading,
  } = useRulesetInteraction(
    'Regions.Feature'
  );
  const {
    interaction: areaRulesetInteraction,
    loading: areaRulesetLoading,
  } = useRulesetInteraction(
    'Regions.Section'
  );
  const {
    interaction: pathRulesetInteraction,
    loading: pathRulesetLoading,
  } = useRulesetInteraction(
    'Regions.PathSegment'
  );
  const interactionPermissions =
    getInteractionModePermissions(interactionMode);
    const pathInteraction =
    usePathInteraction({
      active:
        interactionMode === 'path',

      mapId,

      network:
        pathNetwork,

      features,

      onNetworkChange:
        onPathNetworkChange,

      onMapChange:
        onPathMapChange,
    });
  const distanceMeasurement = useDistanceMeasurement();
  const [
    routePieceId,
    setRoutePieceId,
  ] = useState<string | null>(
    null
  );
  const [
    routeFinishPending,
    setRouteFinishPending,
  ] = useState(false);
  const [
    selectedPieceId,
    setSelectedPieceId,
  ] = useState<string | null>(
    null
  );
  const distanceInteractionActive =
    interactionMode === 'distance' ||
    routePieceId !== null;
  const [
    distancePointer,
    setDistancePointer,
  ] = useState<Point | null>(null);
  const [
    pathPointer,
    setPathPointer,
  ] = useState<Point | null>(
    null
  );
  const [
    selectedPathSegment,
    setSelectedPathSegment,
  ] = useState<{
    segmentId: string;
    anchor: Point;
  } | null>(null);

  const selectedPath =
    selectedPathSegment
      ? pathNetwork.segments.find(
        (segment) =>
          segment.id ===
          selectedPathSegment.segmentId
      )
    : undefined;

  useEffect(() => {
    onSelectedPathChange?.(
      selectedPath?.id ?? null
    );
  }, [
    selectedPath?.id,
    onSelectedPathChange,
  ]);

  async function updatePathSegment(
    segmentId: string,
    patch: Partial<
      Pick<
        PathSegment,
        | 'type'
        | 'name'
        | 'subtitle'
        | 'description'
        | 'journalPageId'
        | 'rulesetData'
      >
    >
  ): Promise<void> {
    const current =
      pathNetwork.segments.find(
        (segment) =>
          segment.id === segmentId
      );

  if (!current) {
    return;
  }

  const updated: PathSegment = {
    ...current,
    ...patch,
    updatedAt: new Date(),
  };

  await onPathMapChange(
    (map) =>
      savePathSegment(
        map,
        updated
      )
  );

  onPathNetworkChange({
    ...pathNetwork,
    segments:
      pathNetwork.segments.map(
        (segment) =>
          segment.id === segmentId
            ? updated
            : segment
      ),
  });
}

  const [
    pathPopupOffset,
    setPathPopupOffset,
  ] = useState<Point>({
    x: 90,
    y: -60,
  });

  const [
    pathDragPreview,
    setPathDragPreview,
  ] = useState<{
    kind: 'terminal' | 'shape';
    id: string;
    segmentId?: string;
    position: Point;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(
    null
  );

useEffect(() => {
  if (interactionMode === 'distance') {
    return;
  }

  distanceMeasurement.clear();
  setDistancePointer(null);
}, [
  interactionMode,
  distanceMeasurement.clear,
]);

useEffect(() => {
  if (interactionMode === 'path') 
  {
    return;
  }

  setPathPointer(null);
  setPathDragPreview(null);
}, [interactionMode]);

useEffect(() => {
  if (interactionMode === 'explore') {
    return;
  }

  setSelectedPathSegment(null);
}, [interactionMode]);

useEffect(() => {
  if (
    !selectedPathSegment ||
    !state.selectedFeatureId
  ) {
    return;
  }

  setSelectedPathSegment(null);
}, [
  selectedPathSegment,
  state.selectedFeatureId,
]);

useEffect(() => {
  if (!selectedPathSegment) {
    return;
  }

  const stillExists =
    pathNetwork.segments.some(
      (segment) =>
        segment.id ===
        selectedPathSegment.segmentId
    );

  if (!stillExists) {
    setSelectedPathSegment(null);
  }
}, [
  selectedPathSegment,
  pathNetwork.segments,
]);

useEffect(() => {
  pathPopupDragRef.current = null;

  setPathPopupOffset({
    x: 90,
    y: -60,
  });
}, [
  selectedPathSegment?.segmentId,
]);

const getPieceRoute = (
  pieceId: string
): Route | undefined =>
  routes.find(
    (route) =>
      route.pieceId === pieceId
  );  

const selectedRoutePiece =
  selectedPieceId
    ? pieces.find(
        (piece) =>
          piece.id === selectedPieceId
      )
    : undefined;

const selectedRoute =
  selectedRoutePiece
    ? getPieceRoute(selectedRoutePiece.id)
    : undefined;

const resolvedDistanceAnchors =
  resolveDistanceAnchors(
    distanceMeasurement.anchors,
    features,
    pieces,
    pathNetwork.terminals
  );

  const resolvedPathSegments =
    resolvePathSegments(
      pathNetwork.segments,
      pathNetwork.terminals,
      features
    );

    const displayedRoutes =
  routes.map((route) =>
  {
    const anchors =
      resolveDistanceAnchors(
        routeNodesToDistanceAnchors(
          route.nodes
        ),
        features,
        pieces,
        pathNetwork.terminals
      );

    const segments =
      getDistanceSegmentsWithPaths(
        anchors,
        resolvedPathSegments,
        sections,
        sectionEdges,
        sectionNodes
      );

    return {
      route,
      anchors,
      segments,
    };
  });

  const distanceSegments =
    getDistanceSegmentsWithPaths(
      resolvedDistanceAnchors,
      resolvedPathSegments,
      sections,
      sectionEdges,
      sectionNodes
    );

  const { scale, panX, panY } = state.viewport;
  const pan = { x: panX, y: panY };
  const contextMenu = state.contextMenu;
  const movingFeatureId = state.movingFeatureId;
  const movingFeaturePreviewPosition = state.movingFeaturePreviewPosition;
  const popupOffset = state.selectedFeaturePopupOffset;
  const layerVisibility =
    state.layerVisibility ?? defaultLayerVisibility;
  const isFeatureVisible = (feature: Feature) => {
    return isNavigableFeature(feature)
      ? layerVisibility.locations
      : layerVisibility.features;
  };
  const visibleFeatures = features.filter((feature) => {
    return isFeatureVisible(feature) &&
      feature.id !== pendingArrivalPlacement?.connection?.id;
  });
  const registration = imageRegistration ?? {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};
  
  const suppressNextFeatureClickRef = useRef(false);
  const viewportRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const dragRef =
    useRef<{
      pointerId: number;
      target: HTMLDivElement;
      startPointer: Point;
      startPan: Point;
    } | null>(
      null
    );

  const popupDragRef = useRef<{
    pointerId: number;
    target: HTMLDivElement;
    startPointer: Point;
    startOffset: Point;
  } | null>(null);

  const pathPopupDragRef = useRef<{
    pointerId: number;
    target: HTMLDivElement;
    startPointer: Point;
    startOffset: Point;
  } | null>(null);

  const pieceDragRef = useRef<{
    pieceId: string;
    pointerId: number;
    target: HTMLButtonElement;
    startPointer: Point;
    startPosition: Point;
    lastPosition: Point;
    grabOffset: Point;
    moved: boolean;
  } | null>(null);

  const calibrationDragRef = useRef<{
    pointIndex: 0 | 1;
    pointerId: number;
    target: SVGCircleElement;
  } | null>(null);

  const latestPointerRef = useRef<Point | null>(null);
  const pointerInsideViewportRef = useRef(false);
  const edgeActivationStartedAtRef = useRef<number | null>(null);
  const edgePreviousFrameRef = useRef<number | null>(null);
  const edgeScrollFrameRef = useRef<number | null>(null);
  const edgeScrollTickRef = useRef<((timestamp: number) => void) | null>(null);
  const panRef = useRef(pan);

  const [piecePreview, setPiecePreview] = useState<{
    pieceId: string;
    position: Point;
  } | null>(null);
  const piecePreviewRef = useRef<{
    pieceId: string;
    position: Point;
  } | null>(null);
  const [pieceContextMenu, setPieceContextMenu] = useState<{
    pieceId: string;
    x: number;
    y: number;
  } | null>(null);
  const [
    pathTerminalContextMenu,
    setPathTerminalContextMenu,
  ] = useState<{
    terminalId: string;
    x: number;
    y: number;
  } | null>(null);
  const [partyMembersMenuOpen, setPartyMembersMenuOpen] = useState(false);
  const [sectionDraft, setSectionDraft] = useState<{
    kind: SectionKind;
    sectionId: string;
    nodes: SectionNode[];
    edges: SectionEdge[];
    attachedEdgeId?: string;
  } | null>(null);
  const [sectionPointer, setSectionPointer] =
    useState<SectionPoint | null>(null);
  const [sectionContextMenu, setSectionContextMenu] = useState<{
    kind: 'node' | 'edge' | 'area';
    id: string;
    x: number;
    y: number;
    point: SectionPoint;
  } | null>(null);
  const [movingSectionNode, setMovingSectionNode] = useState<{
    nodeId: string;
    original: SectionPoint;
    position: SectionPoint;
    pointerId?: number;
  } | null>(null);

  const [alignmentPanelPosition, setAlignmentPanelPosition] = useState<Point | null>(null);
  const alignmentPanelRef = useRef<HTMLDivElement | null>(null);
  const alignmentDragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const alignmentLastValues = useRef<BoundaryAlignment | null>(null);
  const [alignmentDraft, setAlignmentDraft] = useState<BoundaryAlignment | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState('');
  const [mediaAreaId, setMediaAreaId] = useState<string | null>(null);
  const mediaArea = sections.find((area) => area.id === mediaAreaId);
  const mediaLocationMap = locationMaps.findLast((map) => map.id === mediaArea?.targetMapId);
  const sectionDataRef = useRef({ sections, sectionNodes, sectionEdges });
  sectionDataRef.current = { sections, sectionNodes, sectionEdges };
  function updateAreaIdentity(id: string, patch: Partial<Section> | ((area: Section) => Partial<Section>)) {
    const data = sectionDataRef.current;
    onUpdateSectionData?.(data.sections.map((area) => area.id === id
      ? { ...area, ...(typeof patch === 'function' ? patch(area) : patch), updatedAt: new Date() }
      : area), data.sectionNodes, data.sectionEdges);
  }
  const [sectionColorDraft, setSectionColorDraft] = useState('#ffffff');

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const pieceContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionContextMenuRef = useRef<HTMLDivElement | null>(null);
  const pathTerminalContextMenuRef =
    useRef<HTMLDivElement | null>(null);

  useProximityDismiss({
  open: pathTerminalContextMenu !== null,
  ref: pathTerminalContextMenuRef,
  onDismiss: () =>
    setPathTerminalContextMenu(null),
});
  useProximityDismiss({
    open: contextMenu !== null,
    ref: contextMenuRef,
    onDismiss: () => dispatch({ type: 'contextMenu.close' }),
  });
  useProximityDismiss({
    open: pieceContextMenu !== null,
    ref: pieceContextMenuRef,
    onDismiss: () => setPieceContextMenu(null),
  });
  useProximityDismiss({
    open: sectionContextMenu !== null,
    ref: sectionContextMenuRef,
    onDismiss: () => setSectionContextMenu(null),
  });

  function isSectionVisible(section: Section) {
    if (section.kind === 'area') return layerVisibility.areas !== false;
    if (section.kind === 'zone') return layerVisibility.zones !== false;
    if (section.kind === 'border') return layerVisibility.borders !== false;
    return layerVisibility.boundary !== false;
  }

  const visibleSections = sections.filter(isSectionVisible);
  const editableSections = sections.filter((section) => {
    return !section.locked && sectionMode !== null && section.kind === sectionMode;
  });
  const editableEdgeIds = new Set(editableSections.flatMap((section) => {
    return section.edgeIds;
  }));
  const editableEdges = sectionEdges.filter((edge) => {
    return editableEdgeIds.has(edge.id);
  });
  const editableNodeIds = new Set(editableEdges.flatMap((edge) => {
    return [edge.startNodeId, edge.endNodeId];
  }));
  const lockedEdgeIds = new Set(sections.filter((section) => section.locked).flatMap((section) => section.edgeIds));
  const lockedNodeIds = new Set(sectionEdges.filter((edge) => lockedEdgeIds.has(edge.id))
    .flatMap((edge) => [edge.startNodeId, edge.endNodeId]));
  const displayedSectionNodes = sectionNodes.map((node) => {
    if (alignmentDraft && boundaryAlignment && isValidAlignment(alignmentDraft) && lockedNodeIds.has(node.id)) {
      return { ...node, position: transformBoundaryPoint(
        transformBoundaryPoint(node.position, boundaryAlignment, true), alignmentDraft) };
    }
    if (movingSectionNode?.nodeId !== node.id) return node;
    return { ...node, position: movingSectionNode.position };
  });

  function getAreaControlPosition(
  section: Section
)
{
  const polygon =
    getSectionPolygon(
      section,
      sectionEdges,
      displayedSectionNodes
    );

  if (
    state.editingMode === 'move-feature' &&
    movingFeatureId === section.id &&
    movingFeaturePreviewPosition
  )
  {
    return movingFeaturePreviewPosition;
  }

  const position =
    section.controlPosition;

  return position &&
    isPointInPolygon(
      position,
      polygon
    )
      ? position
      : getAreaLabelPosition(
          polygon
        );
}

  const selectedArea = sections.find((section) => section.kind === 'area' &&
    section.id === state.selectedFeatureId && isSectionVisible(section));
  const linkedLocationMap = selectedArea?.targetMapId
    ? locationMaps.findLast((map) => map.id === selectedArea.targetMapId) : undefined;
  const areaPosition = selectedArea ? getAreaControlPosition(selectedArea) : null;
  const selectedFeature: Feature | undefined =
  selectedArea && areaPosition
    ? {
        id: selectedArea.id,
        name: selectedArea.name,
        subtitle: selectedArea.subtitle,
        description: selectedArea.description,
        position: areaPosition,
        type: selectedArea.targetMapId
          ? 'location'
          : 'feature',
        targetMapId: selectedArea.targetMapId,
        featureTypeId: selectedArea.featureTypeId,
        journalPageId: selectedArea.journalPageId,
        rulesetData: selectedArea.rulesetData,
        noteLinks: [],
      }
    : features.find(
        (feature) =>
          feature.id ===
            state.selectedFeatureId &&
          isFeatureVisible(feature)
      );

const selectedFeatureSecondaryActions =
  selectedFeature
    ? secondaryActions?.(
        selectedFeature,
        selectedArea
          ? 'area'
          : 'feature'
      ) ?? []
    : [];

  const [arrivalPreviewState, setArrivalPreviewState] = useState<{
    key: string;
    position: Point;
  } | null>(null);
  const arrivalPlacementKey = [
    pendingArrivalPlacement?.connection?.id,
    pendingArrivalPlacement?.piece?.id,
  ].filter(Boolean).join(':');
  const arrivalPreview = arrivalPreviewState?.key === arrivalPlacementKey
    ? arrivalPreviewState.position
    : null;

  const popupRef = useRef<HTMLDivElement | null>(null);
  const focusCompleteRef = useRef(onFocusFeatureComplete);

  const [expandedActionsFeatureId, setExpandedActionsFeatureId] =
    useState<string | null>(null);
  const [
  expandedSecondaryActionId,
  setExpandedSecondaryActionId,
] = useState<string | null>(null);
    const [expandedTypeFeatureId, setExpandedTypeFeatureId] =
    useState<string | null>(null);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [editingName, setEditingName] =
    useState(false);
  const [nameDraft, setNameDraft] =
    useState('');
  const [
    activeFeaturePopupTab,
    setActiveFeaturePopupTab,
  ] = useState<
    'description' | 'ruleset' | null
  >(null);

  useEffect(() => {
    popupDragRef.current = null;
    setEditingName(false);
    setNameDraft(
      selectedFeature?.name ?? ''
    );
    setActiveFeaturePopupTab(null);
  }, [
    selectedFeature?.id,
    selectedFeature?.name,
  ]);
  
  useEffect(() => {
    popupDragRef.current = null;
    setEditingSubtitle(false);
    setSubtitleDraft(selectedFeature?.subtitle ?? '');
    }, [selectedFeature?.id, selectedFeature?.subtitle]);
  const [
    viewportSize,
    setViewportSize,
  ] = useState<Size>({
    width: 0,
    height: 0,
  });

  const [
    imageSize,
    setImageSize,
  ] = useState<Size>({
    width: 0,
    height: 0,
  });

  const [ dragging, setDragging ] = useState(false);

  const [mapKeySide, setMapKeySide] =
    useState<'left' | 'right'>('right');

  const [popupSize, setPopupSize] = useState<Size>({
    width: 300,
    height: 480,
  });
  const contextTargetFeature = contextMenu?.kind === 'feature'
    ? features.find((feature) => feature.id === contextMenu.targetId)
    : undefined;

    const registeredWidth = imageSize.width * registration.scale;

    const registeredHeight = imageSize.height * registration.scale;

  const minScale =
    imageSize.width > 0 &&
    imageSize.height > 0 &&
    viewportSize.width > 0 &&
    viewportSize.height > 0
      ? Math.max(
          viewportSize.width / registeredWidth,
          viewportSize.height / registeredHeight
        )
      : 1;

  const maxScale = Math.max( 2, minScale );

  const zoomRatio = minScale > 0 ? scale / minScale : 1;
  const labelFadeStart = 1.1;
  const labelFadeEnd = 1.5;
  const labelOpacity = Math.max(
    0,
    Math.min(
      1,
      (zoomRatio - labelFadeStart) /
        (labelFadeEnd - labelFadeStart)
    )
  );

    const zoomStep = Math.max(( maxScale - minScale ) / 200, 0.001);

  function clampScale( candidate: number )
  {
    return Math.min(
      maxScale,
      Math.max(
        minScale,
        candidate
      )
    );
  }

  function clampPan( candidate: Point, candidateScale = scale
  ): Point {
    return clampPanToViewport(
      candidate,
      candidateScale,
      { width: registeredWidth, height: registeredHeight },
      viewportSize
    );
  }

  function getMapKeySide(
    nextPanX: number,
    nextScale: number
  ): 'left' | 'right' | null {
    if (nextScale <= 0 || registeredWidth <= 0) return null;

    const viewportCenterMapX = -nextPanX / nextScale;
    const deadZoneHalfWidth = registeredWidth * 0.05;
    const mapCenterX = registration.offsetX;

    if (viewportCenterMapX < mapCenterX - deadZoneHalfWidth) {
      return 'right';
    }

    if (viewportCenterMapX > mapCenterX + deadZoneHalfWidth) {
      return 'left';
    }

    return null;
  }

  function updateMapKeySide(nextPanX: number, nextScale: number) {
    const nextSide = getMapKeySide(nextPanX, nextScale);
    if (nextSide) setMapKeySide(nextSide);
  }

  const viewedMapKeySide = getMapKeySide(pan.x, scale);
  const displayedMapKeySide = viewedMapKeySide ?? mapKeySide;

function screenToMap(
  clientX: number,
  clientY: number
): Point | null {
  const viewport = viewportRef.current;

  if (!viewport || scale <= 0) {
    return null;
  }

  const rect = viewport.getBoundingClientRect();

  return {
    x: (
      clientX -
      rect.left -
      rect.width / 2 -
      pan.x
    ) / scale,

    y: (
      clientY -
      rect.top -
      rect.height / 2 -
      pan.y
    ) / scale,
  };
}

function screenToMapWithPan(
  clientX: number,
  clientY: number,
  currentPan: Point
): Point | null {
  const viewport = viewportRef.current;
  if (!viewport || scale <= 0) return null;
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - rect.width / 2 - currentPan.x) / scale,
    y: (clientY - rect.top - rect.height / 2 - currentPan.y) / scale,
  };
}

useEffect(() => {
  if (sectionMode === 'boundary' && boundaryAlignment) {
    setAlignmentDraft({ ...boundaryAlignment });
    alignmentLastValues.current = { ...boundaryAlignment };
    stopEdgeScrolling();
  } else {
    setAlignmentDraft(null);
  }
  alignmentDragRef.current = null;
}, [sectionMode, boundaryAlignment]);

function handleCalibrationNodePointerDown(
  event:
    React.PointerEvent<SVGCircleElement>,
  pointIndex: 0 | 1
) {
  event.preventDefault();
  event.stopPropagation();

  calibrationDragRef.current = {
    pointIndex,
    pointerId: event.pointerId,
    target: event.currentTarget,
  };

  event.currentTarget.setPointerCapture(
    event.pointerId
  );
}

function handleCalibrationNodePointerMove(
  event:
    React.PointerEvent<SVGCircleElement>
) {
  const drag =
    calibrationDragRef.current;

  if (
    !drag ||
    drag.pointerId !== event.pointerId
  ) {
    return;
  }

  const point =
    screenToMap(
      event.clientX,
      event.clientY
    );

  if (
    !point ||
    !isPointInsideMap(point)
  ) {
    return;
  }

  onCalibrationPointMove?.(
    drag.pointIndex,
    point
  );
}

function handleCalibrationNodePointerUp(
  event:
    React.PointerEvent<SVGCircleElement>
) {
  const drag =
    calibrationDragRef.current;

  if (
    !drag ||
    drag.pointerId !== event.pointerId
  ) {
    return;
  }

  calibrationDragRef.current = null;

  try {
    event.currentTarget
      .releasePointerCapture(
        event.pointerId
      );
  } catch {
    // Pointer capture may
    // already be released.
  }

  event.preventDefault();
  event.stopPropagation();
}

function stopPanelMapScrolling() {
  latestPointerRef.current = null;
  pointerInsideViewportRef.current = false;
  stopEdgeScrolling();
}
function stopEdgeScrolling() {
  if (edgeScrollFrameRef.current !== null) {
    cancelAnimationFrame(edgeScrollFrameRef.current);
  }
  edgeScrollFrameRef.current = null;
  edgeActivationStartedAtRef.current = null;
  edgePreviousFrameRef.current = null;
}

function releasePointerCaptureSafely(
  target: Element,
  pointerId: number
) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // The target may be unmounting or may have already lost capture.
  }
}

function cancelViewportInteractions() {
  if (dragRef.current) {
    releasePointerCaptureSafely(
      dragRef.current.target,
      dragRef.current.pointerId
    );
  }
  if (popupDragRef.current) {
    releasePointerCaptureSafely(
      popupDragRef.current.target,
      popupDragRef.current.pointerId
    );
  }
  if (pieceDragRef.current) {
    releasePointerCaptureSafely(
      pieceDragRef.current.target,
      pieceDragRef.current.pointerId
    );
  }
  dragRef.current = null;
  popupDragRef.current = null;
  pieceDragRef.current = null;
  piecePreviewRef.current = null;
  latestPointerRef.current = null;
  pointerInsideViewportRef.current = false;
  stopEdgeScrolling();
  setPiecePreview(null);
  setDragging(false);
  setMovingSectionNode(null);
  setSectionContextMenu(null);
  setSectionDraft(null);
  setSectionPointer(null);
  setEditingSection(null);
}

useImperativeHandle(ref, () => ({
  cancelInteractions: cancelViewportInteractions,
  cancelSectionDraft() {
    setSectionDraft(null);
    setSectionPointer(null);
  },
}));

function scheduleEdgeScrolling() {
  if (!edgeScrollingEnabled) return;
  if (edgeScrollFrameRef.current !== null) return;
  edgeScrollFrameRef.current = requestAnimationFrame((timestamp) => {
    edgeScrollTickRef.current?.(timestamp);
  });
}

function trackEdgePointer(clientX: number, clientY: number) {
  if (!edgeScrollingEnabled) {
    stopEdgeScrolling();
    return;
  }
  const viewport = viewportRef.current;
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const inside = clientX >= rect.left && clientX <= rect.right &&
    clientY >= rect.top && clientY <= rect.bottom;
  latestPointerRef.current = { x: clientX, y: clientY };
  pointerInsideViewportRef.current = inside;
  if (!inside) {
    stopEdgeScrolling();
    return;
  }
  scheduleEdgeScrolling();
}

function getEdgeVelocity(position: number, size: number): number {
  if (position < EDGE_SCROLL_ZONE_PX) {
    return (1 - Math.max(0, position) / EDGE_SCROLL_ZONE_PX) *
      EDGE_SCROLL_MAX_SPEED;
  }
  const trailingDistance = size - position;
  if (trailingDistance < EDGE_SCROLL_ZONE_PX) {
    return -(1 - Math.max(0, trailingDistance) /
      EDGE_SCROLL_ZONE_PX) * EDGE_SCROLL_MAX_SPEED;
  }
  return 0;
}

useEffect(() => {
  panRef.current = { x: pan.x, y: pan.y };
}, [pan.x, pan.y]);

useEffect(() => {
  if (!edgeScrollingEnabled) stopEdgeScrolling();
}, [edgeScrollingEnabled]);

useEffect(() => {
  edgeScrollTickRef.current = (timestamp) => {
  edgeScrollFrameRef.current = null;
  const viewport = viewportRef.current;
  const pointer = latestPointerRef.current;
  if (!viewport || !pointerInsideViewportRef.current || !pointer) {
    stopEdgeScrolling();
    return;
  }
  if (dragRef.current) {
    edgeActivationStartedAtRef.current = null;
    edgePreviousFrameRef.current = null;
    return;
  }
  const hovered = document.elementFromPoint(pointer.x, pointer.y);
  if (hovered instanceof Element &&
      hovered.closest(EDGE_SCROLL_SUPPRESS_SELECTOR)) {
    edgeActivationStartedAtRef.current = null;
    edgePreviousFrameRef.current = null;
    return;
  }
  const rect = viewport.getBoundingClientRect();
  const velocityX = getEdgeVelocity(pointer.x - rect.left, rect.width);
  const velocityY = getEdgeVelocity(pointer.y - rect.top, rect.height);
  if (velocityX === 0 && velocityY === 0) {
    edgeActivationStartedAtRef.current = null;
    edgePreviousFrameRef.current = null;
    return;
  }
  if (edgeActivationStartedAtRef.current === null) {
    edgeActivationStartedAtRef.current = timestamp;
    edgePreviousFrameRef.current = timestamp;
    scheduleEdgeScrolling();
    return;
  }
  if (timestamp - edgeActivationStartedAtRef.current <
      EDGE_SCROLL_DELAY_MS) {
    edgePreviousFrameRef.current = timestamp;
    scheduleEdgeScrolling();
    return;
  }
  const previousTimestamp = edgePreviousFrameRef.current ?? timestamp;
  const deltaSeconds = Math.min(0.05, (timestamp - previousTimestamp) / 1000);
  edgePreviousFrameRef.current = timestamp;
  const nextPan = clampPan({
    x: panRef.current.x + velocityX * deltaSeconds,
    y: panRef.current.y + velocityY * deltaSeconds,
  });
  panRef.current = nextPan;
  updateMapKeySide(nextPan.x, scale);
  dispatch({
    type: 'viewport.setPan',
    panX: nextPan.x,
    panY: nextPan.y,
  });

  const pieceDrag = pieceDragRef.current;
  if (pieceDrag) {
    const pointerMap = screenToMapWithPan(pointer.x, pointer.y, nextPan);
    if (pointerMap) {
      const preview = {
        pieceId: pieceDrag.pieceId,
        position: {
          x: pointerMap.x + pieceDrag.grabOffset.x,
          y: pointerMap.y + pieceDrag.grabOffset.y,
        },
      };
      piecePreviewRef.current = preview;
      setPiecePreview(preview);
    }
  }
  if (pendingArrivalPlacement) {
    const point = screenToMapWithPan(pointer.x, pointer.y, nextPan);
    if (point) {
      setArrivalPreviewState({ key: arrivalPlacementKey, position: point });
    }
  }
  if (state.editingMode === 'move-feature' && movingFeatureId) {
    const point = screenToMapWithPan(pointer.x, pointer.y, nextPan);
    if (point) dispatch({ type: 'featureMove.preview', position: point });
  }
    scheduleEdgeScrolling();
  };
});

function mapToScreen(
  mapX: number,
  mapY: number
): Point {
  return {
    x:
      viewportSize.width / 2 +
      pan.x +
      mapX * scale,

    y:
      viewportSize.height / 2 +
      pan.y +
      mapY * scale,
  };
}

function getPathDraftStartPosition():
  Point | null {
  const draft =
    pathInteraction.draft;

  if (!draft) {
    return null;
  }

  const resolved =
    resolvePathTerminal(
      draft.start,
      pathNetwork.terminals,
      features
    );

  return resolved?.position ?? null;
}

function isPointInsideMap(point: Point): boolean {
  if (registeredWidth <= 0 || registeredHeight <= 0) return false;

  const halfWidth = registeredWidth / 2;
  const halfHeight = registeredHeight / 2;
  const minX = registration.offsetX - halfWidth;
  const maxX = registration.offsetX + halfWidth;
  const minY = registration.offsetY - halfHeight;
  const maxY = registration.offsetY + halfHeight;

  return point.x >= minX && point.x <= maxX &&
    point.y >= minY && point.y <= maxY;
}

function isMovePositionValid(point: Point): boolean {
  if (!isPointInsideMap(point)) return false;
  const area = sections.find((section) => section.kind === 'area' && section.id === movingFeatureId);
  if (area && !isPointInPolygon(point, getSectionPolygon(area, sectionEdges, displayedSectionNodes))) return false;

  const proposed = mapToScreen(point.x, point.y);
  return visibleFeatures.every((feature) => {
    if (feature.id === movingFeatureId) return true;
    const other = mapToScreen(feature.position.x, feature.position.y);
    return Math.hypot(proposed.x - other.x, proposed.y - other.y) >=
      FEATURE_MARKER_MIN_DISTANCE;
  });
}

  function applyScale(
    requestedScale: number,
    anchor?: Point
    ) {
    const nextScale =
      clampScale(
        requestedScale
      );

    if (
      !viewportRef.current ||
      scale <= 0
    ) {
      dispatch({ type: 'viewport.setScale', scale: nextScale });

      return;
    }

    const rect =
      viewportRef.current
        .getBoundingClientRect();

    const anchorPoint =
      anchor ?? {
        x:
          rect.left +
          rect.width / 2,

        y:
          rect.top +
          rect.height / 2,
      };

    const anchorFromCenter = {
      x:
        anchorPoint.x -
        rect.left -
        rect.width / 2,

      y:
        anchorPoint.y -
        rect.top -
        rect.height / 2,
    };

    const ratio =
      nextScale / scale;

    const nextPan = {
      x:
        anchorFromCenter.x -
        (
          anchorFromCenter.x -
          pan.x
        ) *
        ratio,

      y:
        anchorFromCenter.y -
        (
          anchorFromCenter.y -
          pan.y
        ) *
        ratio,
    };

    const clampedPan = clampPan(nextPan, nextScale);
    updateMapKeySide(clampedPan.x, nextScale);

    dispatch({
      type: 'viewport.set',
      viewport: {
        scale: nextScale,
        panX: clampedPan.x,
        panY: clampedPan.y,
      },
    });
  }

  function fitMap() {
    setMapKeySide(displayedMapKeySide);
    dispatch({ type: 'viewport.fit', scale: minScale });
  }

  useEffect(() => {
  onZoomStateChange?.({
    value:
      Math.min(
        maxScale,
        Math.max(
          minScale,
          scale
        )
      ),

    min:
      minScale,

    max:
      maxScale,

    step:
      zoomStep,

    disabled:
      maxScale <=
      minScale,

    setZoom:
      applyScale,

    fitMap,
  });
}, [
  scale,
  minScale,
  maxScale,
  zoomStep,
]);

  useEffect(() => {
    const element =
      viewportRef.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect =
        element
          .getBoundingClientRect();

      setViewportSize({
        width:
          rect.width,

        height:
          rect.height,
      });
    };

    updateSize();

    const observer =
      new ResizeObserver(
        updateSize
      );

    observer.observe(
      element
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (
      imageSize.width <= 0 ||
      imageSize.height <= 0 ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return;
    }

    const fittedScale =
      Math.max(
        viewportSize.width /
          imageSize.width,

        viewportSize.height /
          imageSize.height
      );

    const nextScale = Math.max(
      fittedScale,
      Math.min(Math.max(1, fittedScale), scale)
    );
    const nextPan = clampPan(pan, nextScale);

    dispatch({
      type: 'viewport.set',
      viewport: {
        scale: nextScale,
        panX: nextPan.x,
        panY: nextPan.y,
      },
    });
  }, [
    viewportSize.width,
    viewportSize.height,
    imageSize.width,
    imageSize.height,
  ]);

  useEffect(() => {
    dispatch({
      type: 'viewport.set',
      viewport: { scale: 1, panX: 0, panY: 0 },
    });

    setImageSize({
      width: 0,
      height: 0,
    });
    cancelViewportInteractions();
    setSectionDraft(null);
    setSectionPointer(null);
    setSectionContextMenu(null);
    setMovingSectionNode(null);
    setEditingSection(null);
  }, [imageUrl, dispatch]);

  useEffect(() => {
    return () => {
      if (edgeScrollFrameRef.current !== null) {
        cancelAnimationFrame(edgeScrollFrameRef.current);
      }
      edgeScrollFrameRef.current = null;
      latestPointerRef.current = null;
      pointerInsideViewportRef.current = false;
      dragRef.current = null;
      popupDragRef.current = null;
      pieceDragRef.current = null;
      piecePreviewRef.current = null;
    };
  }, []);

  useEffect(() => {
    focusCompleteRef.current = onFocusFeatureComplete;
  }, [onFocusFeatureComplete]);

  useEffect(() => {
    if (!state.selectedFeatureId || selectedFeature) return;
    dispatch({ type: 'feature.clearSelection' });
  }, [dispatch, selectedFeature, state.selectedFeatureId]);

  useEffect(() => {
    if (state.editingMode !== 'move-feature') return;

    const movingFeature = features.find((feature) => {
      return feature.id === movingFeatureId;
    });
    const movingLayerIsVisible = movingFeature &&
      (isNavigableFeature(movingFeature)
        ? layerVisibility.locations
        : layerVisibility.features);
    if (movingLayerIsVisible || sections.some((area) => area.kind === 'area' && area.id === movingFeatureId && layerVisibility.areas !== false)) return;
    dispatch({ type: 'featureMove.cancel' });
  }, [
    dispatch,
    features,
    layerVisibility.features,
    layerVisibility.locations,
    layerVisibility.areas,
    sections,
    movingFeatureId,
    state.editingMode,
  ]);  

  useEffect(() => {
    if (state.editingMode !== 'move-feature') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      dispatch({ type: 'featureMove.cancel' });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, state.editingMode]);

    useEffect(() => {
    if (
      interactionPermissions.canAuthorFeatures ||
      state.editingMode !== 'move-feature'
    ) {
      return;
    }

    dispatch({
      type: 'featureMove.cancel',
    });
  }, [
    dispatch,
    interactionPermissions.canAuthorFeatures,
    state.editingMode,
  ]);

  useEffect(() => {
    if (!pendingArrivalPlacement || !onPendingArrivalCancel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onPendingArrivalCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onPendingArrivalCancel, pendingArrivalPlacement]);

  useEffect(() => {
    if (!movingSectionNode && !sectionDraft) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pendingArrivalPlacement) return;
      event.preventDefault();
      if (movingSectionNode) {
        setMovingSectionNode(null);
        return;
      }
      setSectionDraft(null);
      setSectionPointer(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [movingSectionNode, pendingArrivalPlacement, sectionDraft]);

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup || !selectedFeature) return;

    const updatePopupSize = () => {
      const rect = popup.getBoundingClientRect();
      setPopupSize({ width: rect.width, height: rect.height });
    };

    updatePopupSize();
    const observer = new ResizeObserver(updatePopupSize);
    observer.observe(popup);
    return () => observer.disconnect();
  }, [selectedFeature?.id]);

  useEffect(() => {
    if (!focusFeatureId) return;
    if (imageSize.width <= 0 || imageSize.height <= 0) return;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const feature = features.find((item) => item.id === focusFeatureId);
    if (!feature) return;

    const arrivalScale = minScale +
      (maxScale - minScale) * NAVIGATION_ZOOM_RATIO;
    const nextPan = clampPanToViewport(
      {
        x: -feature.position.x * arrivalScale,
        y: -feature.position.y * arrivalScale,
      },
      arrivalScale,
      { width: registeredWidth, height: registeredHeight },
      viewportSize
    );

    dispatch({
      type: 'viewport.set',
      viewport: {
        scale: arrivalScale,
        panX: nextPan.x,
        panY: nextPan.y,
      },
    });
    focusCompleteRef.current?.();
  }, [
    features,
    focusFeatureId,
    imageSize.height,
    imageSize.width,
    maxScale,
    minScale,
    registeredHeight,
    registeredWidth,
    viewportSize.height,
    viewportSize.width,
    viewportSize,
    dispatch,
  ]);

  useEffect(() => {
    if (!onViewportCenterChange || scale <= 0) return;
    onViewportCenterChange({
      x: -pan.x / scale,
      y: -pan.y / scale,
    });
  }, [onViewportCenterChange, pan.x, pan.y, scale]);

  useEffect(() => {
    if (!focusPiecePosition || !focusPieceRequestId) return;
    if (imageSize.width <= 0 || imageSize.height <= 0) return;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const arrivalScale = minScale +
      (maxScale - minScale) * NAVIGATION_ZOOM_RATIO;
    const nextPan = clampPanToViewport(
      {
        x: -focusPiecePosition.x * arrivalScale,
        y: -focusPiecePosition.y * arrivalScale,
      },
      arrivalScale,
      { width: registeredWidth, height: registeredHeight },
      viewportSize
    );

    dispatch({
      type: 'viewport.set',
      viewport: {
        scale: arrivalScale,
        panX: nextPan.x,
        panY: nextPan.y,
      },
    });
    onFocusPieceComplete?.();
  }, [
    dispatch,
    focusPiecePosition,
    focusPieceRequestId,
    imageSize.height,
    imageSize.width,
    maxScale,
    minScale,
    onFocusPieceComplete,
    registeredHeight,
    registeredWidth,
    viewportSize,
  ]);

function clampPopupOffset(offset: Point): Point {
  const distance = Math.hypot(offset.x, offset.y);
  if (distance <= 200) return offset;

  const ratio = 200 / distance;
  return { x: offset.x * ratio, y: offset.y * ratio };
}

function handlePopupPointerDown(
  event: React.PointerEvent<HTMLDivElement>
) {
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.setPointerCapture(event.pointerId);
  popupDragRef.current = {
    pointerId: event.pointerId,
    target: event.currentTarget,
    startPointer: { x: event.clientX, y: event.clientY },
    startOffset: popupOffset,
  };
}

function handlePopupPointerMove(
  event: React.PointerEvent<HTMLDivElement>
) {
  const drag = popupDragRef.current;
  if (!drag || drag.pointerId !== event.pointerId) return;

  const offset = clampPopupOffset({
    x: drag.startOffset.x + event.clientX - drag.startPointer.x,
    y: drag.startOffset.y + event.clientY - drag.startPointer.y,
  });
  dispatch({ type: 'featurePopup.setOffset', offset });
}

function endPopupDrag(event: React.PointerEvent<HTMLDivElement>) {
  if (popupDragRef.current?.pointerId !== event.pointerId) return;

  popupDragRef.current = null;
  releasePointerCaptureSafely(event.currentTarget, event.pointerId);
}

function cancelPopupDrag() {
  popupDragRef.current = null;
}

function handlePathPopupPointerDown(
  event: React.PointerEvent<HTMLDivElement>
) {
  if (event.button !== 0) return;

  event.preventDefault();
  event.stopPropagation();

  event.currentTarget.setPointerCapture(
    event.pointerId
  );

  pathPopupDragRef.current = {
    pointerId: event.pointerId,
    target: event.currentTarget,
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startOffset: pathPopupOffset,
  };
}

function handlePathPopupPointerMove(
  event: React.PointerEvent<HTMLDivElement>
) {
  const drag =
    pathPopupDragRef.current;

  if (
    !drag ||
    drag.pointerId !== event.pointerId
  ) {
    return;
  }

  setPathPopupOffset(
    clampPopupOffset({
      x:
        drag.startOffset.x +
        event.clientX -
        drag.startPointer.x,

      y:
        drag.startOffset.y +
        event.clientY -
        drag.startPointer.y,
    })
  );
}

function endPathPopupDrag(
  event: React.PointerEvent<HTMLDivElement>
) {
  if (
    pathPopupDragRef.current?.pointerId !==
    event.pointerId
  ) {
    return;
  }

  pathPopupDragRef.current = null;

  releasePointerCaptureSafely(
    event.currentTarget,
    event.pointerId
  );
}

function cancelPathPopupDrag() {
  pathPopupDragRef.current = null;
}

function getSectionOwner(edgeOrNodeId: string) {
  return sections.find((section) => {
    return section.edgeIds.some((edgeId) => {
      if (edgeId === edgeOrNodeId) return true;
      const edge = sectionEdges.find((item) => item.id === edgeId);
      return edge?.startNodeId === edgeOrNodeId ||
        edge?.endNodeId === edgeOrNodeId;
    });
  });
}

function getEditableSectionOwner(edgeOrNodeId: string) {
  return editableSections.find((section) => {
    return section.edgeIds.some((edgeId) => {
      if (edgeId === edgeOrNodeId) return true;
      const edge = sectionEdges.find((item) => item.id === edgeId);
      return edge?.startNodeId === edgeOrNodeId ||
        edge?.endNodeId === edgeOrNodeId;
    });
  });
}

function appendDraftNode(position: SectionPoint, existingNode?: SectionNode) {
  if (!sectionMode) return;
  if (sectionMode === 'boundary' && !parentMapId) {
    onSectionError?.('Assign a parent Map before drawing a Boundary.');
    return;
  }
  const boundaryExists = sections.some((section) => {
    return section.kind === 'boundary';
  });
  if (sectionMode === 'boundary' && boundaryExists) return;
  if (!sectionDraft) {
    const node: SectionNode = existingNode ?? {
      id: crypto.randomUUID(),
      mapId,
      position,
    };
    setSectionDraft({
      kind: sectionMode,
      sectionId: crypto.randomUUID(),
      nodes: [node],
      edges: [],
    });
    return;
  }
  if (existingNode && sectionDraft.nodes.some((node) => node.id === existingNode.id)) {
    if (existingNode.id === sectionDraft.nodes[0].id) completeSectionDraft();
    return;
  }
  const previous = sectionDraft.nodes.at(-1);
  if (!previous) return;
  const node: SectionNode = existingNode ?? {
    id: crypto.randomUUID(),
    mapId: previous.mapId,
    position,
  };
  if (sectionMode === 'area') {
    const error = validateAreaSegment(previous, node, [...sectionEdges, ...sectionDraft.edges],
      [...sectionNodes, ...sectionDraft.nodes]);
    if (error) { onSectionError?.(error); return; }
  }
  const edge: SectionEdge = editableEdges.find((item) =>
    (item.startNodeId === previous.id && item.endNodeId === node.id) ||
    (item.endNodeId === previous.id && item.startNodeId === node.id)
  ) ?? {
    id: crypto.randomUUID(),
    mapId: previous.mapId,
    startNodeId: previous.id,
    endNodeId: node.id,
  };
  const draft = {
    ...sectionDraft,
    nodes: [...sectionDraft.nodes, node],
    edges: [...sectionDraft.edges, edge],
  };
  if (sectionMode === 'area' && existingNode &&
      draft.edges.some((item) => !sectionEdges.some((saved) => saved.id === item.id))) {
    const path = findAreaReturnPath(draft.nodes, draft.edges, editableEdges);
    if (path) {
      const allNodes = new Map([...sectionNodes, ...draft.nodes].map((item) => [item.id, item]));
      const edges = [...draft.edges, ...path];
      const nodeIds = new Set(edges.flatMap((item) => [item.startNodeId, item.endNodeId]));
      saveSectionDraft(draft, edges, [...allNodes.values()].filter((item) => nodeIds.has(item.id)));
      return;
    }
  }
  setSectionDraft(draft);
}

function saveSectionDraft(
  draft: NonNullable<typeof sectionDraft>, edges: SectionEdge[], nodes: SectionNode[]
) {
  const defaults = SECTION_DEFAULTS[draft.kind];
  const now = new Date();
  onCreateSection?.({
    id: draft.sectionId, mapId, kind: draft.kind,
    name: defaults.name, color: defaults.color,
    edgeIds: edges.map((edge) => edge.id), createdAt: now, updatedAt: now,
  }, nodes, edges);
  setSectionDraft(null);
  setSectionPointer(null);
}

function completeSectionDraft() {
  if (!sectionDraft || sectionDraft.nodes.length < 3) return;
  const boundaryExists = sections.some((section) => {
    return section.kind === 'boundary';
  });
  if (sectionDraft.kind === 'boundary' && boundaryExists) {
    setSectionDraft(null);
    setSectionPointer(null);
    return;
  }
  const origin = sectionDraft.nodes[0];
  const last = sectionDraft.nodes.at(-1);
  if (!last) return;
  if (sectionDraft.kind === 'area') {
    const error = validateAreaSegment(last, origin, [...sectionEdges, ...sectionDraft.edges],
      [...sectionNodes, ...sectionDraft.nodes]);
    if (error) { onSectionError?.(error); return; }
  }
  const closingEdge: SectionEdge = editableEdges.find((item) =>
    (item.startNodeId === last.id && item.endNodeId === origin.id) ||
    (item.endNodeId === last.id && item.startNodeId === origin.id)
  ) ?? {
    id: crypto.randomUUID(),
    mapId: origin.mapId,
    startNodeId: last.id,
    endNodeId: origin.id,
  };
  const edges = [...sectionDraft.edges, closingEdge];
  saveSectionDraft(sectionDraft, edges, sectionDraft.nodes);
}

function deleteSectionNode(nodeId: string) {
  const owner = getEditableSectionOwner(nodeId);
  if (!owner) return;
  if (owner.edgeIds.length <= 3) {
    onSectionError?.('A Section requires at least three nodes.');
    return;
  }
  const ownerEdges = owner.edgeIds.map((id) => {
    return sectionEdges.find((edge) => edge.id === id);
  }).filter((edge): edge is SectionEdge => Boolean(edge));
  const orderedNodes = getSectionNodeIds(owner, sectionEdges);
  const nodeIndex = orderedNodes.indexOf(nodeId);
  if (nodeIndex < 0) return;
  const incoming = ownerEdges[(nodeIndex + ownerEdges.length - 1) % ownerEdges.length];
  const outgoing = ownerEdges[nodeIndex];
  if (!incoming || !outgoing) return;
  const shared = sections.some((section) => {
    return section.id !== owner.id &&
      section.edgeIds.some((id) => {
        const edge = sectionEdges.find((item) => item.id === id);
        return edge?.startNodeId === nodeId || edge?.endNodeId === nodeId;
      });
  });
  if (shared) {
    onSectionError?.('A shared Section node cannot be deleted yet.');
    return;
  }
  const replacement: SectionEdge = {
    id: crypto.randomUUID(),
    mapId: incoming.mapId,
    startNodeId: orderedNodes[(nodeIndex + orderedNodes.length - 1) % orderedNodes.length],
    endNodeId: orderedNodes[(nodeIndex + 1) % orderedNodes.length],
  };
  const removeIds = new Set([incoming.id, outgoing.id]);
  const insertAt = owner.edgeIds.indexOf(incoming.id);
  const nextEdgeIds = owner.edgeIds.filter((id) => !removeIds.has(id));
  nextEdgeIds.splice(insertAt, 0, replacement.id);
  onUpdateSectionData?.(
    sections.map((section) => section.id === owner.id
      ? { ...section, edgeIds: nextEdgeIds, updatedAt: new Date() }
      : section),
    sectionNodes.filter((node) => node.id !== nodeId),
    [...sectionEdges.filter((edge) => !removeIds.has(edge.id)), replacement]
  );
  setSectionContextMenu(null);
}

function addNodeToEdge(edgeId: string, position: SectionPoint) {
  if (!getEditableSectionOwner(edgeId)) return;
  const edge = sectionEdges.find((item) => item.id === edgeId);
  if (!edge) return;
  const node: SectionNode = {
    id: crypto.randomUUID(),
    mapId: edge.mapId,
    position,
  };
  const first: SectionEdge = {
    ...edge,
    id: crypto.randomUUID(),
    endNodeId: node.id,
  };
  const second: SectionEdge = {
    ...edge,
    id: crypto.randomUUID(),
    startNodeId: node.id,
  };
  onUpdateSectionData?.(
    sections.map((section) => {
      const index = section.edgeIds.indexOf(edgeId);
      if (index < 0) return section;
      const edgeIds = [...section.edgeIds];
      const forward = getSectionNodeIds(section, sectionEdges)[index] === edge.startNodeId;
      edgeIds.splice(index, 1, ...(forward ? [first.id, second.id] : [second.id, first.id]));
      return { ...section, edgeIds, updatedAt: new Date() };
    }),
    [...sectionNodes, node],
    [...sectionEdges.filter((item) => item.id !== edgeId), first, second]
  );
  setSectionContextMenu(null);
}

function startSectionFromEdge(edgeId: string) {
  const edge = sectionEdges.find((item) => item.id === edgeId);
  const owner = getEditableSectionOwner(edgeId);
  if (!edge || !owner) return;
  const kind = owner.kind === 'area' || owner.kind === 'border'
    ? owner.kind
    : sectionMode;
  if (!kind) return;
  const start = sectionNodes.find((node) => node.id === edge.startNodeId);
  const end = sectionNodes.find((node) => node.id === edge.endNodeId);
  if (!start || !end) return;
  const draft = {
    kind,
    sectionId: crypto.randomUUID(),
    nodes: [start, end],
    edges: [edge],
    attachedEdgeId: edge.id,
  };
  if (kind === sectionMode) {
    setSectionDraft(draft);
  } else {
    onSectionModeChange?.(kind);
    requestAnimationFrame(() => setSectionDraft(draft));
  }
  setSectionContextMenu(null);
}

function cancelRouteAuthoring()
{
  setRouteFinishPending(false);
  distanceMeasurement.clear();
  setRoutePieceId(null);
  setDistancePointer(null);
}

function finishRouteAuthoring() {
  if (routePieceId === null) {
    return;
  }

  const piece = pieces.find(
    (candidate) =>
      candidate.id === routePieceId
  );

  if (!piece) {
    distanceMeasurement.clear();
    setRoutePieceId(null);
    setDistancePointer(null);
    return;
  }

  const routeMaps = new Map<string, RegionMap>();

  for (const candidate of locationMaps)
  {
    routeMaps.set(
      candidate.id,
      candidate
    );
  }

  routeMaps.set(
    map.id,
    map
  );

  const spatialMaps = [...routeMaps.values()];

  const nodes: RouteNode[] = [];
const routeAnchors =
  distanceSegments.length > 0
    ? [
        distanceSegments[0].start,
        ...distanceSegments.map(
          (segment) =>
            segment.end
        ),
      ]
    : resolvedDistanceAnchors;

for (
  const resolved of
    routeAnchors
) {
  const anchor = resolved.anchor;
  switch (anchor.kind) {
    case 'temporary':
      nodes.push({
        id: crypto.randomUUID(),
        mapId,
        source: {
          moduleId: 'Regions',
          type: 'route-point',
        },
        kind: 'point',
        position: anchor.position,
        usePathFromPrevious:
          anchor.usePathFromPrevious,
      });
      break;

    case 'feature':
      nodes.push({
        id: crypto.randomUUID(),
        mapId,
        source: {
          moduleId: 'Regions',
          type: 'feature',
          referenceId: anchor.featureId,
        },
        kind: 'feature',
        featureId: anchor.featureId,
        usePathFromPrevious:
          anchor.usePathFromPrevious,
      });
      break;

    case 'path': {
  const pathSegment =
    resolvedPathSegments.find(
      (segment) =>
        segment.segment.id ===
        anchor.segmentId
    );

  const position =
    pathSegment
      ? projectPointOntoPathDock(
          pathSegment,
          anchor.position
        ).position
      : anchor.position;

  nodes.push({
    id: crypto.randomUUID(),
    mapId,
    source: {
      moduleId: 'Regions',
      type: 'path',
      referenceId: anchor.segmentId,
    },
    kind: 'path',
    segmentId: anchor.segmentId,
    position,
    usePathFromPrevious:
      anchor.usePathFromPrevious,
  });

  break;
}

    case 'terminal':
      nodes.push({
        id: crypto.randomUUID(),
        mapId,
        source: {
          moduleId: 'Regions',
          type: 'path-terminal',
          referenceId: anchor.terminalId,
        },
        kind: 'terminal',
        terminalId: anchor.terminalId,
        usePathFromPrevious:
          anchor.usePathFromPrevious,
      });
      break;

    case 'piece':
      break;
  }
}

const legProfiles: RouteLegProfile[] = [];

for (
  let index = 0;
  index < distanceSegments.length;
  index += 1
)
{
  const segment =
    distanceSegments[index];

  const startNode =
    nodes[index];

  const endNode =
    nodes[index + 1];

  if (!startNode || !endNode)
  {
    continue;
  }

  const distance =
    convertMapDistance(
      segment.mapDistance,
      imageRegistration?.distanceScale
    );

  if (!distance)
  {
    continue;
  }

    let mapDistanceFromStart = 0;

  const points: RouteLegProfile['points'] =
    [];

  const addTraversalPoint = (
    position: {
      x: number;
      y: number;
    },
    distanceFromStart: number,
    sectorCrossing?:
      RouteTraversalPoint['sectorCrossing']
  ) =>
  {
    const spatialContext =
      resolveSpatialContext(
        mapId,
        position,
        spatialMaps,
        projectFeatures,
        projectSections,
        projectSectionEdges,
        projectSectionNodes,
        OVERWORLD_SECTOR_RESOLUTION
      );

    points.push({
      mapId,
      position,
      distanceFromLegStart:
        convertMapDistance(
          distanceFromStart,
          imageRegistration
            ?.distanceScale
        ) ?? {
          value: 0,
          unit: distance.unit,
        },
      ...(spatialContext
        ? { spatialContext }
        : {}),
      ...(sectorCrossing
        ? { sectorCrossing }
        : {}),
    });
  };

  for (
    let pointIndex = 0;
    pointIndex < segment.points.length;
    pointIndex += 1
  )
  {
    const position =
      segment.points[pointIndex];

    if (pointIndex === 0)
    {
      addTraversalPoint(
        position,
        0
      );

      continue;
    }

    const previous =
      segment.points[
        pointIndex - 1
      ];

    const segmentMapDistance =
      Math.hypot(
        position.x - previous.x,
        position.y - previous.y
      );

    const worldStart =
      resolveWorldPosition(
        mapId,
        previous,
        spatialMaps,
        projectFeatures
      );

    const worldEnd =
      resolveWorldPosition(
        mapId,
        position,
        spatialMaps,
        projectFeatures
      );

    if (
      worldStart &&
      worldEnd &&
      worldStart.mapId === worldEnd.mapId
    )
    {
      const worldMap =
        spatialMaps.find(
          (candidate) =>
            candidate.id ===
            worldStart.mapId
        );

      const worldDistanceScale =
        worldMap
          ?.imageRegistration
          ?.distanceScale;

      if (worldDistanceScale)
      {
        const crossings =
          findSectorCrossings(
            worldStart,
            worldEnd,
            worldDistanceScale,
            OVERWORLD_SECTOR_RESOLUTION
          );

        for (const crossing of crossings)
        {
          const crossingPosition = {
            x:
              previous.x +
              (
                position.x -
                  previous.x
              ) *
              crossing.fraction,
            y:
              previous.y +
              (
                position.y -
                  previous.y
              ) *
              crossing.fraction,
          };

          const epsilon = 0.000001;

          const beforeFraction =
            Math.max(
              0,
              crossing.fraction - epsilon
            );

          const afterFraction =
            Math.min(
              1,
              crossing.fraction + epsilon
            );

          const beforeContext =
            resolveSpatialContext(
              mapId,
              {
                x:
                  previous.x +
                  (
                    position.x -
                      previous.x
                  ) *
                  beforeFraction,
                y:
                  previous.y +
                  (
                    position.y -
                      previous.y
                  ) *
                  beforeFraction,
              },
              spatialMaps,
              projectFeatures,
              projectSections,
              projectSectionEdges,
              projectSectionNodes,
              OVERWORLD_SECTOR_RESOLUTION
            );

          const afterContext =
            resolveSpatialContext(
              mapId,
              {
                x:
                  previous.x +
                  (
                    position.x -
                      previous.x
                  ) *
                  afterFraction,
                y:
                  previous.y +
                  (
                    position.y -
                      previous.y
                  ) *
                  afterFraction,
              },
              spatialMaps,
              projectFeatures,
              projectSections,
              projectSectionEdges,
              projectSectionNodes,
              OVERWORLD_SECTOR_RESOLUTION
            );

          addTraversalPoint(
            crossingPosition,
            mapDistanceFromStart +
              segmentMapDistance *
                crossing.fraction,
            beforeContext &&
            afterContext &&
            (
              beforeContext.sector.worldMapId !==
                afterContext.sector.worldMapId ||
              beforeContext.sector.x !==
                afterContext.sector.x ||
              beforeContext.sector.y !==
                afterContext.sector.y
            )
              ? {
                  from: beforeContext.sector,
                  to: afterContext.sector,
                }
              : undefined
          );
        }
      }
    }

    mapDistanceFromStart += segmentMapDistance;

    addTraversalPoint(
      position,
      mapDistanceFromStart
    );
  }

  const spatialContext = points[0]?.spatialContext;

const area =
  spatialContext?.areaId
    ? projectSections.find(
        (section) =>
          section.id === spatialContext.areaId
      )
    : undefined;

const pathSegment =
  segment.pathSegmentId
    ? pathNetwork.segments.find(
        (candidate) =>
          candidate.id === segment.pathSegmentId
      )
    : undefined;

legProfiles.push({
  legId: `${startNode.id}:${endNode.id}`,
  distance,

  ...(area
    ? {
        area: {
          id: area.id,
          ...(area.rulesetData
            ? {
                rulesetData:
                  area.rulesetData,
              }
            : {}),
        },
      }
    : {}),

  ...(pathSegment
    ? {
        path: {
          id: pathSegment.id,
          type: pathSegment.type,
          ...(pathSegment.rulesetData
            ? {
                rulesetData:
                  pathSegment.rulesetData,
              }
            : {}),
        },
      }
    : {}),

  points,
});
}

for (
  let index = 0;
  index < legProfiles.length;
  index += 1
)
{
  const profile = legProfiles[index];

  const nextProfile = legProfiles[index + 1];

  const endNode = nodes[index + 1];

  if (!profile || !endNode)
  {
    continue;
  }

  const endpoint:
    RouteLegProfile['endpoint'] = {};

  if (endNode.kind === 'feature')
  {
    endpoint.featureId = endNode.featureId;
  }

  const currentAreaId = profile.area?.id;

  const nextAreaId = nextProfile?.area?.id;

  if (
    currentAreaId !== nextAreaId
  )
  {
    if (currentAreaId)
    {
      endpoint.leavingAreaId = currentAreaId;
    }

    if (nextAreaId)
    {
      endpoint.enteringAreaId = nextAreaId;
    }
  }

  const currentPathId = profile.path?.id;

  const nextPathId = nextProfile?.path?.id;

  if (
    currentPathId !== nextPathId
  )
  {
    if (currentPathId)
    {
      endpoint.leavingPathId = currentPathId;
    }

    if (nextPathId)
    {
      endpoint.enteringPathId = nextPathId;
    }
  }

  if (Object.keys(endpoint).length > 0)
  {
    profile.endpoint = endpoint;
  }
}

  if (nodes.length > 0) {
    onSetPieceRoute?.(
      piece,
      nodes,
      legProfiles
    );
  }

  distanceMeasurement.clear();
  setRoutePieceId(null);
  setDistancePointer(null);
}

useEffect(() =>
{
  if (!routeFinishPending)
  {
    return;
  }

  setRouteFinishPending(false);
  finishRouteAuthoring();
}, [routeFinishPending, distanceMeasurement.anchors]);

function handleContextMenu(
  event: React.MouseEvent<HTMLDivElement>
) {
  event.preventDefault();

if (interactionMode === 'path') 
{
  const point =
    screenToMap(
      event.clientX,
      event.clientY
    );

  if (
    point &&
    isPointInsideMap(point) &&
    pathInteraction.draft
  ) 
  {
    pathInteraction.handleShapeIntent(point);
  }

  setPieceContextMenu(null);
  setSectionContextMenu(null);

  dispatch({
    type: 'contextMenu.close',
  });

  return;
}

if (routePieceId !== null)
{
  cancelRouteAuthoring();

  setPieceContextMenu(null);
  setSectionContextMenu(null);

  dispatch({
    type: 'contextMenu.close',
  });

  return;
}

if (interactionMode === 'distance')
{
  distanceMeasurement.clear();
  setDistancePointer(null);
  setPieceContextMenu(null);
  setSectionContextMenu(null);

  dispatch({
    type: 'contextMenu.close',
  });

  return;
}

  if (pendingArrivalPlacement) return;
  if (state.editingMode === 'move-feature') return;
  setPieceContextMenu(null);

dispatch({
  type: 'feature.clearSelection',
});
setSelectedPieceId(null);
setSelectedPathSegment(null);
dispatch({
  type: 'contextMenu.close',
});

  const viewport = viewportRef.current;

  if (!viewport)
  {
    return;
  }

  const point =
    screenToMap(
      event.clientX,
      event.clientY
    );

  if (!point)
  {
    return;
  }

  if (!isPointInsideMap(point)) return;

  const rect = viewport.getBoundingClientRect();

  const edge = editableEdges.find((candidate) => {
    const start = displayedSectionNodes.find((node) => {
      return node.id === candidate.startNodeId;
    });
    const end = displayedSectionNodes.find((node) => {
      return node.id === candidate.endNodeId;
    });
    if (!start || !end) return false;
    return pointToSegmentDistance(point, start.position, end.position) <=
      8 / scale;
  });
  if (edge) 
  {
    const start = displayedSectionNodes.find((node) => {
      return node.id === edge.startNodeId;
    });
    const end = displayedSectionNodes.find((node) => {
      return node.id === edge.endNodeId;
    });
    if (start && end)
    {
      setSectionContextMenu({
        kind: 'edge',
        id: edge.id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        point: closestPointOnSegment(point, start.position, end.position),
      });
      return;
    }
  }
    setSectionContextMenu(null);

  if (interactionMode !== 'build')
  {
    return;
  }

  dispatch({
    type: 'contextMenu.open',
    menu: {
      kind: 'map',
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
      mapX: point.x,
      mapY: point.y,
    },
  });
}

  function handleWheel(
    event: React.WheelEvent<HTMLDivElement>
  ) {
    const viewport = event.currentTarget;
    const underPointer = viewport.ownerDocument.elementFromPoint(event.clientX, event.clientY);
    const controls = '.dialog-backdrop, .dialog, [role="dialog"], .feature-popup, ' +
      '.map-context-menu, .map-key, .boundary-alignment-panel, ' +
      'input, select, textarea, [contenteditable="true"]';
    if (!underPointer || !viewport.contains(underPointer) || underPointer.closest(controls)) return;
    // A focused control can receive wheel events even when the pointer is elsewhere.
    if (event.target instanceof Element && event.target.closest(controls)) return;
    if (event.deltaY === 0) return;
    event.preventDefault();
    dispatch({ type: 'contextMenu.close' });

    const zoomFactor =
      event.deltaY < 0
        ? 1.1
        : 1 / 1.1;

    applyScale(
      scale *
        zoomFactor,
      {
        x: event.clientX,
        y: event.clientY,
      }
    );
  }

  function addDistanceAreaCrossings(destination: Point)
  {
  const resolved =
    resolveDistanceAnchors(
      distanceMeasurement.anchors,
      features,
      pieces,
      pathNetwork.terminals
    );

  const previous = resolved.at(-1);

  if (!previous)
  {
    return;
  }

  const crossings =
    findNavigationAreaCrossings(
      previous.position,
      destination,
      sections,
      sectionEdges,
      sectionNodes
    );

  for (const crossing of crossings)
  {
    distanceMeasurement.addPoint(crossing.position);
  }
}

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>)
  {
    if (
      distanceInteractionActive &&
      event.button === 0
    ) {
      const target = event.target;

      const mapBackground =
        target === event.currentTarget ||
        target instanceof HTMLImageElement;

      if (mapBackground)
      {
        const point = screenToMap(
          event.clientX,
          event.clientY
        );

        if (
          point &&
          isPointInsideMap(point)
        )
        {
          event.preventDefault();
          addDistanceAreaCrossings(point);
          distanceMeasurement.addPoint(point);

          if (
            routePieceId !== null &&
            event.shiftKey
          )
          {
            setRouteFinishPending(true);
          }
        }

        return;
      }
    }

    if (
      interactionMode === 'path' &&
      event.button === 0 &&
      event.ctrlKey
    ) {
      const target = event.target;

      const mapBackground =
        target === event.currentTarget ||
        target instanceof HTMLImageElement;

    if (mapBackground) {
      const point = screenToMap(
        event.clientX,
        event.clientY
      );

    if (
      point &&
      isPointInsideMap(point)
    ) {
      event.preventDefault();

      void pathInteraction
        .handleTerminalIntent(
          point
        );
    }

    return;
  }
}

       if (
    calibrationActive &&
    event.button === 0
  ) {
    const point =
      screenToMap(
        event.clientX,
        event.clientY
      );

    if (
      point &&
      isPointInsideMap(point)
    ) {
      onCalibrationPoint?.(
        point
      );
    }

    return;
  }
    trackEdgePointer(event.clientX, event.clientY);
    if (event.button === 0) {
      dispatch({ type: 'contextMenu.close' });
      setPieceContextMenu(null);
      setSectionContextMenu(null);
    }
    if (event.button === 0 && pendingArrivalPlacement) {
      const point = screenToMap(event.clientX, event.clientY);
      if (!point || !isPointInsideMap(point)) return;
      event.preventDefault();
      onPendingArrivalCommit?.(point);
      return;
    }
    if (event.button === 0 && state.editingMode === 'move-feature') {
      const point = screenToMap(event.clientX, event.clientY);
      if (!point || !movingFeatureId) return;
      dispatch({ type: 'featureMove.preview', position: point });
      if (!isMovePositionValid(point)) return;
      suppressNextFeatureClickRef.current = true;
      if (sections.some((area) => area.kind === 'area' && area.id === movingFeatureId)) updateAreaIdentity(movingFeatureId, { controlPosition: point });
      else onFeatureMove?.(movingFeatureId, point);
      dispatch({ type: 'featureMove.cancel' });
      return;
    }
    if (event.button === 0 && movingSectionNode) {
      const point = screenToMap(event.clientX, event.clientY);
      if (!point || !isPointInsideMap(point)) return;
      onUpdateSectionData?.(
        sections,
        sectionNodes.map((node) => node.id === movingSectionNode.nodeId
          ? { ...node, position: point }
          : node),
        sectionEdges
      );
      setMovingSectionNode(null);
      return;
    }
    const target = event.target;
    const mapBackground = target === event.currentTarget ||
      target instanceof HTMLImageElement;
    if (event.button === 0 && sectionMode && mapBackground) {
      const point = screenToMap(event.clientX, event.clientY);
      if (!point || !isPointInsideMap(point)) return;
      const boundary = sections.find((section) => {
        return section.kind === 'boundary';
      });
      if (sectionMode === 'boundary' && boundary) {
        const boundaryEdges = boundary.edgeIds
          .map((id) => sectionEdges.find((edge) => edge.id === id))
          .filter((edge): edge is SectionEdge => Boolean(edge));
        const closest = boundaryEdges.map((edge) => {
          const start = displayedSectionNodes.find((node) => {
            return node.id === edge.startNodeId;
          });
          const end = displayedSectionNodes.find((node) => {
            return node.id === edge.endNodeId;
          });
          if (!start || !end) return null;
          return {
            edge,
            distance: pointToSegmentDistance(
              point,
              start.position,
              end.position
            ),
            position: closestPointOnSegment(
              point,
              start.position,
              end.position
            ),
          };
        }).filter((match): match is NonNullable<typeof match> => {
          return match !== null;
        }).sort((a, b) => a.distance - b.distance)[0];
        if (closest && closest.distance <= 8 / scale) {
          event.preventDefault();
          addNodeToEdge(closest.edge.id, closest.position);
        }
        return;
      }
      appendDraftNode(point);
      return;
    }

    if (event.button !== 0 && event.button !== 1) return;

    if (editingName) {
      saveName();
    }

    if (editingSubtitle) {
      saveSubtitle();
    }

    dispatch({ type: 'feature.clearSelection' });
    setSelectedPathSegment(null);

    dispatch({ type: 'contextMenu.close' });
    setPieceContextMenu(null);
    setSectionContextMenu(null);

    if (event.button === 0) return;

    event.preventDefault();
    event.stopPropagation();
    stopEdgeScrolling();

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );

    dragRef.current = {
      pointerId:
        event.pointerId,
      target: event.currentTarget,

      startPointer: {
        x:
          event.clientX,

        y:
          event.clientY,
      },

      startPan:
        pan,
    };

    setDragging(
      true
    );
  }

  function handlePointerMove(
    event:
      React.PointerEvent<HTMLDivElement>
  ) {
    trackEdgePointer(
  event.clientX,
  event.clientY
);

if (interactionMode === 'path') {
  const point =
    screenToMap(
      event.clientX,
      event.clientY
    );

  setPathPointer(
    point &&
    isPointInsideMap(point)
      ? point
      : null
  );

  if (
    pathDragPreview?.pointerId ===
      event.pointerId &&
    point &&
    isPointInsideMap(point)
  ) 
  {
    const moved =
      pathDragPreview.moved ||
      Math.hypot(
        event.clientX - pathDragPreview.startClientX,
        event.clientY - pathDragPreview.startClientY
      ) >= 4;

    setPathDragPreview({
      ...pathDragPreview,
      position: point,
      moved,
    });

    return;
  }
}

if (distanceInteractionActive)
{
  const viewport = viewportRef.current;

  if (viewport) 
  {
    const rect = viewport.getBoundingClientRect();

    setDistancePointer({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }
}
    if (sectionMode || movingSectionNode)
    {
      const point = screenToMap(event.clientX, event.clientY);
      setSectionPointer(point);
      if (point && movingSectionNode) 
      {
        setMovingSectionNode({ ...movingSectionNode, position: point });
      }
    }
    if (pendingArrivalPlacement)
    {
      const point = screenToMap(event.clientX, event.clientY);
      if (point) 
      {
        setArrivalPreviewState({ key: arrivalPlacementKey, position: point });
      }
    }
    if (state.editingMode === 'move-feature')
    {
      const point = screenToMap(event.clientX, event.clientY);
      if (point) dispatch({ type: 'featureMove.preview', position: point });
      return;
    }

    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) 
    {
      return;
    }

    const nextPan = {
      x: drag.startPan.x +
        (
          event.clientX - drag.startPointer.x
        ),

      y: drag.startPan.y +
        (
          event.clientY - drag.startPointer.y
        ),
    };

    const clampedPan = clampPan(nextPan);
    updateMapKeySide(clampedPan.x, scale);

    dispatch({
      type: 'viewport.setPan',
      panX: clampedPan.x,
      panY: clampedPan.y,
    });
  }

  function endDrag(
    event:
      React.PointerEvent<HTMLDivElement>
    ) {
    if (
      dragRef.current
        ?.pointerId !==
      event.pointerId
    ) {
      return;
    }

    dragRef.current =
      null;

    setDragging(
      false
    );

    releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    scheduleEdgeScrolling();
  }

  function cancelMapDrag() {
    dragRef.current = null;
    setDragging(false);
    stopEdgeScrolling();
  }

   function handlePiecePointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
    piece: Piece
  ) {
    if (event.button !== 0) {
      return;
    }

    if (distanceInteractionActive) {
      event.preventDefault();
      event.stopPropagation();

      distanceMeasurement.addPiece(
        piece.id
      );

      return;
    }

    if (!interactionPermissions.canManipulatePieces)
    {
      return;
    }
    if (interactionMode === 'explore')
    {
      setSelectedPieceId(
        piece.id
      );

      dispatch({
        type: 'feature.clearSelection',
      });

      setSelectedPathSegment(null);
    }
    event.preventDefault();
    event.stopPropagation();
    setPieceContextMenu(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    trackEdgePointer(event.clientX, event.clientY);
    const pointerMap = screenToMap(event.clientX, event.clientY);
    pieceDragRef.current = {
      pieceId: piece.id,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startPointer: { x: event.clientX, y: event.clientY },
      startPosition: piece.position,
      lastPosition: piece.position,
      grabOffset: {
        x: piece.position.x - (pointerMap?.x ?? piece.position.x),
        y: piece.position.y - (pointerMap?.y ?? piece.position.y),
      },
      moved: false,
    };
    const preview = { pieceId: piece.id, position: piece.position };
    piecePreviewRef.current = preview;
    setPiecePreview(preview);
  }

  function handlePiecePointerMove(
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    const drag = pieceDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || scale <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    trackEdgePointer(event.clientX, event.clientY);
    const pointerMap = screenToMap(event.clientX, event.clientY);
    if (!pointerMap) return;
    const position = {
      x: pointerMap.x + drag.grabOffset.x,
      y: pointerMap.y + drag.grabOffset.y,
    };
    drag.moved = drag.moved || Math.hypot(
  event.clientX - drag.startPointer.x,
  event.clientY - drag.startPointer.y
) > 2;
const mapBoundary =
  sections.find(
    (section) =>
      section.kind === 'boundary' &&
      section.edgeIds.length >= 3
  );

if (
  mapBoundary &&
  parentMapId
) {
  const polygon =
    getSectionPolygon(
      mapBoundary,
      sectionEdges,
      sectionNodes
    );

  const wasInside =
    isPointInPolygon(
      drag.lastPosition,
      polygon
    );

  const isInside =
    isPointInPolygon(
      position,
      polygon
    );

  if (
    wasInside &&
    !isInside
  ) {
    const crossing =
      findFirstPolygonBoundaryIntersection(
        drag.lastPosition,
        position,
        polygon
      );

    if (crossing) {
      const boundaryPosition =
        crossing.position;

      pieceDragRef.current = null;
      piecePreviewRef.current = null;
      setPiecePreview(null);

      releasePointerCaptureSafely(
        event.currentTarget,
        event.pointerId
      );

      stopEdgeScrolling();

      onPieceBoundaryExitRequest?.(
        drag.pieceId,
        boundaryPosition
      );

      return;
    }
  }
}
const boundaryCrossing =
  findFirstNavigationBoundaryCrossing(
    drag.lastPosition,
    position,
    sections,
    sectionEdges,
    sectionNodes
  );

if (boundaryCrossing) {
  const boundaryPosition =
    boundaryCrossing.position;

  pieceDragRef.current = null;
  piecePreviewRef.current = null;
  setPiecePreview(null);

  releasePointerCaptureSafely(
    event.currentTarget,
    event.pointerId
  );

  stopEdgeScrolling();

  onPieceAreaBoundaryEnterRequest?.(
    drag.pieceId,
    boundaryCrossing.area,
    boundaryPosition
  );

  return;
}

drag.lastPosition = position;

const preview = {
  pieceId: drag.pieceId,
  position,
};
    piecePreviewRef.current = preview;
    setPiecePreview(preview);
  }

  function handlePiecePointerUp(
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    const drag = pieceDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const preview = piecePreviewRef.current?.pieceId === drag.pieceId
      ? piecePreviewRef.current.position
      : drag.startPosition;const acquiredNode =
  pieceNodeTarget?.kind === 'route'
    ? (() => {
        const draggedRoute =
  getPieceRoute(drag.pieceId);

if (!draggedRoute) {
  return pieceNodeTarget;
}

        const previewScreen =
          mapToScreen(
            preview.x,
            preview.y
          );

        const routeAnchors =
         resolveDistanceAnchors(
            routeNodesToDistanceAnchors(draggedRoute.nodes),
            features,
            pieces,
            pathNetwork.terminals
          );

        const closest =
          routeAnchors.reduce<{
            kind: 'route';
            id: string;
            position: Point;
            distance: number;
          } | null>(
            (currentClosest, anchor) => {
              const targetScreen =
                mapToScreen(
                  anchor.position.x,
                  anchor.position.y
                );

              const distance =
                Math.hypot(
                  previewScreen.x -
                    targetScreen.x,
                  previewScreen.y -
                    targetScreen.y
                );

              if (
                distance >
                NODE_SNAP_DISTANCE
              ) {
                return currentClosest;
              }

              if (
                currentClosest &&
                currentClosest.distance <=
                  distance
              ) {
                return currentClosest;
              }

              return {
                kind: 'route',
                id: anchor.anchor.id,
                position:
                  anchor.position,
                distance,
              };
            },
            null
          );

        return closest ??
          pieceNodeTarget;
      })()
    : pieceNodeTarget;

    pieceDragRef.current = null;
    piecePreviewRef.current = null;
    setPiecePreview(null);
    releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    if (!drag.moved) return;

    const previewScreen = mapToScreen(preview.x, preview.y);

const targetPiece =
  pieces.find((candidate) => {
      if (candidate.id === drag.pieceId) return false;
      const target = mapToScreen(candidate.position.x, candidate.position.y);
      return Math.hypot(
        previewScreen.x - target.x,
        previewScreen.y - target.y
      ) <= FEATURE_MARKER_MIN_DISTANCE;
    });

let snappedPosition = preview;
let pathDock: PiecePathDock | undefined;

const draggedRoute =
  getPieceRoute(drag.pieceId);

const routeAnchors =
  draggedRoute
    ? resolveDistanceAnchors(
        routeNodesToDistanceAnchors(draggedRoute.nodes),
        features,
        pieces,
        pathNetwork.terminals
      )
    : [];

const targetRouteNodeIndex =
  !targetPiece &&
  acquiredNode?.kind === 'route'
    ? routeAnchors.findIndex(
        (anchor) =>
          anchor.anchor.id ===
          acquiredNode.id
      )
    : -1;

const targetRouteAnchor =
  targetRouteNodeIndex >= 0
    ? routeAnchors[
        targetRouteNodeIndex
      ]
    : undefined;

    const targetFeatureId =
  acquiredNode?.kind === 'feature'
    ? acquiredNode.id
    : targetRouteAnchor?.anchor.kind ===
        'feature'
      ? targetRouteAnchor.anchor.featureId
      : undefined;

const targetFeature =
  !targetPiece && targetFeatureId
    ? visibleFeatures.find(
        (feature) =>
          feature.id === targetFeatureId
      )
    : undefined;

const location =
  targetFeature &&
  isNavigableFeature(targetFeature)
    ? targetFeature
    : undefined;

if (targetFeature) {
  snappedPosition =
    targetFeature.position;
}

if (targetRouteAnchor)
{
  snappedPosition = targetRouteAnchor.position;

  if (targetRouteAnchor.anchor.kind === 'path')
  {
    const routeSegmentId = targetRouteAnchor.anchor.segmentId;

    const routePathSegment =
      resolvedPathSegments.find(
        (segment) =>
          segment.segment.id === routeSegmentId
      );

    if (routePathSegment)
    {
      const projection =
        projectPointOntoPathDock(
          routePathSegment,
          targetRouteAnchor.position
        );

      pathDock = {
        segmentId: routePathSegment.segment.id,
        legIndex: projection.legIndex,
        fraction: projection.fraction,
      };
    }
  }
}

const targetTerminal =
  !targetPiece &&
  !targetRouteAnchor &&
  acquiredNode?.kind === 'terminal'
    ? pathNetwork.terminals.find(
        (terminal) =>
          terminal.id === acquiredNode.id
      )
    : undefined;

if (targetTerminal) {
  const connectedSegment =
    resolvedPathSegments.find(
      (segment) =>
        (
          segment.segment.start.kind ===
            'standalone' &&
          segment.segment.start.terminalId ===
            targetTerminal.id
        ) ||
        (
          segment.segment.end.kind ===
            'standalone' &&
          segment.segment.end.terminalId ===
            targetTerminal.id
        )
    );

  if (connectedSegment) {
    const projection =
      projectPointOntoPathDock(
        connectedSegment,
        targetTerminal.position
      );

    snappedPosition =
      targetTerminal.position;

    pathDock = {
      segmentId:
        connectedSegment.segment.id,

      legIndex:
        projection.legIndex,

      fraction:
        projection.fraction,
    };
  }
}

if (
  !targetPiece &&
  !acquiredNode
) {
  let closestDistance = Infinity;

  for (
    const segment of resolvedPathSegments
  ) {
    const projection = projectPointOntoPathDock(
      segment,
      preview
    );

    const projectedScreen =
      mapToScreen(
        projection.position.x,
        projection.position.y
      );

    const distance =
      Math.hypot(
        previewScreen.x -
          projectedScreen.x,
        previewScreen.y -
          projectedScreen.y
      );

    if (
      distance <=
        PATH_SNAP_DISTANCE &&
      distance < closestDistance
    ) {
      closestDistance = distance;

      snappedPosition =
        projection.position;

      pathDock = {
        segmentId:
          segment.segment.id,

        legIndex:
          projection.legIndex,

        fraction:
          projection.fraction,
      };
    }
  }
}

onPieceDrop?.(
  drag.pieceId,
  snappedPosition,
  location,
  targetPiece,
  pathDock,
  targetRouteNodeIndex >= 0
    ? targetRouteNodeIndex
    : undefined
);
  }

  function cancelPieceDrag() {
    pieceDragRef.current = null;
    piecePreviewRef.current = null;
    setPiecePreview(null);
    stopEdgeScrolling();
  }

  const piecePathTargetId =
  piecePreview
    ? resolvedPathSegments.reduce<{
        segmentId: string;
        distance: number;
      } | null>(
        (closest, segment) => {
          const projection =
            projectPointOntoPathDock(
              segment,
              piecePreview.position
            );

          const previewScreen =
            mapToScreen(
              piecePreview.position.x,
              piecePreview.position.y
            );

          const projectedScreen =
            mapToScreen(
              projection.position.x,
              projection.position.y
            );

          const distance = Math.hypot(
            previewScreen.x -
              projectedScreen.x,
            previewScreen.y -
              projectedScreen.y
          );

          if (
            distance >
            PATH_SNAP_DISTANCE
          ) {
            return closest;
          }

          if (
            !closest ||
            distance < closest.distance
          ) {
            return {
              segmentId:
                segment.segment.id,
              distance,
            };
          }

          return closest;
        },
        null
      )?.segmentId
    : undefined;

    const pieceRouteNodeTarget =
  piecePreview
    ? (() => {
        const draggedRoute =
  getPieceRoute(
    piecePreview.pieceId
  );

if (!draggedRoute) {
  return null;
}

const routeAnchors =
  resolveDistanceAnchors(
    routeNodesToDistanceAnchors(draggedRoute.nodes),
    features,
    pieces,
    pathNetwork.terminals
  );

        const previewScreen =
          mapToScreen(
            piecePreview.position.x,
            piecePreview.position.y
          );

        const closest =
  routeAnchors.reduce<{
    anchorId: string;
    position: Point;
    distance: number;
  } | null>(
    (
      currentClosest,
      anchor
    ) => {
      const targetScreen =
        mapToScreen(
          anchor.position.x,
          anchor.position.y
        );

      const distance =
        Math.hypot(
          previewScreen.x -
            targetScreen.x,
          previewScreen.y -
            targetScreen.y
        );

      if (
        distance >
        NODE_SNAP_DISTANCE
      ) {
        return currentClosest;
      }

      if (
        currentClosest &&
        currentClosest.distance <=
          distance
      ) {
        return currentClosest;
      }

      return {
        anchorId:
          anchor.anchor.id,
        position:
          anchor.position,
        distance,
      };
    },
    null
  );

return closest;
      })()
    : null;

const pieceFeatureNodeTarget =
  piecePreview
    ? visibleFeatures.reduce<{
        featureId: string;
        position: Point;
        distance: number;
      } | null>(
        (closest, feature) => {
          const previewScreen =
            mapToScreen(
              piecePreview.position.x,
              piecePreview.position.y
            );            

          const targetScreen =
            mapToScreen(
              feature.position.x,
              feature.position.y
            );

          const distance =
            Math.hypot(
              previewScreen.x -
                targetScreen.x,
              previewScreen.y -
                targetScreen.y
            );

          if (
            distance >
            NODE_SNAP_DISTANCE
          ) {
            return closest;
          }

          if (
            closest &&
            closest.distance <= distance
          ) {
            return closest;
          }

          return {
            featureId: feature.id,
            position: feature.position,
            distance,
          };
        },
        null
      )
    : null;

const pieceTerminalNodeTarget =
  piecePreview
    ? pathNetwork.terminals.reduce<{
        terminalId: string;
        position: Point;
        distance: number;
      } | null>(
        (closest, terminal) => {
          const previewScreen =
            mapToScreen(
              piecePreview.position.x,
              piecePreview.position.y
            );

          const targetScreen =
            mapToScreen(
              terminal.position.x,
              terminal.position.y
            );

          const distance =
            Math.hypot(
              previewScreen.x -
                targetScreen.x,
              previewScreen.y -
                targetScreen.y
            );

          if (
            distance >
            NODE_SNAP_DISTANCE
          ) {
            return closest;
          }

          if (
            closest &&
            closest.distance <= distance
          ) {
            return closest;
          }

          return {
            terminalId: terminal.id,
            position: terminal.position,
            distance,
          };
        },
        null
      )
    : null;

    const pieceNodeTarget =
  pieceRouteNodeTarget
    ? {
        kind: 'route' as const,
        id: pieceRouteNodeTarget.anchorId,
        position:
          pieceRouteNodeTarget.position,
        distance:
          pieceRouteNodeTarget.distance,
      }
    : pieceFeatureNodeTarget
      ? {
          kind: 'feature' as const,
          id: pieceFeatureNodeTarget.featureId,
          position:
            pieceFeatureNodeTarget.position,
          distance:
            pieceFeatureNodeTarget.distance,
        }
      : pieceTerminalNodeTarget
        ? {
            kind: 'terminal' as const,
            id: pieceTerminalNodeTarget.terminalId,
            position:
              pieceTerminalNodeTarget.position,
            distance:
              pieceTerminalNodeTarget.distance,
          }
        : null;

  const partyDropTargetId = piecePreview
    ? pieces.find((candidate) => {
        if (candidate.id === piecePreview.pieceId) return false;
        const preview = mapToScreen(piecePreview.position.x, piecePreview.position.y);
        const target = mapToScreen(candidate.position.x, candidate.position.y);
        return Math.hypot(preview.x - target.x, preview.y - target.y) <=
          FEATURE_MARKER_MIN_DISTANCE;
      })?.id
    : undefined;

  const selectedAnchor = selectedFeature
    ? mapToScreen(selectedFeature.position.x, selectedFeature.position.y)
    : null;
  const popupMargin = 8;
  const requestedPopupPosition = selectedAnchor
    ? {
        x: selectedAnchor.x + popupOffset.x,
        y: selectedAnchor.y + popupOffset.y,
      }
    : null;
  const popupPosition = requestedPopupPosition
    ? {
        x: Math.max(
          popupSize.width / 2 + popupMargin,
          Math.min(
            viewportSize.width - popupSize.width / 2 - popupMargin,
            requestedPopupPosition.x
          )
        ),
        y: Math.max(
          popupSize.height / 2 + popupMargin,
          Math.min(
            viewportSize.height - popupSize.height / 2 - popupMargin,
            requestedPopupPosition.y
          )
        ),
      }
    : null;
  const popupTitleAnchor = popupPosition
    ? {
        x: popupPosition.x,
        y:
          popupPosition.y -
          popupSize.height / 2 +
          20,
      }
    : null;
  const connectorVisible =
    selectedAnchor && popupTitleAnchor
      ? Math.hypot(
          popupTitleAnchor.x - selectedAnchor.x,
          popupTitleAnchor.y - selectedAnchor.y
        ) >= 24
      : false;
  const subtitle = selectedFeature?.subtitle?.trim();
  const actionsExpanded = selectedFeature
    ? expandedActionsFeatureId === selectedFeature.id
    : false;
  const typeExpanded = selectedFeature
    ? expandedTypeFeatureId === selectedFeature.id
    : false;
  const selectedFeatureType = featureTypes.find((type) => {
    return type.id === selectedFeature?.featureTypeId;
  });
  const hasNavigationTarget = Boolean(
    selectedFeature &&
    isNavigableFeature(selectedFeature) &&
    selectedFeature.targetMapId
  );
  const selectedLocationMap = selectedArea ? { typeName: featureTypes.find((type) => type.id === linkedLocationMap?.featureTypeId)?.name } : selectedFeature
    ? locationMapMetadata[selectedFeature.id]
    : undefined;

function saveName()
{
  if (!selectedFeature) 
  {
    return;
  }

  const name = nameDraft.trim();

  if (!name)
  {
    setNameDraft(selectedFeature.name);
    setEditingName(false);
    return;
  }

  if (selectedArea) updateAreaIdentity(selectedArea.id, { name });
  else onFeatureNameChange?.(selectedFeature.id, name);

  setEditingName(false);
}

function cancelNameEdit()
{
  setNameDraft(selectedFeature?.name ?? '');
  setEditingName(false);
}

  function saveSubtitle()
  {
  if (!selectedFeature) return;

  const subtitle = subtitleDraft.trim();

  if (selectedArea) updateAreaIdentity(selectedArea.id, { subtitle });
  else onSubtitleChange?.(selectedFeature.id, subtitle);
  setEditingSubtitle(false);
}

function cancelSubtitleEdit() 
{
  setSubtitleDraft(selectedFeature?.subtitle ?? '');
  setEditingSubtitle(false);
}

function handlePathTerminalPointerDown(
  event: React.PointerEvent<SVGCircleElement>,
  terminalId: string
)
{
  if (
    interactionMode !== 'path' ||
    event.button !== 0
  )
  {
    return;
  }

  const terminal =
    pathNetwork.terminals.find(
      (candidate) =>
        candidate.id === terminalId
    );

  if (!terminal)
  {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  event.currentTarget.setPointerCapture(event.pointerId);
  pathInteraction.beginTerminalMove(terminalId);

  setPathDragPreview({
    kind: 'terminal',
    id: terminalId,
    position: terminal.position,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
  });
}

function handlePathShapePointerDown(
  event: React.PointerEvent<SVGCircleElement>,
  segmentId: string,
  pointId: string
) 
{
  if (
    interactionMode !== 'path' ||
    event.button !== 0
  )
  {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.shiftKey)
  {
    void pathInteraction.removeShapePoint(
      segmentId,
      pointId
    );

    return;
  }

  const segment =
    pathNetwork.segments.find(
      (candidate) =>
        candidate.id === segmentId
    );

  const point =
    segment?.shapePoints.find(
      (candidate) =>
        candidate.id === pointId
    );

  if (!point)
  {
    return;
  }

  event.currentTarget.setPointerCapture(event.pointerId);

  pathInteraction.beginShapeMove(
    segmentId,
    pointId
  );

  setPathDragPreview({
    kind: 'shape',
    id: pointId,
    segmentId,
    position: point.position,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
  });
}

function handlePathNodePointerUp(
  event:
    React.PointerEvent<SVGCircleElement>
) {
  if (
    !pathDragPreview ||
    pathDragPreview.pointerId !==
      event.pointerId
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const preview = pathDragPreview;

  setPathDragPreview(null);

  releasePointerCaptureSafely(
    event.currentTarget,
    event.pointerId
  );

  if (preview.kind === 'terminal')
  {
    if (preview.moved)
    {
      void pathInteraction.commitTerminalMove(preview.position);
      return;
    }

    pathInteraction.cancelMove();

    const terminal =
      pathNetwork.terminals.find(
        (candidate) =>
          candidate.id === preview.id
      );

    if (!terminal)
    {
      return;
    }

    void pathInteraction.handleTerminalIntent(
      terminal.position,
      undefined,
      terminal.id
    );

    return;
  }

  void pathInteraction.commitShapeMove(preview.position);
}

function cancelPathNodeMove()
{
  setPathDragPreview(null);
  pathInteraction.cancelMove();
}

function handleSectionNodePointerDown(
  event: React.PointerEvent<HTMLButtonElement>,
  node: SectionNode
)
{
  event.stopPropagation();

  if (event.button !== 0) {
    return;
  }

  if (
    movingSectionNode &&
    movingSectionNode.pointerId === undefined
  ) {
    const point =
      screenToMap(
        event.clientX,
        event.clientY
      );

    if (
      !point ||
      !isPointInsideMap(point)
    ) {
      return;
    }

    event.preventDefault();

    onUpdateSectionData?.(
      sections,
      sectionNodes.map(
        (candidate) =>
          candidate.id ===
          movingSectionNode.nodeId
            ? {
                ...candidate,
                position: point,
              }
            : candidate
      ),
      sectionEdges
    );

    setMovingSectionNode(null);

    return;
  }
  if (event.shiftKey) {
    event.preventDefault();
    deleteSectionNode(node.id);
    return;
  }
  if (!event.ctrlKey) {
    if (sectionMode === 'area') {
      event.preventDefault();
      appendDraftNode(node.position, node);
    }
    return;
  }
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  setMovingSectionNode({
    nodeId: node.id,
    original: node.position,
    position: node.position,
    pointerId: event.pointerId,
  });
}

function handleSectionNodePointerMove(
  event: React.PointerEvent<HTMLButtonElement>
) {
  if (movingSectionNode?.pointerId !== event.pointerId) return;
  const point = screenToMap(event.clientX, event.clientY);
  if (!point) return;
  setMovingSectionNode({ ...movingSectionNode, position: point });
}

function handleSectionNodePointerUp(
  event: React.PointerEvent<HTMLButtonElement>
) {
  if (movingSectionNode?.pointerId !== event.pointerId) return;
  releasePointerCaptureSafely(event.currentTarget, event.pointerId);
  onUpdateSectionData?.(
    sections,
    sectionNodes.map((node) => node.id === movingSectionNode.nodeId
      ? { ...node, position: movingSectionNode.position }
      : node),
    sectionEdges
  );
  setMovingSectionNode(null);
}

function cancelSectionNodeMove() {
  setMovingSectionNode(null);
}

function openSectionProperties(section: Section) {
  if (section.kind === 'area') return;
  setEditingSection(section);
  setSectionNameDraft(section.name);
  setSectionColorDraft(section.color);
  setSectionContextMenu(null);
}

function saveSectionProperties() {
  if (!editingSection || !sectionNameDraft.trim()) return;
  onUpdateSectionData?.(
    sections.map((section) => section.id === editingSection.id
      ? {
          ...section,
          ...(section.kind !== 'area' ? { name: sectionNameDraft.trim() } : {}),
          color: sectionColorDraft,
          updatedAt: new Date(),
        }
      : section),
    sectionNodes,
    sectionEdges
  );
  setEditingSection(null);
}

  return (
    <div
      ref={viewportRef}
      className={[
  'map-viewport',
  dragging ? 'dragging' : '',
  piecePreview ? 'piece-dragging' : '',
  state.editingMode === 'move-feature' ? 'moving-feature' : '',
  sectionMode ? 'section-drawing' : '',
].filter(Boolean).join(' ')}
      onWheel={
        handleWheel
      }
      onPointerDown={
        handlePointerDown
      }
      onPointerMove={
        handlePointerMove
      }
      onPointerUp={
        endDrag
      }
      onPointerCancel={
        cancelMapDrag
      }
      onLostPointerCapture={cancelMapDrag}
      onPointerEnter={(event) => {
        trackEdgePointer(event.clientX, event.clientY);
      }}
      onPointerLeave={() => {
        pointerInsideViewportRef.current = false;
        setDistancePointer(null);
        stopEdgeScrolling();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onContextMenu={handleContextMenu}
    >
      
      <ModeHelp
        mode={interactionMode}
        routeActive={routePieceId !== null}
      />
      
      <img
  className="map-viewport-image"
  src={imageUrl}
  alt={mapName}
  draggable={false}
  onLoad={(event) => {
    setImageSize({
      width:
        event.currentTarget
          .naturalWidth,

      height:
        event.currentTarget
          .naturalHeight,
    });
  }}
  style={{
  left:
    `calc(50% + ${pan.x + registration.offsetX * scale}px)`,

  top:
    `calc(50% + ${pan.y + registration.offsetY * scale}px)`,

  transform:
    `translate(-50%, -50%) scale(${scale * registration.scale})`,
}}
/>

{calibrationActive && (
  <svg
    className="scale-calibration-layer"
    aria-hidden="true"
  >
    {calibrationFirstPoint &&
      calibrationSecondPoint && (() => {
        const first =
          mapToScreen(
            calibrationFirstPoint.x,
            calibrationFirstPoint.y
          );

        const second =
          mapToScreen(
            calibrationSecondPoint.x,
            calibrationSecondPoint.y
          );

        return (
          <line
            className="scale-calibration-connector"
            x1={first.x}
            y1={first.y}
            x2={second.x}
            y2={second.y}
          />
        );
      })()}

    {[
      calibrationFirstPoint,
      calibrationSecondPoint,
    ].map((point, index) => {
      if (!point) {
        return null;
      }

      const screen =
        mapToScreen(
          point.x,
          point.y
        );

      const pointIndex =
        index as 0 | 1;

      return (
        <g
          key={
            pointIndex === 0
              ? 'calibration-first'
              : 'calibration-second'
          }
        >
          <line
            className="scale-calibration-marker"
            x1={screen.x}
            y1={screen.y - 14}
            x2={screen.x}
            y2={screen.y + 14}
          />

          <circle
            className="scale-calibration-node-hitbox"
            cx={screen.x}
            cy={screen.y}
            r={6}
            onPointerDown={(event) =>
              handleCalibrationNodePointerDown(
                event,
                pointIndex
              )
            }
            onPointerMove={
              handleCalibrationNodePointerMove
            }
            onPointerUp={
              handleCalibrationNodePointerUp
            }
            onPointerCancel={
              handleCalibrationNodePointerUp
            }
          />

          <circle
            className="scale-calibration-node"
            cx={screen.x}
            cy={screen.y}
            r={4}
          />
        </g>
      );
    })}
    </svg>
)}

{pathTerminalContextMenu && (
  <div
    ref={pathTerminalContextMenuRef}
    className="path-terminal-context-menu"
    style={{
      left:
        pathTerminalContextMenu.x,
      top:
        pathTerminalContextMenu.y,
    }}
    onPointerDown={(event) =>
      event.stopPropagation()
    }
    onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
    }}
  >
    <button
      type="button"
      onClick={() => {
        const terminalId =
          pathTerminalContextMenu
            .terminalId;

        setPathTerminalContextMenu(
          null
        );

        onPromotePathTerminal?.(
          terminalId
        );
      }}
    >
      Promote to Feature
    </button>
  </div>
)}

{routePieceId === null &&
  displayedRoutes.map((displayedRoute) => (
    <DistanceMeasurementOverlay
      key={displayedRoute.route.id}
      anchors={displayedRoute.anchors}
      segments={displayedRoute.segments}
      distanceScale={imageRegistration?.distanceScale}
      targetedAnchorId={
        selectedRoute?.id ===
          displayedRoute.route.id &&
        pieceNodeTarget?.kind === 'route'
          ? pieceNodeTarget.id
          : undefined
      }
      pointerPosition={null}
      mapToScreen={mapToScreen}
    />
  ))}

<DistanceMeasurementOverlay
  anchors={resolvedDistanceAnchors}
  segments={distanceSegments}
  distanceScale={imageRegistration?.distanceScale}
  pointerPosition={distancePointer}
  mapToScreen={mapToScreen}
  onRemoveAnchor={distanceMeasurement.removeAnchor}
  onSelectTemporaryAnchor={distanceMeasurement.addExistingPoint}
/>

{layerVisibility.paths && (
  <PathOverlay
    targetedSegmentId={piecePathTargetId}
    targetedTerminalId={
      pieceNodeTarget?.kind === 'terminal'
        ? pieceNodeTarget.id
        : undefined
    }
    editing={interactionMode === 'path'}
    terminalPromotionEnabled={
      interactionMode === 'path' ||
      interactionMode === 'build'
    }
    distanceTargeting={distanceInteractionActive}
    exploreTargeting={interactionMode === 'explore'}
    onExplorePathClick={(
      segmentId,
      position
    ) => {
    setSelectedPieceId(null);
    dispatch({
      type: 'feature.clearSelection',
    });

    setSelectedPathSegment({
      segmentId,
      anchor: position,
    });
  }}
    onDistancePathClick={(
  segmentId,
  position,
  usePath,
  finishRoute
) => {
  if (!usePath) {
    addDistanceAreaCrossings(
      position
    );
  }

  distanceMeasurement.addPath(
    segmentId,
    position,
    usePath
  );

  if (
    routePieceId !== null &&
    finishRoute
  )
  {
    setRouteFinishPending(true);
  }
}}
    onDistanceTerminalClick={(
  terminalId,
  usePath,
  finishRoute
) => {
  if (!usePath) {
    const terminal =
      pathNetwork.terminals.find(
        (candidate) =>
          candidate.id === terminalId
      );

    if (terminal) {
      addDistanceAreaCrossings(
        terminal.position
      );
    }
  }

  distanceMeasurement.addTerminal(
    terminalId,
    usePath
  );

    if (
    routePieceId !== null &&
    finishRoute
  )
  {
    setRouteFinishPending(true);
  }
}}
    terminals={
      pathNetwork.terminals
    }
    segments={
      pathNetwork.segments
    }
    features={features}
    draftStartPosition={
      getPathDraftStartPosition()
    }
    draftShapePoints={
      pathInteraction.draft
        ?.shapePoints.map(
          (point) =>
            point.position
        ) ?? []
    }
    draftPointer={
      pathPointer
    }
    dragPreview={
      pathDragPreview
    }
    mapToScreen={
      mapToScreen
    }
    onSegmentRightClick={(
      event,
      segmentId
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const point =
        screenToMap(
          event.clientX,
          event.clientY
        );

      if (!point) {
        return;
      }

      if (event.ctrlKey) {
        void pathInteraction
          .splitSegment(
            segmentId,
            point
          );

        return;
      }

      void pathInteraction
        .insertShapePoint(
          segmentId,
          point
        );
    }}
    onSegmentShiftClick={(
      event,
      segmentId
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (
        window.confirm(
          'Delete this Path segment?'
        )
      ) {
        void pathInteraction
          .removeSegment(
            segmentId
          );
      }
    }}
    onTerminalPointerDown={
      handlePathTerminalPointerDown
    }
        onTerminalContextMenu={(
      event,
      terminalId
    ) => {
      if (
        interactionMode !== 'path' &&
        interactionMode !== 'build'
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setPathTerminalContextMenu({
        terminalId,
        x: event.clientX,
        y: event.clientY,
      });
    }}
    onShapePointerDown={
      handlePathShapePointerDown
    }
    onNodePointerUp={
      handlePathNodePointerUp
    }
    onNodePointerCancel={
      cancelPathNodeMove
    }
  />
)}

<svg className="section-geometry-layer" aria-hidden="true">
  {visibleSections.map((section) => {
    const points = getSectionPolygon(section, sectionEdges, displayedSectionNodes)
      .map((point) => mapToScreen(point.x, point.y));
    const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    if (section.kind === 'area') {
      const clipId = `area-interior-${mapId}-${section.id}`;
      return (
        <g key={section.id}>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <polygon points={polygonPoints} />
            </clipPath>
          </defs>
          <polygon
            className="section-geometry section-area"
            points={polygonPoints}
            fill={section.color}
            stroke="none"
          />
          {/* Keep the inner half of a 4px stroke: a 2px line centered 1px inside.
              Points are in screen coordinates, so the inset stays fixed on zoom. */}
          <polygon
            className="section-area-edge"
            points={polygonPoints}
            stroke={section.color}
            clipPath={`url(#${clipId})`}
          />
        </g>
      );
    }
    return (
      <polygon
        key={section.id}
        className={`section-geometry section-${section.kind}`}
        points={polygonPoints}
        fill={section.color}
        stroke={section.color}
      />
    );
  })}
  {visibleSections.filter((section) => section.kind === 'area' && section.showName)
    .map((section) => {
      const position = getAreaControlPosition(section);
      if (!position) return null;
      const screen = mapToScreen(position.x, position.y);
      return (
        <text key={`label-${section.id}`} className="section-area-name"
          x={screen.x} y={screen.y + 22} textAnchor="middle" dominantBaseline="central">
          {section.name}
        </text>
      );
    })}
  {sectionDraft?.edges.map((edge) => {
    const start = sectionDraft.nodes.find((node) => {
      return node.id === edge.startNodeId;
    });
    const end = sectionDraft.nodes.find((node) => {
      return node.id === edge.endNodeId;
    });
    if (!start || !end) return null;
    const a = mapToScreen(start.position.x, start.position.y);
    const b = mapToScreen(end.position.x, end.position.y);
    return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
  })}
  {sectionDraft && sectionPointer && (() => {
    const last = sectionDraft.nodes.at(-1);
    if (!last) return null;
    const a = mapToScreen(last.position.x, last.position.y);
    const b = mapToScreen(sectionPointer.x, sectionPointer.y);
    return <line className="section-preview-edge" x1={a.x} y1={a.y}
      x2={b.x} y2={b.y} />;
  })()}
</svg>

{visibleSections.filter((section) => section.kind === 'area').map((section) => {
  const position = getAreaControlPosition(section);
  if (!position) return null;
  const screen = mapToScreen(position.x, position.y);
  return (
    <button
      key={`control-${section.id}`}
      type="button"
      className={`area-control-node${movingFeatureId === section.id ? (isMovePositionValid(position) ? ' moving' : ' moving invalid') : ''}`}
      aria-label={`${section.name} Area control`}
      title={section.name}
      style={{ left: screen.x, top: screen.y, backgroundColor: section.color }}
      onPointerDown={(event) => {
        if (state.editingMode !== 'move-feature') event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (suppressNextFeatureClickRef.current) { suppressNextFeatureClickRef.current = false; return; }
        if (pendingArrivalPlacement || sectionDraft || state.editingMode === 'move-feature') return;
        setSelectedPathSegment(null);
        setSelectedPieceId(null);
        dispatch({ 
          type: 'feature.select', 
          featureId: section.id,
        });
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect || pendingArrivalPlacement) return;
        setSectionContextMenu({ kind: 'area', id: section.id, point: position,
          x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
    />
  );
})}
{displayedSectionNodes.filter((node) => {
  return editableNodeIds.has(node.id);
}).map((node) => {
  const position = mapToScreen(node.position.x, node.position.y);
  const owner = getSectionOwner(node.id);
  if (!owner) return null;
  return (
    <button
      key={node.id}
      type="button"
      className={[
        'section-node',
        sectionContextMenu?.kind === 'node' &&
          sectionContextMenu.id === node.id ? 'selected' : '',
        movingSectionNode?.nodeId === node.id ? 'selected' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: position.x,
        top: position.y,
        borderColor: owner.color,
      }}
      title={`${owner.name} node`}
      onPointerDown={(event) => handleSectionNodePointerDown(event, node)}
      onPointerMove={handleSectionNodePointerMove}
      onPointerUp={handleSectionNodePointerUp}
      onPointerCancel={cancelSectionNodeMove}
      onLostPointerCapture={cancelSectionNodeMove}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const viewport = viewportRef.current;
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();
        setSectionContextMenu({
          kind: 'node',
          id: node.id,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          point: node.position,
        });
      }}
    />
  );
})}

{sectionDraft?.nodes.map((node, index) => {
  const position = mapToScreen(node.position.x, node.position.y);
  const closable = index === 0 && sectionDraft.nodes.length >= 3;
  return (
    <button
      key={node.id}
      type="button"
      className={[
        'section-node',
        index === 0 ? 'origin' : '',
        closable ? 'closable' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!event.shiftKey) return;
        event.preventDefault();
        if (index === 0) {
          setSectionDraft(null);
          return;
        }
        const nodes = sectionDraft.nodes.filter((item) => item.id !== node.id);
        const edges = nodes.slice(1).map((item, itemIndex) => ({
          id: crypto.randomUUID(),
          mapId: item.mapId,
          startNodeId: nodes[itemIndex].id,
          endNodeId: item.id,
        }));
        setSectionDraft({ ...sectionDraft, nodes, edges });
      }}
      onClick={() => {
        if (closable) completeSectionDraft();
      }}
    />
  );
})}

{pieces.map((piece) => {
  const position =
  piecePreview?.pieceId === piece.id
    ? pieceNodeTarget?.position ??
      piecePreview.position
    : piece.position;

  const screenPosition =
    mapToScreen(
      position.x,
      position.y
    );

  const distanceSelected =
    distanceInteractionActive &&
    distanceMeasurement.anchors.some(
      (anchor) =>
        anchor.kind === 'piece' &&
        anchor.pieceId === piece.id
    );

  const className = [
    'map-piece',
    `map-piece-${piece.appearance.shape}`,
    piece.id === focusedPieceId ? 'focused' : '',
    distanceSelected ? 'distance-selected' : '',
    piecePreview?.pieceId === piece.id ? 'dragging' : '',
    partyDropTargetId &&
      (piece.id === partyDropTargetId || piece.id === piecePreview?.pieceId)
      ? 'party-merge-highlight'
      : '',
  ].filter(Boolean).join(' ');

  return (
    <Fragment key={piece.id}>
      <button
        type="button"
        className={className}
        title={piece.name}
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
          backgroundColor: piece.appearance.fillColor,
          borderColor: distanceSelected
            ? '#39ff14'
            : piece.appearance.borderColor,
          cursor:
            interactionMode === 'explore'
              ? 'grab'
              : 'pointer',
        }}
        onPointerDown={(event) => handlePiecePointerDown(event, piece)}
        onPointerMove={handlePiecePointerMove}
        onPointerUp={handlePiecePointerUp}
        onPointerCancel={cancelPieceDrag}
        onLostPointerCapture={cancelPieceDrag}
        
        onContextMenu={(event) => {
          if (interactionMode === 'distance') {
            event.preventDefault();
            event.stopPropagation();

            const anchor =
              distanceMeasurement.anchors
                .slice()
                .reverse()
                .find(
                  (candidate) =>
                    candidate.kind === 'piece' &&
                    candidate.pieceId === piece.id
                );

            if (anchor) {
              distanceMeasurement.removeAnchor(
                anchor.id
              );
            }

            return;
          }

          if (
            !interactionPermissions.canManipulatePieces
          ) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          const viewport = viewportRef.current;
          if (!viewport) return;
          const rect = viewport.getBoundingClientRect();
          dispatch({ type: 'contextMenu.close' });
          setPieceContextMenu({
            pieceId: piece.id,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
          setPartyMembersMenuOpen(false);
        }}
      />
      {piecePreview?.pieceId === piece.id && (
  <span
    className="map-piece-mount-point"
    style={{
      left: screenPosition.x,
      top: screenPosition.y,
    }}
  />
)}
      {piecePreview?.pieceId !== piece.id && (
  <span
    className="map-piece-label"
    style={{
      left: screenPosition.x,
      top: screenPosition.y,
    }}
  >
    {piece.name}
  </span>
)}
    </Fragment>
  );
})}

{pendingArrivalPlacement && (() => {
  const position = arrivalPreview ?? {
    x: registration.offsetX,
    y: registration.offsetY,
  };
  const screenPosition = mapToScreen(position.x, position.y);
  const valid = isPointInsideMap(position);
  const heldPiece = pendingArrivalPlacement.piece;
  const heldConnection = pendingArrivalPlacement.connection;
  return (
    <>
      <div className="arrival-placement-layer" />
      {heldConnection && (
        <button
          type="button"
          className={[
            'map-feature-marker',
            'map-feature-connection',
            'arrival-placement',
            valid ? '' : 'invalid',
          ].filter(Boolean).join(' ')}
          style={{ left: screenPosition.x, top: screenPosition.y }}
          title="Place Connection endpoint"
        >
          <span className="map-feature-dot" />
        </button>
      )}
      {heldPiece && (
        <button
          type="button"
          className={[
            'map-piece',
            `map-piece-${heldPiece.appearance.shape}`,
            'dragging',
            'arrival-placement',
            valid ? '' : 'invalid',
          ].filter(Boolean).join(' ')}
          style={{
            left: screenPosition.x,
            top: screenPosition.y,
            backgroundColor: heldPiece.appearance.fillColor,
            borderColor: heldPiece.appearance.borderColor,
          }}
          title="Place Piece arrival"
        />
      )}
    </>
  );
})()}

{/*
  Feature-backed Path terminals retain the Feature's
  actual spatial position. Their marker supplies the
  terminal visualization instead of drawing a second node.
*/}

{visibleFeatures.map((feature) => {
    const pathTerminal =
    interactionMode === 'path' &&
    pathNetwork.segments.some(
      (segment) =>
        (
          segment.start.kind ===
            'feature' &&
          segment.start.featureId ===
            feature.id
        ) ||
        (
          segment.end.kind ===
            'feature' &&
          segment.end.featureId ===
            feature.id
        )
    );
  const isMoving = feature.id === movingFeatureId &&
    state.editingMode === 'move-feature';
  const position = isMoving && movingFeaturePreviewPosition
    ? movingFeaturePreviewPosition
    : feature.position;
  const screenPosition = mapToScreen(
    position.x,
    position.y
  );
  const moveIsValid = !isMoving || isMovePositionValid(position);
  const distanceSelected =
    distanceInteractionActive &&
    distanceMeasurement.anchors.some(
      (anchor) =>
        anchor.kind === 'feature' &&
        anchor.featureId === feature.id
    );

  const markerClasses = [
    'map-feature-marker',
    isConnection(feature) ? 'map-feature-connection' : '',
    state.selectedFeatureId === feature.id ? 'selected' : '',
    distanceSelected ? 'distance-selected' : '',
    pathTerminal ? 'path-terminal' : '',
    pieceNodeTarget?.kind === 'feature' &&
      pieceNodeTarget.id === feature.id
        ? 'piece-node-targeted'
        : '',
    isMoving ? 'moving' : '',
    moveIsValid ? '' : 'invalid',
  ].filter(Boolean).join(' ');

  return (
    <Fragment key={feature.id}>
      <button
        type="button"
        className={markerClasses}
        title={feature.name}
        aria-pressed={state.selectedFeatureId === feature.id}
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
        }}
        onPointerDown={(event) => {
  if (
    state.editingMode ===
      'move-feature'
  ) {
    return;
  }

  setPieceContextMenu(null);
  event.stopPropagation();

  if (
    interactionMode === 'path' &&
    event.button === 0 &&
    event.ctrlKey
  ) {
    event.preventDefault();

    void pathInteraction
      .handleTerminalIntent(
        feature.position,
        feature
      );
  }
}}
onClick={(event) => {
  if (suppressNextFeatureClickRef.current) {
    suppressNextFeatureClickRef.current = false;
    return;
  }

  if (
    state.editingMode ===
      'move-feature'
  ) {
    return;
  }

  if (distanceInteractionActive) {
  event.preventDefault();
  event.stopPropagation();

  if (!event.ctrlKey) {
    addDistanceAreaCrossings(
      feature.position
    );
  }

  distanceMeasurement.addFeature(
    feature.id,
    event.ctrlKey
  );

  if (
    routePieceId !== null &&
    event.shiftKey
  )
  {
    setRouteFinishPending(true);
  }

  return;
}

  if (interactionMode !== 'explore')
  {
    return;
  }
  setSelectedPathSegment(null);
  setSelectedPieceId(null);
  dispatch({
    type: 'feature.select',
    featureId: feature.id,
  });
}}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPieceContextMenu(null);

          if (distanceInteractionActive) {
            distanceMeasurement.removeFeature(
              feature.id
            );
            return;
          }

          if (state.editingMode === 'move-feature') return;
          const viewport = viewportRef.current;
          const point = screenToMap(event.clientX, event.clientY);
          if (!viewport || !point) return;
          const rect = viewport.getBoundingClientRect();
          if (interactionMode === 'build') {
  dispatch({
    type: 'feature.clearSelection',
  });

  dispatch({
    type: 'contextMenu.open',
    menu: {
      kind: 'feature',
      targetId: feature.id,
      screenX:
        event.clientX - rect.left,
      screenY:
        event.clientY - rect.top,
      mapX: point.x,
      mapY: point.y,
    },
  });
}
        }}
      >
        <span className="map-feature-dot" />
      </button>

      {feature.showLabel !== false && !isMoving && (
        <span
          className="map-feature-label"
          style={{
            left: screenPosition.x,
            top: screenPosition.y,
            opacity: labelOpacity,
          }}
        >
          {feature.name}
        </span>
      )}
    </Fragment>
  );
})}

{selectedPath &&
  selectedPathSegment &&
  interactionMode === 'explore' &&
  (() => {
    const anchor =
      mapToScreen(
        selectedPathSegment.anchor.x,
        selectedPathSegment.anchor.y
      );

    const popupPosition = {
      x: anchor.x + pathPopupOffset.x,
      y: anchor.y + pathPopupOffset.y,
    };

    const popupAnchor = {
      x: popupPosition.x,
      y: popupPosition.y + 24,
    };

    return (
      <>
        <svg
          className="feature-popup-connector"
          aria-hidden="true"
        >
          <line
            className="connector-outline"
            x1={anchor.x}
            y1={anchor.y}
            x2={popupAnchor.x}
            y2={popupAnchor.y}
          />

          <line
            className="connector-line"
            x1={anchor.x}
            y1={anchor.y}
            x2={popupAnchor.x}
            y2={popupAnchor.y}
          />
        </svg>

        <PathSegmentPopup
          segment={selectedPath}
          actions={
            pathSecondaryActions?.(
              selectedPath
            ) ?? []
          }
          position={popupPosition}
                    rulesetInteraction={
            pathRulesetInteraction
          }
          rulesetLoading={
            pathRulesetLoading
          }
          onTypeChange={(
            segmentId,
            type
          ) => {
            void updatePathSegment(
              segmentId,
              { type }
            );
          }}
          onRulesetDataChange={(
            segmentId,
            rulesetData
          ) => {
            void updatePathSegment(
              segmentId,
              { rulesetData }
            );
          }}
          onNameChange={(
  segmentId,
  name
) => {
  const trimmedName =
    name.trim();

  if (!trimmedName) {
    return;
  }

  void updatePathSegment(
    segmentId,
    {
      name: trimmedName,
    }
  );
}}
onSubtitleChange={(
  segmentId,
  subtitle
) => {
  void updatePathSegment(
    segmentId,
    {
      subtitle:
        subtitle.trim() ||
        undefined,
    }
  );
}}
onDescriptionChange={(
  segmentId,
  description
) => {
  void updatePathSegment(
    segmentId,
    {
      description,
    }
  );
}}
          onPointerDown={
            handlePathPopupPointerDown
          }
          onPointerMove={
            handlePathPopupPointerMove
          }
          onPointerUp={
            endPathPopupDrag
          }
          onPointerCancel={
            cancelPathPopupDrag
          }
        />
      </>
    );
  })()}

{connectorVisible && selectedAnchor && popupTitleAnchor && (
  <svg className="feature-popup-connector" aria-hidden="true">
    <line
  className="connector-outline"
  x1={selectedAnchor.x}
  y1={selectedAnchor.y}
  x2={popupTitleAnchor.x}
  y2={popupTitleAnchor.y}
/>

<line
  className="connector-line"
  x1={selectedAnchor.x}
  y1={selectedAnchor.y}
  x2={popupTitleAnchor.x}
  y2={popupTitleAnchor.y}
/>
  </svg>
)}

{selectedFeature && popupPosition && (
 <div
  ref={popupRef}
    className="feature-popup"
    style={{ left: popupPosition.x, top: popupPosition.y }}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
    }}
  >
    <div
      className="feature-popup-header"
      onPointerDown={handlePopupPointerDown}
      onPointerMove={handlePopupPointerMove}
      onPointerUp={endPopupDrag}
      onPointerCancel={cancelPopupDrag}
      onLostPointerCapture={cancelPopupDrag}
    >
      {editingName ? (
  <input
    className="feature-popup-name-input"
    type="text"
    value={nameDraft}
    onChange={(event) => {
      setNameDraft(
        event.target.value
      );
    }}
    onPointerDown={(event) => {
      event.stopPropagation();
    }}
    onClick={(event) => {
      event.stopPropagation();
    }}
    onBlur={saveName}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveName();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelNameEdit();
      }
    }}
    autoFocus
  />
) : (
  <button
    type="button"
    className="feature-popup-name"
    onPointerDown={(event) => {
      event.stopPropagation();
    }}
    onClick={() => {
      popupDragRef.current = null;
      setNameDraft(
        selectedFeature.name
      );

      setEditingName(true);
    }}
  >
    {selectedFeature.name}
  </button>
)}

      {editingSubtitle ? (
  <input
    className="feature-popup-subtitle-input"
    type="text"
    value={subtitleDraft}
    placeholder="Subtitle"
    onChange={(event) => setSubtitleDraft(event.target.value)}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onBlur={saveSubtitle}
    onKeyDown={(event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveSubtitle();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancelSubtitleEdit();
      }
    }}
    autoFocus
  />
) : subtitle ? (
  <button
    type="button"
    className="feature-popup-subtitle"

  onPointerDown={(event) => event.stopPropagation()}
    onClick={() => {
      popupDragRef.current = null;
      setSubtitleDraft(selectedFeature.subtitle ?? '');
      setEditingSubtitle(true);
    }}
  >
    {subtitle}
  </button>
) : (
  <div className="feature-popup-subtitle-empty">
    <span />

    <button
      type="button"
      className="feature-popup-subtitle-add"
      title="Add subtitle"
      aria-label="Add subtitle"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        popupDragRef.current = null;
        setSubtitleDraft('');
        setEditingSubtitle(true);
      }}
    />

    <span />
  </div>
)}

    </div>

    <div className="feature-popup-controls">
      <div className="feature-popup-control">
        {hasNavigationTarget ? (
          <span className="feature-popup-control-readonly">
            Type: {selectedLocationMap?.typeName ?? 'No Type'}
          </span>
        ) : (
          <>
        <button
          type="button"
          className="feature-popup-control-toggle"
          aria-expanded={typeExpanded}
          onClick={() => {
            setExpandedActionsFeatureId(null);
            setExpandedTypeFeatureId(
              typeExpanded ? null : selectedFeature.id
            );
          }}
        >
          Type: {selectedFeatureType?.name ?? 'No Type'}{' '}
          <span aria-hidden="true">▾</span>
        </button>

        {typeExpanded && (
          <div className="feature-popup-control-menu type-menu">
            <button
              type="button"
              className={!selectedFeatureType ? 'selected' : ''}
              onClick={() => {
                if (selectedArea) updateAreaIdentity(selectedArea.id, { featureTypeId: undefined });
                else onFeatureTypeChange?.(selectedFeature.id, undefined);
                setExpandedTypeFeatureId(null);
              }}
            >
              No Type
            </button>
            {featureTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                className={selectedFeatureType?.id === type.id
                  ? 'selected'
                  : ''}
                onClick={() => {
                  if (selectedArea) updateAreaIdentity(selectedArea.id, { featureTypeId: type.id });
                  else onFeatureTypeChange?.(selectedFeature.id, type.id);
                  setExpandedTypeFeatureId(null);
                }}
              >
                {type.name}
              </button>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      <div className="feature-popup-control">
        <button
          type="button"
          className="feature-popup-control-toggle"
          aria-expanded={actionsExpanded}
          onClick={() => {
            setExpandedTypeFeatureId(null);
            setExpandedActionsFeatureId(
              actionsExpanded ? null : selectedFeature.id
            );
          }}
        >
          Actions <span aria-hidden="true">▾</span>
        </button>

        {actionsExpanded && (
          <div className="feature-popup-control-menu actions-menu">
            {hasNavigationTarget && (
              <button
                type="button"
                onClick={() => selectedArea ? onOpenAreaLocation?.(selectedArea) : onEnterFeature?.(selectedFeature)}
              >
                Enter
              </button>
            )}

            {selectedArea && <>
              <button type="button" onClick={() => {
                setMediaAreaId(selectedArea.id); setExpandedActionsFeatureId(null);
              }}>Media…</button>
              {!selectedArea.targetMapId && <button type="button"
                onClick={() => { onAddAreaLocation?.(selectedArea); setExpandedActionsFeatureId(null); }}>Add Location</button>}
              {selectedArea.targetMapId && <button type="button" onClick={() => {
                if (!window.confirm('Unlink this Location? Its Map is kept, but its derived Boundary and automatic Area travel are removed.')) return;
                onUnlinkAreaLocation?.(selectedArea); setExpandedActionsFeatureId(null);
              }}>Unlink Location</button>}
            </>}
            {selectedFeatureSecondaryActions.map((action) => {
  const hasChildren =
    Boolean(action.children?.length);

  const submenuExpanded =
    expandedSecondaryActionId === action.id;

  return (
    <div
      key={action.id}
      className="feature-popup-action-group"
    >
      <button
        type="button"
        disabled={action.disabled}
        onClick={() => {
          if (hasChildren) {
            setExpandedSecondaryActionId(
              submenuExpanded
                ? null
                : action.id
            );
            return;
          }

          action.onInvoke?.();
        }}
      >
        {action.label}

        {hasChildren && (
          <span
            className="feature-popup-action-arrow"
            aria-hidden="true"
          >
            ›
          </span>
        )}
      </button>

      {hasChildren && submenuExpanded && (
        <div className="feature-popup-action-submenu">
          {action.children!.map(
            (child) => (
              <button
                key={child.id}
                type="button"
                disabled={child.disabled}
                onClick={() => {
                  child.onInvoke?.();
                  setExpandedSecondaryActionId(
                    null
                  );
                  setExpandedActionsFeatureId(
                    null
                  );
                }}
              >
                {child.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
})}

           {!selectedArea &&
  !hasNavigationTarget &&
  selectedFeatureSecondaryActions.length === 0 && (
              <span className="feature-popup-no-actions">
                No actions available.
              </span>
            )}
          </div>
        )}
      </div>
    </div>

   <div className="path-popup-extender">
  <div className="path-popup-tabs">
    <button
      type="button"
      className={`path-popup-tab${
        activeFeaturePopupTab ===
        'description'
          ? ' active'
          : ''
      }`}
      aria-expanded={
        activeFeaturePopupTab ===
        'description'
      }
      onClick={() => {
        setActiveFeaturePopupTab(
          (current) =>
            current === 'description'
              ? null
              : 'description'
        );
      }}
    >
      Description
    </button>

    <button
      type="button"
      className={`path-popup-tab${
        activeFeaturePopupTab ===
        'ruleset'
          ? ' active'
          : ''
      }`}
      aria-expanded={
        activeFeaturePopupTab ===
        'ruleset'
      }
      onClick={() => {
        setActiveFeaturePopupTab(
          (current) =>
            current === 'ruleset'
              ? null
              : 'ruleset'
        );
      }}
    >
            {(
        selectedArea
          ? areaRulesetInteraction
          : featureRulesetInteraction
      )?.rulesetName ?? 'Ruleset'}
    </button>
  </div>

  {activeFeaturePopupTab && (
    <div className="path-popup-extension">
      {activeFeaturePopupTab ===
      'description' ? (
        <RichTextEditor
          key={selectedFeature.id}
          value={
            selectedFeature.description
          }
          onChange={(description) => {
            if (selectedArea) {
              updateAreaIdentity(
                selectedArea.id,
                { description }
              );
            } else {
              onDescriptionChange?.(
                selectedFeature.id,
                description
              );
            }
          }}
        />
      ) : (
        <>
          {(selectedArea
            ? areaRulesetLoading
            : featureRulesetLoading
          ) ? (
            <div className="path-popup-ruleset-empty">
              Loading Ruleset data...
            </div>
          ) : (selectedArea
            ? areaRulesetInteraction
            : featureRulesetInteraction
          ) ? (
            <RulesetInteractionPanel
              rulesetId={
                (selectedArea
                  ? areaRulesetInteraction
                  : featureRulesetInteraction
                )!.rulesetId
              }
              interaction={
                (selectedArea
                  ? areaRulesetInteraction
                  : featureRulesetInteraction
                )!.interaction
              }
              value={
                selectedArea
                  ? selectedArea.rulesetData
                  : selectedFeature.rulesetData
              }
              onChange={(rulesetData) =>
              {
                if (selectedArea)
                {
                  updateAreaIdentity(
                    selectedArea.id,
                    { rulesetData }
                  );

                  return;
                }

                onFeatureRulesetDataChange?.(
                  selectedFeature.id,
                  rulesetData
                );
              }}
            />
          ) : (
            <div className="path-popup-ruleset-empty">
              No Ruleset data available.
            </div>
          )}
        </>
      )}
    </div>
  )}
</div>
  </div>
)}

{mediaArea && <AreaMediaSlotsDialog key={mediaArea.id + (mediaArea.targetMapId ?? '')}
  overrides={mediaArea.targetMapId ? mediaLocationMap?.mediaSlotOverrides ?? [] : mediaArea.mediaSlotOverrides ?? []}
  inheritedOverrides={mediaArea.targetMapId ? [] : mapMediaOverrides} globalSlots={globalMediaSlots}
  readOnly={Boolean(mediaArea.targetMapId)} loading={Boolean(mediaArea.targetMapId && !mediaLocationMap)}
  onClose={() => setMediaAreaId(null)} onSave={(mediaSlotOverrides) => {
    updateAreaIdentity(mediaArea.id, { mediaSlotOverrides }); setMediaAreaId(null);
  }} />}
{sectionContextMenu && (
  <div
    ref={sectionContextMenuRef}
    className="map-context-menu section-context-menu"
    style={{ left: sectionContextMenu.x, top: sectionContextMenu.y }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {sectionContextMenu.kind === 'area' ? (() => {
      const area = sections.find((item) => item.id === sectionContextMenu.id);
      if (!area) return null;
      return <>
        <button type="button" onClick={() => {
          dispatch({ type: 'featureMove.start', featureId: area.id, position: getAreaControlPosition(area)! });
          setSectionContextMenu(null);
        }}>Move</button>
        <button type="button" role="menuitemcheckbox" aria-checked={Boolean(area.showName)} onClick={() => {
          updateAreaIdentity(area.id, { showName: !area.showName }); setSectionContextMenu(null);
        }}>Show Label<span className="map-context-check">{area.showName ? '✓' : ''}</span></button>
        <label className="area-context-color">Color<input type="color" aria-label="Area color" value={area.color}
          onChange={(event) => updateAreaIdentity(area.id, { color: event.target.value })} /></label>
        <div className="map-context-separator" />
        <button type="button" onClick={() => {
          if (window.confirm(`Delete Area "${area.name}"?`)) onDeleteSection?.(area.id);
          setSectionContextMenu(null);
        }}>Delete</button>
      </>;
    })() : sectionContextMenu.kind === 'node' ? (
      <>
        <button
          type="button"
          onClick={() => {
            const node = sectionNodes.find((item) => {
              return item.id === sectionContextMenu.id;
            });
            if (!node) return;
            setMovingSectionNode({
              nodeId: node.id,
              original: node.position,
              position: node.position,
            });
            setSectionContextMenu(null);
          }}
        >
          Move
        </button>
        <button
          type="button"
          onClick={() => deleteSectionNode(sectionContextMenu.id)}
        >
          Delete
        </button>
        {getEditableSectionOwner(sectionContextMenu.id)?.kind !== 'area' && (<>
        <div className="map-context-separator" />
        <button
          type="button"
          onClick={() => {
            const owner = getEditableSectionOwner(sectionContextMenu.id);
            if (owner) openSectionProperties(owner);
          }}
        >
          Section...
        </button>        </>)}

      </>
    ) : (
      <>
        <button
          type="button"
          onClick={() => addNodeToEdge(
            sectionContextMenu.id,
            sectionContextMenu.point
          )}
        >
          Add Node
        </button>
        {getSectionOwner(sectionContextMenu.id)?.kind !== 'boundary' && (
          <button
            type="button"
            onClick={() => startSectionFromEdge(sectionContextMenu.id)}
          >
            {sectionMode === 'area' ? 'New Area' : 'New Section'}
          </button>
        )}
      </>
    )}
  </div>
)}

{contextMenu && (
  <div
    ref={contextMenuRef}
    className="map-context-menu"
    style={{
  left: contextMenu.screenX,
  top: contextMenu.screenY,

  transform: [
    contextMenu.screenX > viewportSize.width / 2
      ? 'translateX(-100%)'
      : '',

    contextMenu.screenY > viewportSize.height / 2
      ? 'translateY(-100%)'
      : '',
  ].join(' '),
}}
    onPointerDown={(event) =>
      event.stopPropagation()
    }
  >
    {contextMenu.kind === 'map' ? (
      <>
      <button
      type="button"
      onClick={() => {
  onNewFeatureRequest?.(
    contextMenu.mapX,
    contextMenu.mapY
  );

  dispatch({ type: 'contextMenu.close' });
}}
    >
      Add Feature...
    </button>

    <button
      type="button"
      onClick={() => {
  onNewLocationRequest?.(
    contextMenu.mapX,
    contextMenu.mapY
  );

  dispatch({ type: 'contextMenu.close' });
}}
    >
      Add Location...
    </button>

    <button
      type="button"
      onClick={() => {
        onNewConnectionRequest?.(contextMenu.mapX, contextMenu.mapY);
        dispatch({ type: 'contextMenu.close' });
      }}
    >
      Add Connection...
    </button>
      </>
      ) : interactionPermissions.canAuthorFeatures ? (
        <>
        <button
          type="button"
          onClick={(event) => {
            if (!contextMenu.targetId) return;
            const pointerPosition = screenToMap(
              event.clientX,
              event.clientY
            );
            dispatch({
              type: 'featureMove.start',
              featureId: contextMenu.targetId,
              position: pointerPosition ?? {
                x: contextMenu.mapX,
                y: contextMenu.mapY,
              },
            });
          }}
        >
          Move
        </button>

        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={contextTargetFeature?.showLabel !== false}
          disabled={!contextTargetFeature}
          onClick={() => {
            if (!contextTargetFeature) return;
            onShowLabelChange?.(
              contextTargetFeature.id,
              contextTargetFeature.showLabel === false
            );
            dispatch({ type: 'contextMenu.close' });
          }}
        >
          Show Label
          <span className="map-context-check">
            {contextTargetFeature?.showLabel !== false ? '✓' : ''}
          </span>
        </button>

        <div className="map-context-separator" />

        <button
  type="button"
  disabled={!contextTargetFeature}
  onClick={() => {
    if (!contextTargetFeature) {
      return;
    }

    onDeleteFeature?.(
      contextTargetFeature
    );

    dispatch({
      type: 'contextMenu.close',
    });
  }}
>
  Delete
</button>
      </>
    ) : null}
  </div>
)}    

{pieceContextMenu && (() => {
  const piece = pieces.find((candidate) => {
    return candidate.id === pieceContextMenu.pieceId;
  });
  if (!piece) return null;

  return (
    <div
      ref={pieceContextMenuRef}
      className="map-context-menu piece-context-menu"
      style={{ left: pieceContextMenu.x, top: pieceContextMenu.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={piece.id === focusedPieceId}
        onClick={() => {
          onFocusPiece?.(piece.id);
          setPieceContextMenu(null);
        }}
      >
        Set Focus
      </button>
      <button
  type="button"
  onClick={() => {
    onEditPiece?.(piece);
    setPieceContextMenu(null);
  }}
>
  Edit...
</button>

{getPieceRoute(piece.id) ? (
  <button
    type="button"
    onClick={() => {
      onClearPieceRoute?.(
        piece
      );
      setPieceContextMenu(null);
    }}
  >
    Clear Route
  </button>
) : (
  <button
  type="button"
  onClick={() => {
  setRoutePieceId(
    piece.id
  );

  distanceMeasurement.clear();

  if (piece.pathDock) {
    const segment =
      resolvedPathSegments.find(
        (candidate) =>
          candidate.segment.id ===
          piece.pathDock?.segmentId
      );

    if (segment) {
      const position =
        resolvePathDockPosition(
          piece.pathDock,
          segment
        );

      if (position) {
        distanceMeasurement.addPath(
          segment.segment.id,
          position,
          false
        );
      } else {
        distanceMeasurement.addPoint(
          piece.position
        );
      }
    } else {
      distanceMeasurement.addPoint(
        piece.position
      );
    }
  } else {
    distanceMeasurement.addPoint(
      piece.position
    );
  }

  setPieceContextMenu(null);
}}
>
  Set Route
</button>
)}

<div className="map-context-separator" />
      {piece.kind === 'group' && (
        <>
          <div
            className="piece-context-submenu-anchor"
            onPointerEnter={() => setPartyMembersMenuOpen(true)}
            onPointerLeave={() => setPartyMembersMenuOpen(false)}
          >
            <button type="button">Members <span aria-hidden="true">▸</span></button>
            {partyMembersMenuOpen && (
              <div className="map-context-menu piece-members-submenu">
                {(piece.memberPieceIds ?? []).map((memberId) => {
                  const member = allPieces.find((item) => item.id === memberId);
                  if (!member) return null;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        onRemovePartyMember?.(piece.id, member.id);
                        setPieceContextMenu(null);
                        setPartyMembersMenuOpen(false);
                      }}
                    >
                      {member.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onDisbandParty?.(piece.id);
              setPieceContextMenu(null);
            }}
          >
            Disband
          </button>
          <div className="map-context-separator" />
        </>
      )}
      <button
        type="button"
        onClick={() => {
          onPieceTrackedChange?.(piece.id, piece.tracked === false);
          setPieceContextMenu(null);
        }}
      >
        Track Piece
        <span className="map-context-check">
          {isPieceTracked(piece) ? '✓' : ''}
        </span>
      </button>
      <div className="map-context-separator" />
      <button
        type="button"
        onClick={() => {
          onDeletePiece?.(piece);
          setPieceContextMenu(null);
        }}
      >
        Delete
      </button>
    </div>
  );
})()}

{boundaryAlignment && sectionMode === 'boundary' && alignmentDraft && (
  <div ref={alignmentPanelRef} className="boundary-alignment-panel"
    style={alignmentPanelPosition ? { left: alignmentPanelPosition.x, top: alignmentPanelPosition.y, right: 'auto' } : undefined}
    onPointerEnter={stopPanelMapScrolling}
    onPointerDown={(event) => { event.stopPropagation(); stopPanelMapScrolling(); }}
    onPointerMove={(event) => { event.stopPropagation(); stopPanelMapScrolling(); }}
    onPointerUp={(event) => event.stopPropagation()}
    onWheel={(event) => { event.stopPropagation(); stopPanelMapScrolling(); }}
    onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <strong className="boundary-alignment-title"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        stopPanelMapScrolling();
        const panel = alignmentPanelRef.current?.getBoundingClientRect();
        const viewport = viewportRef.current?.getBoundingClientRect();
        if (!panel || !viewport) return;
        alignmentDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          left: panel.left - viewport.left, top: panel.top - viewport.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = alignmentDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.stopPropagation();
        stopPanelMapScrolling();
        const panel = alignmentPanelRef.current;
        const viewport = viewportRef.current;
        if (!panel || !viewport) return;
        setAlignmentPanelPosition({
          x: Math.max(0, Math.min(viewport.clientWidth - panel.offsetWidth, drag.left + event.clientX - drag.x)),
          y: Math.max(0, Math.min(viewport.clientHeight - panel.offsetHeight, drag.top + event.clientY - drag.y)),
        });
      }}
      onPointerUp={(event) => {
        alignmentDragRef.current = null;
        releasePointerCaptureSafely(event.currentTarget, event.pointerId);
      }}
      onPointerCancel={() => { alignmentDragRef.current = null; }}
      onLostPointerCapture={() => { alignmentDragRef.current = null; }}
    >Boundary Alignment</strong>
    <p>Edit the parent Area to change this outline.</p>
    {([['rotation', 'Rotation (°)'], ['zoom', 'Zoom (%)'], ['x', 'X'], ['y', 'Y'],
      ['width', 'Width (%)'], ['height', 'Height (%)']] as const).map(([key, label]) => (
      <label key={key}>{label}
        <input type="number" step="any"
          min={key === 'zoom' || key === 'width' || key === 'height' ? 0.01 : undefined}
          value={Number.isFinite(alignmentDraft[key]) ? alignmentDraft[key] : ''}
          onChange={(event) => {
            const value = event.target.value === '' ? NaN : Number(event.target.value);
            if (Number.isFinite(value)) {
              alignmentLastValues.current = { ...(alignmentLastValues.current ?? boundaryAlignment), [key]: value };
            }
            setAlignmentDraft({ ...alignmentDraft, [key]: value });
          }}
          onBlur={() => {
            if (!Number.isFinite(alignmentDraft[key])) {
              setAlignmentDraft({ ...alignmentDraft, [key]: alignmentLastValues.current?.[key] ?? boundaryAlignment[key] });
            }
          }} />
      </label>
    ))}
    <div className="dialog-buttons">
      <button type="button" onClick={() => { setAlignmentDraft(null); onSectionModeChange?.(null); }}>Cancel</button>
      <button type="button" disabled={!isValidAlignment(alignmentDraft)} onClick={() => {
        onBoundaryAlignmentChange?.(alignmentDraft);
        setAlignmentDraft(null);
        onSectionModeChange?.(null);
      }}>Apply</button>
    </div>
  </div>
)}{editingSection && (
  <div className="dialog-backdrop">
    <div className="dialog section-properties-dialog">
      <h2>
        {SECTION_DEFAULTS[editingSection.kind].name} Properties
      </h2>
      {editingSection.kind !== 'area' && <label>
        Name
        <input
          type="text"
          value={sectionNameDraft}
          onChange={(event) => setSectionNameDraft(event.target.value)}
          autoFocus
        />
      </label>}
      <div className="section-appearance-row">
      <label className="section-color-control">
        Color
        <input
          type="color"
          value={sectionColorDraft}
          onChange={(event) => setSectionColorDraft(event.target.value)}
        />
      </label>
      </div>
      <div className="dialog-buttons section-properties-buttons">
        <button
          type="button"
          className="destructive"
          onClick={() => {
            if (!window.confirm(`Delete Section "${editingSection.name}"?`)) {
              return;
            }
            onDeleteSection?.(editingSection.id);
            setEditingSection(null);
          }}
        >
          Delete Section
        </button>
        <button type="button" onClick={() => setEditingSection(null)}>
          Cancel
        </button>
        <button
          type="button"
          disabled={editingSection.kind !== 'area' && !sectionNameDraft.trim()}
          onClick={saveSectionProperties}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

    <MapKey
      mapName={mapName}
      mapTypeId={mapTypeId}
      parentName={parentMapName}
      parentMapId={parentMapId}
      isWorldRoot={isWorldRoot}
      parentOptions={parentMapOptions}
      onParentChange={onParentMapChange}
      onMakeWorldRoot={onMakeWorldRoot}
      featureTypes={featureTypes}
      side={displayedMapKeySide}
      onSave={(name, featureTypeId) => {
        onMapMetadataChange?.(
          name,
          featureTypeId
        );
      }}
    />

    </div>
  );
});

export default MapViewport;
