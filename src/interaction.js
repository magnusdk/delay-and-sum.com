/**
 * Interaction system: pointer events, dragging, and touch gestures.
 * Ports the 3-layer FSM architecture from the original ClojureScript app.
 */

// ---- Layer 1: Input Events ----

const PANNING_SPEED = 2e-3;
const SCALING_SPEED = 1e-2;

/**
 * Initialize pointer/wheel/touch interaction on an element.
 *
 * @param {HTMLElement} element - The DOM element to attach events to
 * @param {object} options
 * @param {function} options.getPos - (element, offsetPos) => { offset, simulation, simulationSnapToGrid }
 * @param {function} options.getDraggables - () => [{ name, type, pos, corners?, update, priority? }]
 * @param {function} options.onCameraZoom - (anchorSimPos, scalingFactor) => void
 * @param {function} options.onCameraPan - (dx, dy) => void
 * @param {function} options.onCameraTransform - (matrix) => void  (for touch gestures)
 * @param {number}   [options.hoverDistance] - Pixel distance for hover detection (default: 10 * dpr)
 * @param {boolean}  [options.supportCameraGestures] - Enable wheel pan/zoom and pinch (default: true)
 * @param {function} [options.onHoverChange] - (hoveredDraggable | null) => void
 * @param {function} [options.onDragChange] - (draggedDraggable | null) => void
 * @returns {function} cleanup - Call to remove all event listeners
 */
