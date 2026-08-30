import type { Feature } from '../models/Feature';
import { useEffect, useRef, useState} from 'react';
import { useRegionsState } from '../state/RegionsStateContext';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
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
  onNewFeatureRequest,
  onNewLocationRequest,
  onZoomStateChange,
}: MapViewportProps) {
  const { state, dispatch } = useRegionsState();
  const { scale, panX, panY } = state.viewport;
  const pan = { x: panX, y: panY };
  const contextMenu = state.contextMenu;
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

  const [
    dragging,
    setDragging,
  ] = useState(false);

    const registeredWidth =
        imageSize.width * registration.scale;

    const registeredHeight =
        imageSize.height * registration.scale;

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

  const maxScale =
    Math.max(
      2,
      minScale
    );

    const zoomStep =
  Math.max(
    (
      maxScale -
      minScale
    ) / 200,
    0.001
  );

  function clampScale(
    candidate: number
  ) {
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

function handleContextMenu(
  event:
    React.MouseEvent<HTMLDivElement>
) {
  event.preventDefault();

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

{features.map((feature) => {
  const screenPosition = mapToScreen(
    feature.position.x,
    feature.position.y
  );

  return (
    <button
      key={feature.id}
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
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      onClick={() => dispatch({
        type: 'feature.select',
        featureId: feature.id,
      })}
    >
      <span className="map-feature-dot" />
    </button>
  );
})}

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
