import type { Feature } from '../models/Feature';
import { Fragment, useEffect, useRef, useState} from 'react';
import { useRegionsState } from '../state/RegionsStateContext';
import { defaultLayerVisibility } from '../state/RegionsState';
import MapKey from './MapKey';
import RichTextEditor from './RichTextEditor';
import type { RichTextDocument } from '../models/RichText';
import type { FeatureTypeDefinition } from '../models/FeatureTypeDefinition';

const OVERSCROLL_RATIO = 0.5;
const FEATURE_MARKER_MIN_DISTANCE = 24;
const NAVIGATION_ZOOM_RATIO = 0.5;

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
  return Boolean(feature.targetMapId && feature.targetFeatureId);
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
  mapName: string;
  mapTypeId?: string;
  imageRegistration?: {
  scale: number;
  offsetX: number;
  offsetY: number;
};

features: Feature[];
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

function MapViewport({
  imageUrl,
  mapName,
  mapTypeId,
  imageRegistration,
  features,
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
  onDeleteFeature,
  secondaryActions = [],
  onNewFeatureRequest,
  onNewLocationRequest,
  onZoomStateChange,
  onMapMetadataChange,
}: MapViewportProps) {
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
    return isLocation(feature)
      ? layerVisibility.locations
      : layerVisibility.features;
  };
  const selectedFeature = features.find((feature) => {
    return feature.id === state.selectedFeatureId &&
      isFeatureVisible(feature);
  });
  const visibleFeatures = features.filter(isFeatureVisible);
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
      startPointer: Point;
      startPan: Point;
    } | null>(
      null
    );

  const popupDragRef = useRef<{
    pointerId: number;
    startPointer: Point;
    startOffset: Point;
  } | null>(null);

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
    setEditingName(false);
    setNameDraft(
      selectedFeature?.name ?? ''
    );
  }, [
    selectedFeature?.id,
    selectedFeature?.name,
  ]);
  
  useEffect(() => {
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
  }, [imageUrl, dispatch]);

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
      (isLocation(movingFeature)
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
  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
  event.currentTarget.releasePointerCapture(event.pointerId);
}

function handleContextMenu(
  event:
    React.MouseEvent<HTMLDivElement>
) {
  event.preventDefault();
  if (state.editingMode === 'move-feature') return;
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
    if (
      event.button !== 0
    ) {
      return;
    }

    if (state.editingMode === 'move-feature') 
    {
      const point = screenToMap(event.clientX, event.clientY);
      if (!point || !movingFeatureId) return;
      dispatch({ type: 'featureMove.preview', position: point });
      if (!isMovePositionValid(point)) return;
      suppressNextFeatureClickRef.current = true;
      onFeatureMove?.(movingFeatureId, point);
      dispatch({ type: 'featureMove.cancel' });
      return;
    }

    dispatch({ type: 'feature.clearSelection' });
    dispatch({ type: 'contextMenu.close' });

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );

    dragRef.current = {
      pointerId:
        event.pointerId,

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

    if (
      event.currentTarget
        .hasPointerCapture(
          event.pointerId
        )
    ) {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        );
    }
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
  const hasLocationTarget = Boolean(
    selectedFeature?.targetMapId && selectedFeature.targetFeatureId
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

  return (
    <div
      ref={viewportRef}
      className={[
        'map-viewport',
        dragging ? 'dragging' : '',
        state.editingMode === 'move-feature' ? 'moving-feature' : '',
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
        endDrag
      }
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
      onPointerCancel={endPopupDrag}
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
        {hasLocationTarget ? (
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
            {hasLocationTarget && (
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

            {!hasLocationTarget && secondaryActions.length === 0 && (
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

{contextMenu && (
  <div
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
      New Feature...
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
      New Location...
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

    <MapKey
      mapName={mapName}
      mapTypeId={mapTypeId}
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
}

export default MapViewport;
