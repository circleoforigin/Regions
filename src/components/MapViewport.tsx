import type { Feature } from '../models/Feature';
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
  closestPointOnSegment,
  pointToSegmentDistance,
} from '../sections/SectionGeometry';
import { useProximityDismiss } from '../hooks/useProximityDismiss';

const OVERSCROLL_RATIO = 0.5;
const FEATURE_MARKER_MIN_DISTANCE = 24;
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
  onInvoke: () => void;
}

export interface LocationMapMetadata {
  mapId: string;
  mapName: string;
  typeName: string;
}

interface MapViewportProps {
  imageUrl: string;
  mapId: string;
  mapName: string;
  mapTypeId?: string;
  parentMapName: string;
  parentMapId?: string;
  isWorldRoot: boolean;
  parentMapOptions: { id: string; name: string }[];
  onParentMapChange: (mapId: string) => void;
  onMakeWorldRoot: () => void;
  imageRegistration?: {
  scale: number;
  offsetX: number;
  offsetY: number;
};

features: Feature[];
pieces?: Piece[];
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
onShowLabelChange?: (featureId: string, showLabel: boolean) => void;
onFeatureTypeChange?: (
  featureId: string,
  featureTypeId: string | undefined
) => void;
onFeatureMove?: (featureId: string, position: Point) => void;
onPieceDrop?: (
  pieceId: string,
  position: Point,
  location?: Feature
) => void;
onEditPiece?: (piece: Piece) => void;
onDeletePiece?: (piece: Piece) => void;
onPieceTrackedChange?: (pieceId: string, tracked: boolean) => void;
  onFocusPiece?: (pieceId: string) => void;
onViewportCenterChange?: (position: Point) => void;
focusPiecePosition?: Point | null;
focusPieceRequestId?: number;
onFocusPieceComplete?: () => void;
secondaryActions?: FeaturePopupAction[];

onDeleteFeature?: (
  feature: Feature
) => void;

onNewFeatureRequest?: (
  x: number,
  y: number
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
  mapName,
  mapTypeId,
  parentMapName,
  parentMapId,
  isWorldRoot,
  parentMapOptions,
  onParentMapChange,
  onMakeWorldRoot,
  imageRegistration,
  features,
  pieces = [],
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
  onShowLabelChange,
  onFeatureTypeChange,
  onFeatureMove,
  onPieceDrop,
  onEditPiece,
  onDeletePiece,
  onPieceTrackedChange,
  onFocusPiece,
  onViewportCenterChange,
  focusPiecePosition,
  focusPieceRequestId,
  onFocusPieceComplete,
  onDeleteFeature,
  secondaryActions = [],
  onNewFeatureRequest,
  onNewLocationRequest,
  onNewConnectionRequest,
  pendingArrivalPlacement,
  onPendingArrivalCommit,
  onPendingArrivalCancel,
  sections = [],
  sectionNodes = [],
  sectionEdges = [],
  sectionMode = null,
  onSectionModeChange,
  onCreateSection,
  onUpdateSectionData,
  onDeleteSection,
  onSectionError,
  onZoomStateChange,
  onMapMetadataChange,
}: MapViewportProps, ref) {
  const { state, dispatch } = useRegionsState();
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
  const selectedFeature = features.find((feature) => {
    return feature.id === state.selectedFeatureId &&
      isFeatureVisible(feature);
  });
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

  const pieceDragRef = useRef<{
    pieceId: string;
    pointerId: number;
    target: HTMLButtonElement;
    startPointer: Point;
    startPosition: Point;
    grabOffset: Point;
    moved: boolean;
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
    kind: 'node' | 'edge';
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
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState('');
  const [sectionColorDraft, setSectionColorDraft] = useState('#ffffff');

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const pieceContextMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionContextMenuRef = useRef<HTMLDivElement | null>(null);

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
    return sectionMode !== null && section.kind === sectionMode;
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
  const displayedSectionNodes = sectionNodes.map((node) => {
    if (movingSectionNode?.nodeId !== node.id) return node;
    return { ...node, position: movingSectionNode.position };
  });

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
  const [expandedTypeFeatureId, setExpandedTypeFeatureId] =
    useState<string | null>(null);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [editingName, setEditingName] =
    useState(false);
  const [nameDraft, setNameDraft] =
    useState('');

  useEffect(() => {
    popupDragRef.current = null;
    setEditingName(false);
    setNameDraft(
      selectedFeature?.name ?? ''
    );
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
    if (movingLayerIsVisible) return;
    dispatch({ type: 'featureMove.cancel' });
  }, [
    dispatch,
    features,
    layerVisibility.features,
    layerVisibility.locations,
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
  }, [selectedFeature]);

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

function appendDraftNode(position: SectionPoint) {
  if (!sectionMode) return;
  const boundaryExists = sections.some((section) => {
    return section.kind === 'boundary';
  });
  if (sectionMode === 'boundary' && boundaryExists) return;
  if (!sectionDraft) {
    const node: SectionNode = {
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
  const previous = sectionDraft.nodes.at(-1);
  if (!previous) return;
  const node: SectionNode = {
    id: crypto.randomUUID(),
    mapId: previous.mapId,
    position,
  };
  const edge: SectionEdge = {
    id: crypto.randomUUID(),
    mapId: previous.mapId,
    startNodeId: previous.id,
    endNodeId: node.id,
  };
  setSectionDraft({
    ...sectionDraft,
    nodes: [...sectionDraft.nodes, node],
    edges: [...sectionDraft.edges, edge],
  });
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
  const closingEdge: SectionEdge = {
    id: crypto.randomUUID(),
    mapId: origin.mapId,
    startNodeId: last.id,
    endNodeId: origin.id,
  };
  const edges = [...sectionDraft.edges, closingEdge];
  const defaults = SECTION_DEFAULTS[sectionDraft.kind];
  const now = new Date();
  onCreateSection?.({
    id: sectionDraft.sectionId,
    mapId: origin.mapId,
    kind: sectionDraft.kind,
    name: defaults.name,
    color: defaults.color,
    edgeIds: edges.map((edge) => edge.id),
    createdAt: now,
    updatedAt: now,
  }, sectionDraft.nodes, edges);
  setSectionDraft(null);
  setSectionPointer(null);
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
  const incoming = ownerEdges.find((edge) => edge.endNodeId === nodeId);
  const outgoing = ownerEdges.find((edge) => edge.startNodeId === nodeId);
  if (!incoming || !outgoing) return;
  const shared = sections.some((section) => {
    return section.id !== owner.id &&
      (section.edgeIds.includes(incoming.id) ||
        section.edgeIds.includes(outgoing.id));
  });
  if (shared) {
    onSectionError?.('A shared Section node cannot be deleted yet.');
    return;
  }
  const replacement: SectionEdge = {
    id: crypto.randomUUID(),
    mapId: incoming.mapId,
    startNodeId: incoming.startNodeId,
    endNodeId: outgoing.endNodeId,
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
      edgeIds.splice(index, 1, first.id, second.id);
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

function handleContextMenu(
  event:
    React.MouseEvent<HTMLDivElement>
) {
  event.preventDefault();
  if (pendingArrivalPlacement) return;
  if (state.editingMode === 'move-feature') return;
  setPieceContextMenu(null);
  dispatch({ type: 'feature.clearSelection' });
  dispatch({ type: 'contextMenu.close' });

  const viewport =
    viewportRef.current;

  if (!viewport) {
    return;
  }

  const point =
    screenToMap(
      event.clientX,
      event.clientY
    );

  if (!point) {
    return;
  }

  if (!isPointInsideMap(point)) return;

  const rect =
    viewport.getBoundingClientRect();

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
  if (edge) {
    const start = displayedSectionNodes.find((node) => {
      return node.id === edge.startNodeId;
    });
    const end = displayedSectionNodes.find((node) => {
      return node.id === edge.endNodeId;
    });
    if (start && end) {
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
    event:
      React.WheelEvent<HTMLDivElement>
  ) {
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
        x:
          event.clientX,

        y:
          event.clientY,
      }
    );
  }

  function handlePointerDown(
    event:
      React.PointerEvent<HTMLDivElement>
  ) {
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
      onFeatureMove?.(movingFeatureId, point);
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
    trackEdgePointer(event.clientX, event.clientY);
    if (sectionMode || movingSectionNode) {
      const point = screenToMap(event.clientX, event.clientY);
      setSectionPointer(point);
      if (point && movingSectionNode) {
        setMovingSectionNode({ ...movingSectionNode, position: point });
      }
    }
    if (pendingArrivalPlacement) {
      const point = screenToMap(event.clientX, event.clientY);
      if (point) {
        setArrivalPreviewState({ key: arrivalPlacementKey, position: point });
      }
    }
    if (state.editingMode === 'move-feature') {
      const point = screenToMap(event.clientX, event.clientY);
      if (point) dispatch({ type: 'featureMove.preview', position: point });
      return;
    }

    const drag =
      dragRef.current;

    if (
      !drag ||
      drag.pointerId !==
        event.pointerId
    ) {
      return;
    }

    const nextPan = {
      x:
        drag.startPan.x +
        (
          event.clientX -
          drag.startPointer.x
        ),

      y:
        drag.startPan.y +
        (
          event.clientY -
          drag.startPointer.y
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
    if (event.button !== 0) return;
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
    const preview = { pieceId: drag.pieceId, position };
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
      : drag.startPosition;
    pieceDragRef.current = null;
    piecePreviewRef.current = null;
    setPiecePreview(null);
    releasePointerCaptureSafely(event.currentTarget, event.pointerId);
    if (!drag.moved) return;

    const previewScreen = mapToScreen(preview.x, preview.y);
    const location = visibleFeatures.find((feature) => {
      if (!isNavigableFeature(feature)) return false;
      const target = mapToScreen(feature.position.x, feature.position.y);
      return Math.hypot(
        previewScreen.x - target.x,
        previewScreen.y - target.y
      ) <= FEATURE_MARKER_MIN_DISTANCE;
    });
    onPieceDrop?.(drag.pieceId, preview, location);
  }

  function cancelPieceDrag() {
    pieceDragRef.current = null;
    piecePreviewRef.current = null;
    setPiecePreview(null);
    stopEdgeScrolling();
  }

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
  const connectorVisible = selectedAnchor && popupPosition
    ? Math.hypot(
        popupPosition.x - selectedAnchor.x,
        popupPosition.y - selectedAnchor.y
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
  const selectedLocationMap = selectedFeature
    ? locationMapMetadata[selectedFeature.id]
    : undefined;

    function saveName() {
  if (!selectedFeature) {
    return;
  }

  const name =
    nameDraft.trim();

  if (!name) {
    setNameDraft(
      selectedFeature.name
    );

    setEditingName(false);
    return;
  }

  onFeatureNameChange?.(
    selectedFeature.id,
    name
  );

  setEditingName(false);
}

function cancelNameEdit() {
  setNameDraft(
    selectedFeature?.name ?? ''
  );

  setEditingName(false);
}

  function saveSubtitle() {
  if (!selectedFeature) return;

  const subtitle = subtitleDraft.trim();

  onSubtitleChange?.(selectedFeature.id, subtitle);
  setEditingSubtitle(false);
}

function cancelSubtitleEdit() {
  setSubtitleDraft(selectedFeature?.subtitle ?? '');
  setEditingSubtitle(false);
}

function handleSectionNodePointerDown(
  event: React.PointerEvent<HTMLButtonElement>,
  node: SectionNode
) {
  event.stopPropagation();
  if (event.button !== 0) return;
  if (event.shiftKey) {
    event.preventDefault();
    deleteSectionNode(node.id);
    return;
  }
  if (!event.ctrlKey) return;
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
          name: sectionNameDraft.trim(),
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
        stopEdgeScrolling();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault();
      }}
      onContextMenu={
        handleContextMenu
      }
    >
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

<svg className="section-geometry-layer" aria-hidden="true">
  {visibleSections.map((section) => {
    const points = section.edgeIds.map((edgeId) => {
      const edge = sectionEdges.find((item) => item.id === edgeId);
      const node = displayedSectionNodes.find((item) => {
        return item.id === edge?.startNodeId;
      });
      return node ? mapToScreen(node.position.x, node.position.y) : null;
    }).filter((point): point is Point => point !== null);
    return (
      <polygon
        key={section.id}
        className={`section-geometry section-${section.kind}`}
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill={section.color}
        stroke={section.color}
      />
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
  const position = piecePreview?.pieceId === piece.id
    ? piecePreview.position
    : piece.position;
  const screenPosition = mapToScreen(position.x, position.y);
  const className = [
    'map-piece',
    `map-piece-${piece.appearance.shape}`,
    piece.id === focusedPieceId ? 'focused' : '',
    piecePreview?.pieceId === piece.id ? 'dragging' : '',
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
          borderColor: piece.appearance.borderColor,
        }}
        onPointerDown={(event) => handlePiecePointerDown(event, piece)}
        onPointerMove={handlePiecePointerMove}
        onPointerUp={handlePiecePointerUp}
        onPointerCancel={cancelPieceDrag}
        onLostPointerCapture={cancelPieceDrag}
        onContextMenu={(event) => {
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
        }}
      />
      <span
        className="map-piece-label"
        style={{ left: screenPosition.x, top: screenPosition.y }}
      >
        {piece.name}
      </span>
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

{visibleFeatures.map((feature) => {
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
  const markerClasses = [
    'map-feature-marker',
    isConnection(feature) ? 'map-feature-connection' : '',
    state.selectedFeatureId === feature.id ? 'selected' : '',
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
          if (state.editingMode === 'move-feature') return;
          setPieceContextMenu(null);
          event.stopPropagation();
        }}
        onClick={() => {
            if (suppressNextFeatureClickRef.current) {
                suppressNextFeatureClickRef.current = false;
                return;
            }

            if (state.editingMode === 'move-feature') return;

            dispatch({ type: 'feature.select', featureId: feature.id  });
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPieceContextMenu(null);
          if (state.editingMode === 'move-feature') return;
          const viewport = viewportRef.current;
          const point = screenToMap(event.clientX, event.clientY);
          if (!viewport || !point) return;
          const rect = viewport.getBoundingClientRect();
          dispatch({ type: 'feature.clearSelection' });
          dispatch({
            type: 'contextMenu.open',
            menu: {
              kind: 'feature',
              targetId: feature.id,
              screenX: event.clientX - rect.left,
              screenY: event.clientY - rect.top,
              mapX: point.x,
              mapY: point.y,
            },
          });
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

{connectorVisible && selectedAnchor && popupPosition && (
  <svg className="feature-popup-connector" aria-hidden="true">
    <line
  className="connector-outline"
  x1={selectedAnchor.x}
  y1={selectedAnchor.y}
  x2={popupPosition.x}
  y2={popupPosition.y}
/>

<line
  className="connector-line"
  x1={selectedAnchor.x}
  y1={selectedAnchor.y}
  x2={popupPosition.x}
  y2={popupPosition.y}
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
                onFeatureTypeChange?.(selectedFeature.id, undefined);
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
                  onFeatureTypeChange?.(selectedFeature.id, type.id);
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
                onClick={() => onEnterFeature?.(selectedFeature)}
              >
                Enter
              </button>
            )}

            {secondaryActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled}
                onClick={action.onInvoke}
              >
                {action.label}
              </button>
            ))}

            {!hasNavigationTarget && secondaryActions.length === 0 && (
              <span className="feature-popup-no-actions">
                No actions available.
              </span>
            )}
          </div>
        )}
      </div>
    </div>

    <div className="feature-popup-separator" />

    <RichTextEditor
      key={selectedFeature.id}
      value={selectedFeature.description}
      onChange={(description) => {
        onDescriptionChange?.(selectedFeature.id, description);
      }}
    />
  </div>
)}

{sectionContextMenu && (
  <div
    ref={sectionContextMenuRef}
    className="map-context-menu section-context-menu"
    style={{ left: sectionContextMenu.x, top: sectionContextMenu.y }}
    onPointerDown={(event) => event.stopPropagation()}
  >
    {sectionContextMenu.kind === 'node' ? (
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
        <div className="map-context-separator" />
        <button
          type="button"
          onClick={() => {
            const owner = getSectionOwner(sectionContextMenu.id);
            if (owner) openSectionProperties(owner);
          }}
        >
          Section...
        </button>
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
            New Section
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
    ) : (
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
    )}
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
      <div className="map-context-separator" />
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

{editingSection && (
  <div className="dialog-backdrop">
    <div className="dialog section-properties-dialog">
      <h2>
        {SECTION_DEFAULTS[editingSection.kind].name} Properties
      </h2>
      <label>
        Name
        <input
          type="text"
          value={sectionNameDraft}
          onChange={(event) => setSectionNameDraft(event.target.value)}
          autoFocus
        />
      </label>
      <label>
        Color
        <input
          type="color"
          value={sectionColorDraft}
          onChange={(event) => setSectionColorDraft(event.target.value)}
        />
      </label>
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
          disabled={!sectionNameDraft.trim()}
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
