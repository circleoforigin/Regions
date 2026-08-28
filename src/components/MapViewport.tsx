import {
  useEffect,
  useRef,
  useState,
} from 'react';

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
    }
  ) => void;
}

function MapViewport({
  imageUrl,
  mapName,
  onZoomStateChange,
}: MapViewportProps) {
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
    scale,
    setScale,
  ] = useState(1);

  const [
    pan,
    setPan,
  ] = useState<Point>({
    x: 0,
    y: 0,
  });

  const [
    dragging,
    setDragging,
  ] = useState(false);

  const [
    contextMenu,
    setContextMenu,
    ] = useState<{
    screenX: number;
    screenY: number;
    mapX: number;
    mapY: number;
    } | null>(
    null
    );

  const minScale =
    imageSize.width > 0 &&
    imageSize.height > 0 &&
    viewportSize.width > 0 &&
    viewportSize.height > 0
      ? Math.max(
          viewportSize.width /
            imageSize.width,
          viewportSize.height /
            imageSize.height
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
    const scaledWidth =
      imageSize.width *
      candidateScale;

    const scaledHeight =
      imageSize.height *
      candidateScale;

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
  const viewport =
    viewportRef.current;

  if (
    !viewport ||
    imageSize.width <= 0 ||
    imageSize.height <= 0 ||
    scale <= 0
  ) {
    return null;
  }

  const rect =
    viewport.getBoundingClientRect();

  const screenFromCenter = {
    x:
      clientX -
      rect.left -
      rect.width / 2,

    y:
      clientY -
      rect.top -
      rect.height / 2,
  };

  const imageFromCenter = {
    x:
      (
        screenFromCenter.x -
        pan.x
      ) / scale,

    y:
      (
        screenFromCenter.y -
        pan.y
      ) / scale,
  };

  const mapPoint = {
    x:
      imageFromCenter.x +
      imageSize.width / 2,

    y:
      imageFromCenter.y +
      imageSize.height / 2,
  };

  if (
    mapPoint.x < 0 ||
    mapPoint.y < 0 ||
    mapPoint.x > imageSize.width ||
    mapPoint.y > imageSize.height
  ) {
    return null;
  }

  return mapPoint;
}

function mapToScreen(
  mapX: number,
  mapY: number
): Point {
  const imageFromCenter = {
    x:
      mapX -
      imageSize.width / 2,

    y:
      mapY -
      imageSize.height / 2,
  };

  return {
    x:
      viewportSize.width / 2 +
      pan.x +
      imageFromCenter.x *
        scale,

    y:
      viewportSize.height / 2 +
      pan.y +
      imageFromCenter.y *
        scale,
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
      setScale(
        nextScale
      );

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

    setScale(
      nextScale
    );

    setPan(
      clampPan(
        nextPan,
        nextScale
      )
    );
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

    setScale(
      (current) =>
        Math.max(
          fittedScale,
          Math.min(
            Math.max(
              1,
              fittedScale
            ),
            current
          )
        )
    );

    setPan(
      (current) =>
        clampPan(
          current,
          Math.max(
            fittedScale,
            Math.min(
              Math.max(
                1,
                fittedScale
              ),
              scale
            )
          )
        )
    );
  }, [
    viewportSize.width,
    viewportSize.height,
    imageSize.width,
    imageSize.height,
  ]);

  useEffect(() => {
    setPan({
      x: 0,
      y: 0,
    });

    setScale(1);

    setImageSize({
      width: 0,
      height: 0,
    });
  }, [imageUrl]);

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

  setContextMenu({
    screenX:
      event.clientX -
      rect.left,

    screenY:
      event.clientY -
      rect.top,

    mapX:
      point.x,

    mapY:
      point.y,
  });
}

  function handleWheel(
    event:
      React.WheelEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    setContextMenu(null);

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

    setContextMenu(null);

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

    setPan(
      clampPan(
        nextPan
      )
    );
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
            `calc(50% + ${pan.x}px)`,

          top:
            `calc(50% + ${pan.y}px)`,

          transform:
            `translate(-50%, -50%) scale(${scale})`,
        }}
        {contextMenu && (
  <div
    className="map-context-menu"
    style={{
      left:
        contextMenu.screenX,

      top:
        contextMenu.screenY,
    }}
    onPointerDown={(event) =>
      event.stopPropagation()
    }
  >
    <button
      type="button"
      onClick={() => {
        console.log(
          'New Feature at:',
          contextMenu.mapX,
          contextMenu.mapY
        );

        setContextMenu(
          null
        );
      }}
    >
      New Feature...
    </button>

    <button
      type="button"
      onClick={() => {
        console.log(
          'New Location at:',
          contextMenu.mapX,
          contextMenu.mapY
        );

        setContextMenu(
          null
        );
      }}
    >
      New Location...
    </button>
  </div>
)}
      />      
    </div>
  );
}

export default MapViewport;