export function initInteraction(element, options) {
  const {
    getPos,
    getDraggables,
    onCameraZoom,
    onCameraPan,
    onCameraTransform,
    hoverDistance = 10 * (window.devicePixelRatio || 1),
    supportCameraGestures = true,
    onHoverChange,
    onDragChange,
  } = options;

  // ---- FSM state ----
  let inputState = "idle"; // idle | wheel-pan | wheel-zoom | single-touch | touch
  let dragState = "idle"; // idle | hovering | dragging

  let hoveredDraggable = null;
  let draggedDraggable = null;
  let previousPos = null;
  let currentPos = null;
  let snapToGrid = false;

  // Touch state
  let previousTouches = {};

  // ---- Helpers ----

  function getOffsetPos(event) {
    const rect = element.getBoundingClientRect();
    return [
      event.pageX - (rect.left + window.pageXOffset),
      event.pageY - (rect.top + window.pageYOffset),
    ];
  }

  // ---- Draggable distance ----

  function distanceToDraggable(draggable, point) {
    if (draggable.type === "point") {
      const dx = draggable.pos[0] - point[0];
      const dy = draggable.pos[1] - point[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    if (draggable.type === "line") {
      const [a, b] = draggable.corners;
      const ba = [b[0] - a[0], b[1] - a[1]];
      const pa = [point[0] - a[0], point[1] - a[1]];
      const dotPaBa = pa[0] * ba[0] + pa[1] * ba[1];
      const dotBaBa = ba[0] * ba[0] + ba[1] * ba[1];
      const h = Math.max(0, Math.min(1, dotPaBa / dotBaBa));
      const dx = pa[0] - h * ba[0];
      const dy = pa[1] - h * ba[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    return Infinity;
  }

  function closestDraggable(point) {
    const draggables = getDraggables();
    let best = null;
    let bestScore = Infinity;
    for (const d of draggables) {
      const dist = distanceToDraggable(d, point);
      const score = dist + (d.priority || 0) * hoverDistance;
      if (score < bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best ? { ...best, distance: distanceToDraggable(best, point) } : null;
  }

  // ---- Custom events ----

  function dispatchCustom(type, detail) {
    element.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---- Wheel handling ----

  function handleWheel(e) {
    if (!supportCameraGestures) return;
    e.preventDefault();

    if (e.ctrlKey) {
      // Zoom
      const offsetPos = getOffsetPos(e);
      const pointerPos = getPos(element, offsetPos);
      const scalingFactor = Math.exp(e.deltaY * SCALING_SPEED);
      onCameraZoom(pointerPos.simulation, scalingFactor);
      inputState = "wheel-zoom";
    } else {
      // Pan
      const cameraScale =
        typeof options.getCameraScale === "function"
          ? options.getCameraScale()
          : 1;
      const tx = e.deltaX * cameraScale * PANNING_SPEED;
      const ty = e.deltaY * cameraScale * PANNING_SPEED;
      onCameraPan(tx, ty);
      inputState = "wheel-pan";
    }
  }

  // ---- Mouse handling ----

  function handleMouseDown(e) {
    if (inputState === "touch") return;
    const offsetPos = getOffsetPos(e);
    const pointerPos = getPos(element, offsetPos);

    // Try to start dragging
    const closest = closestDraggable(pointerPos.offset);
    if (closest && closest.distance < hoverDistance) {
      draggedDraggable = closest;
      previousPos = pointerPos;
      currentPos = pointerPos;
      dragState = "dragging";
      onDragChange?.(draggedDraggable);
      // Initial update (move to clicked position)
      draggedDraggable.update(pointerPos.simulation, pointerPos.simulation);
    }

    inputState = "single-touch";
  }

  function handleMouseMove(e) {
    if (inputState === "touch") return;
    const offsetPos = getOffsetPos(e);
    const pointerPos = getPos(element, offsetPos);

    if (inputState === "single-touch" && dragState === "dragging") {
      // Drag
      previousPos = currentPos;
      currentPos = pointerPos;
      const space = snapToGrid ? "simulationSnapToGrid" : "simulation";
      draggedDraggable.update(previousPos[space], currentPos[space], snapToGrid);
    } else if (inputState === "idle" || inputState === "wheel-pan" || inputState === "wheel-zoom") {
      // Hover
      const closest = closestDraggable(pointerPos.offset);
      if (closest && closest.distance < hoverDistance) {
        if (hoveredDraggable?.name !== closest.name) {
          hoveredDraggable = closest;
          dragState = "hovering";
          onHoverChange?.(hoveredDraggable);
        }
      } else if (hoveredDraggable) {
        hoveredDraggable = null;
        dragState = "idle";
        onHoverChange?.(null);
      }
      inputState = "idle";
    }
  }

  function handleMouseUp(e) {
    if (inputState === "touch") return;
    if (dragState === "dragging") {
      draggedDraggable = null;
      dragState = "idle";
      onDragChange?.(null);

      // Check for hover
      const offsetPos = getOffsetPos(e);
      const pointerPos = getPos(element, offsetPos);
      const closest = closestDraggable(pointerPos.offset);
      if (closest && closest.distance < hoverDistance) {
        hoveredDraggable = closest;
        dragState = "hovering";
        onHoverChange?.(hoveredDraggable);
      } else {
        hoveredDraggable = null;
        onHoverChange?.(null);
      }
    }
    inputState = "idle";
  }

  // ---- Touch handling ----

  function getTouches(e) {
    const touches = {};
    const rect = element.getBoundingClientRect();
    for (const touch of e.touches) {
      touches[touch.identifier] = [
        touch.pageX - (rect.left + window.pageXOffset),
        touch.pageY - (rect.top + window.pageYOffset),
      ];
    }
    return touches;
  }

  function touchCenter(touches, transform) {
    const vals = Object.values(touches);
    const t = transform || ((v) => v);
    let sx = 0, sy = 0;
    for (const v of vals) {
      const tv = t(v);
      sx += tv[0];
      sy += tv[1];
    }
    return [sx / vals.length, sy / vals.length];
  }

  function touchDistance(touches, transform) {
    const vals = Object.values(touches);
    if (vals.length !== 2) return 0;
    const t = transform || ((v) => v);
    const a = t(vals[0]);
    const b = t(vals[1]);
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
  }

  function handleTouch(e) {
    e.preventDefault();
    const prev = previousTouches;
    const next = getTouches(e);
    previousTouches = next;
    inputState = "touch";

    const prevCount = Object.keys(prev).length;
    const nextCount = Object.keys(next).length;
    const pointerPos = getPos(element, Object.values(next)[0] || [0, 0]);

    // Dragging
    if (prevCount === 0 && nextCount === 1) {
      // Start drag
      const closest = closestDraggable(pointerPos.offset);
      if (closest && closest.distance < hoverDistance) {
        draggedDraggable = closest;
        previousPos = pointerPos;
        currentPos = pointerPos;
        dragState = "dragging";
        onDragChange?.(draggedDraggable);
        draggedDraggable.update(pointerPos.simulation, pointerPos.simulation);
      }
    } else if (prevCount === 1 && nextCount === 1 && dragState === "dragging") {
      // Continue drag
      previousPos = currentPos;
      currentPos = pointerPos;
      const space = snapToGrid ? "simulationSnapToGrid" : "simulation";
      draggedDraggable.update(previousPos[space], currentPos[space], snapToGrid);
    } else if (nextCount !== 1 && dragState === "dragging") {
      // End drag
      draggedDraggable = null;
      dragState = "idle";
      onDragChange?.(null);
    }

    // Pinch zoom + pan (two-finger gestures)
    if (supportCameraGestures && prevCount === 2 && nextCount === 2) {
      const toSim = (v) => getPos(element, v).simulation;
      const prevCenter = touchCenter(prev, toSim);
      const nextCenter = touchCenter(next, toSim);
      const dx = prevCenter[0] - nextCenter[0];
      const dy = prevCenter[1] - nextCenter[1];
      const scale = touchDistance(prev, toSim) / touchDistance(next, toSim);
      onCameraTransform?.({ anchor: touchCenter(next, toSim), scale, dx, dy });
    }
  }

  // ---- Keyboard (shift for snap-to-grid) ----

  function handleKeyDown(e) {
    snapToGrid = e.shiftKey;
  }

  function handleKeyUp(e) {
    snapToGrid = e.shiftKey;
  }

  // ---- Register events ----

  element.addEventListener("wheel", handleWheel, { passive: false });
  element.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("mousecancel", handleMouseUp);
  element.addEventListener("touchstart", handleTouch, { passive: false });
  element.addEventListener("touchmove", handleTouch, { passive: false });
  element.addEventListener("touchcancel", handleTouch, { passive: false });
  element.addEventListener("touchend", handleTouch, { passive: false });
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);

  // ---- Cleanup ----

  return function cleanup() {
    element.removeEventListener("wheel", handleWheel);
    element.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("mousecancel", handleMouseUp);
    element.removeEventListener("touchstart", handleTouch);
    element.removeEventListener("touchmove", handleTouch);
    element.removeEventListener("touchcancel", handleTouch);
    element.removeEventListener("touchend", handleTouch);
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
  };
}
