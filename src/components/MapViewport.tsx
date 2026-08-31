import type { Feature } from '../models/Feature';
import { Fragment, useEffect, useRef, useState} from 'react';
import { useRegionsState } from '../state/RegionsStateContext';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
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

interface MapViewportProps {
  imageUrl: string;
  mapName: string;
  imageRegistration?: {
  scale: number;
  offsetX: number;
  offsetY: number;
};

features: Feature[];
focusFeatureId?: string | null;

onFocusFeatureComplete?: () => void;

onEnterFeature?: (feature: Feature) => void;
onSubtitleChange?: (featureId: string, subtitle: string) => void;
secondaryActions?: FeaturePopupAction[];

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
  imageRegistration,
  features,
  focusFeatureId,
  onFocusFeatureComplete,
  onEnterFeature,
  onSubtitleChange,
  secondaryActions = [],
  onNewFeatureRequest,
  onNewLocationRequest,
  onZoomStateChange,
}: MapViewportProps) {
  const { state, dispatch } = useRegionsState();
  const { scale, panX, panY } = state.viewport;
  const pan = { x: panX, y: panY };
  const contextMenu = state.contextMenu;
  const popupOffset = state.selectedFeaturePopupOffset;
  const { layerVisibility } = state;
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
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleDraft, setSubtitleDraft] = useState('');
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

  const [popupSize, setPopupSize] = useState<Size>({
    width: 240,
    height: 140,
  });

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
    const scaledWidth = registeredWidth * candidateScale;

    const scaledHeight = registeredHeight * candidateScale;

    const maxX =
      Math.max(
        0,
        (
          scaledWidth -
          viewportSize.width
        ) / 2
      );

    const maxY =
      Math.max(
        0,
        (
          scaledHeight -
          viewportSize.height
        ) / 2
      );

    return {
      x:
        Math.max(
          -maxX,
          Math.min(
            maxX,
            candidate.x
          )
        ),

      y:
        Math.max(
          -maxY,
          Math.min(
            maxY,
            candidate.y
          )
        ),
    };
  }

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

    const maxX = Math.max(
      0,
      (registeredWidth * minScale - viewportSize.width) / 2
    );
    const maxY = Math.max(
      0,
      (registeredHeight * minScale - viewportSize.height) / 2
    );
    const nextPan = {
      x: Math.max(
        -maxX,
        Math.min(maxX, -feature.position.x * minScale)
      ),
      y: Math.max(
        -maxY,
        Math.min(maxY, -feature.position.y * minScale)
      ),
    };

    dispatch({
      type: 'viewport.set',
      viewport: {
        scale: minScale,
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
    minScale,
    registeredHeight,
    registeredWidth,
    viewportSize.height,
    viewportSize.width,
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
  dispatch({ type: 'feature.clearSelection' });

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
  const hasLocationTarget = Boolean(
    selectedFeature?.targetMapId && selectedFeature.targetFeatureId
  );

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
      className={
        dragging
          ? 'map-viewport dragging'
          : 'map-viewport'
      }
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
  const screenPosition = mapToScreen(
    feature.position.x,
    feature.position.y
  );

  return (
    <Fragment key={feature.id}>
      <button
        type="button"
        className={state.selectedFeatureId === feature.id
          ? 'map-feature-marker selected'
          : 'map-feature-marker'}
        title={feature.name}
        aria-pressed={state.selectedFeatureId === feature.id}
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => dispatch({
          type: 'feature.select',
          featureId: feature.id,
        })}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dispatch({ type: 'contextMenu.close' });
        }}
      >
        <span className="map-feature-dot" />
      </button>

      {layerVisibility.names && (
        <span
          className="map-feature-label"
          style={{
            left: screenPosition.x,
            top: screenPosition.y,
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
  >
    <div
      className="feature-popup-header"
      onPointerDown={handlePopupPointerDown}
      onPointerMove={handlePopupPointerMove}
      onPointerUp={endPopupDrag}
      onPointerCancel={endPopupDrag}
    >
      <div className="feature-popup-name">
        {selectedFeature.name}
      </div>

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

    <div className="feature-popup-actions">
  <div className="feature-popup-actions-label">
    Actions
  </div>

  <button
    type="button"
    className="feature-popup-more-actions-toggle"
    aria-expanded={actionsExpanded}
    aria-label={actionsExpanded
      ? 'Hide actions'
      : 'Show actions'}
    onClick={() => {
      setExpandedActionsFeatureId(
        actionsExpanded ? null : selectedFeature.id
      );
    }}
  >
    {actionsExpanded ? '▴' : '▾'}
  </button>

  {actionsExpanded && (
    <div className="feature-popup-secondary-actions">
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

    <div className="feature-popup-separator" />

    <div className="feature-popup-data">
      {selectedFeature.description || (
        <span>No additional information.</span>
      )}
    </div>
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
  </div>
)}    
    </div>
  );
}

export default MapViewport;
