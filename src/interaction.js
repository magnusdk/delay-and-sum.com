const PANNING_SPEED = 2e-3;
const SCALING_SPEED = 1e-2;

export function initInteraction(element, options) {
  const {
    getPos, getDraggables, onCameraZoom, onCameraPan, onCameraTransform,
    hoverDistance = 10 * (window.devicePixelRatio || 1),
    supportCameraGestures = true,
    onHoverChange, onDragChange,
  } = options;

  let inputState = "idle";
  let dragState = "idle";
  let hoveredDraggable = null;
  let draggedDraggable = null;
  let previousPos = null;
  let currentPos = null;
  let snapToGrid = false;
  let previousTouches = {};

  function getOffsetPos(e) {
    const rect = element.getBoundingClientRect();
    return [e.pageX - (rect.left + window.pageXOffset), e.pageY - (rect.top + window.pageYOffset)];
  }

  function distanceToDraggable(draggable, point) {
    if (draggable.type === "point") {
      const dx = draggable.pos[0] - point[0], dy = draggable.pos[1] - point[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    if (draggable.type === "line") {
      const [a, b] = draggable.corners;
      const ba = [b[0] - a[0], b[1] - a[1]];
      const pa = [point[0] - a[0], point[1] - a[1]];
      const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1]) / (ba[0] * ba[0] + ba[1] * ba[1])));
      const dx = pa[0] - h * ba[0], dy = pa[1] - h * ba[1];
      return Math.sqrt(dx * dx + dy * dy);
    }
    return Infinity;
  }

  function closestDraggable(point) {
    let best = null, bestScore = Infinity;
    for (const d of getDraggables()) {
      const dist = distanceToDraggable(d, point);
      const score = dist + (d.priority || 0) * hoverDistance;
      if (score < bestScore) { bestScore = score; best = d; }
    }
    return best ? { ...best, distance: distanceToDraggable(best, point) } : null;
  }

  function startDrag(pointerPos) {
    const closest = closestDraggable(pointerPos.offset);
    if (!closest || closest.distance >= hoverDistance) return;
    draggedDraggable = closest;
    previousPos = currentPos = pointerPos;
    dragState = "dragging";
    onDragChange?.(draggedDraggable);
    const space = snapToGrid ? "simulationSnapToGrid" : "simulation";
    draggedDraggable.update(pointerPos[space], pointerPos[space], snapToGrid);
  }

  function continueDrag(pointerPos) {
    previousPos = currentPos;
    currentPos = pointerPos;
    const space = snapToGrid ? "simulationSnapToGrid" : "simulation";
    draggedDraggable.update(previousPos[space], currentPos[space], snapToGrid);
  }

  function endDrag() {
    draggedDraggable = null;
    dragState = "idle";
    onDragChange?.(null);
  }

  function updateHover(pointerPos) {
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
  }

  function handleWheel(e) {
    if (!supportCameraGestures) return;
    e.preventDefault();
    if (e.ctrlKey) {
      const pointerPos = getPos(element, getOffsetPos(e));
      onCameraZoom(pointerPos.simulation, Math.exp(e.deltaY * SCALING_SPEED));
      inputState = "wheel-zoom";
    } else {
      const cameraScale = typeof options.getCameraScale === "function" ? options.getCameraScale() : 1;
      onCameraPan(e.deltaX * cameraScale * PANNING_SPEED, e.deltaY * cameraScale * PANNING_SPEED);
      inputState = "wheel-pan";
    }
  }

  function handleMouseDown(e) {
    if (inputState === "touch") return;
    startDrag(getPos(element, getOffsetPos(e)));
    inputState = "single-touch";
  }

  function handleMouseMove(e) {
    if (inputState === "touch") return;
    const pointerPos = getPos(element, getOffsetPos(e));
    if (inputState === "single-touch" && dragState === "dragging") {
      continueDrag(pointerPos);
    } else if (inputState === "idle" || inputState === "wheel-pan" || inputState === "wheel-zoom") {
      updateHover(pointerPos);
      inputState = "idle";
    }
  }

  function handleMouseUp(e) {
    if (inputState === "touch") return;
    if (dragState === "dragging") {
      endDrag();
      updateHover(getPos(element, getOffsetPos(e)));
    }
    inputState = "idle";
  }

  function getTouches(e) {
    const touches = {};
    const rect = element.getBoundingClientRect();
    for (const t of e.touches)
      touches[t.identifier] = [t.pageX - (rect.left + window.pageXOffset), t.pageY - (rect.top + window.pageYOffset)];
    return touches;
  }

  function touchCenter(touches, t = v => v) {
    const vals = Object.values(touches);
    let sx = 0, sy = 0;
    for (const v of vals) { const tv = t(v); sx += tv[0]; sy += tv[1]; }
    return [sx / vals.length, sy / vals.length];
  }

  function touchDistance(touches, t = v => v) {
    const vals = Object.values(touches);
    if (vals.length !== 2) return 0;
    const a = t(vals[0]), b = t(vals[1]);
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

    if (prevCount === 0 && nextCount === 1) startDrag(pointerPos);
    else if (prevCount === 1 && nextCount === 1 && dragState === "dragging") continueDrag(pointerPos);
    else if (nextCount !== 1 && dragState === "dragging") endDrag();

    if (supportCameraGestures && prevCount === 2 && nextCount === 2) {
      const toSim = v => getPos(element, v).simulation;
      const prevCenter = touchCenter(prev, toSim), nextCenter = touchCenter(next, toSim);
      onCameraTransform?.({
        anchor: touchCenter(next, toSim),
        scale: touchDistance(prev, toSim) / touchDistance(next, toSim),
        dx: prevCenter[0] - nextCenter[0],
        dy: prevCenter[1] - nextCenter[1],
      });
    }
  }

  function handleKey(e) { snapToGrid = e.shiftKey; }

  element.addEventListener("wheel", handleWheel, { passive: false });
  element.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  element.addEventListener("touchstart", handleTouch, { passive: false });
  element.addEventListener("touchmove", handleTouch, { passive: false });
  element.addEventListener("touchcancel", handleTouch, { passive: false });
  element.addEventListener("touchend", handleTouch, { passive: false });
  document.addEventListener("keydown", handleKey);
  document.addEventListener("keyup", handleKey);

  return function cleanup() {
    element.removeEventListener("wheel", handleWheel);
    element.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    element.removeEventListener("touchstart", handleTouch);
    element.removeEventListener("touchmove", handleTouch);
    element.removeEventListener("touchcancel", handleTouch);
    element.removeEventListener("touchend", handleTouch);
    document.removeEventListener("keydown", handleKey);
    document.removeEventListener("keyup", handleKey);
  };
}
