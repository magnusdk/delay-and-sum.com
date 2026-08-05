import { useRef, useEffect } from "preact/hooks";
import * as state from "../state.js";
import { getState } from "../state.js";
import { initTimeline, renderTimelineFrame } from "../simulation.js";
import { createHiddenGL } from "../webgl.js";

function TimelineTicks() {
  const [width, height] = state.timelineContainerSize.value;
  if (!width || !height) return null;

  const offset = state.timelineOffset.value;
  const length = state.timelineLength.value;
  // The tick-interval search below runs until it finds an interval large
  // enough, which never terminates for a non-finite target.
  if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) return null;
  const minTickSpacingPx = 80;
  const microsecondsPerPx = (length / width) * 1e6;
  const rawIntervalUs = microsecondsPerPx * minTickSpacingPx;

  let tickIntervalUs = null;
  for (let mag = 1; !tickIntervalUs; mag *= 10) {
    for (const m of [1, 2, 5]) {
      if (mag * m >= rawIntervalUs) {
        tickIntervalUs = mag * m;
        break;
      }
    }
  }

  const tickIntervalS = tickIntervalUs * 1e-6;
  const minTime = offset;
  const maxTime = offset + length;
  const minTickIndex = Math.floor(minTime / tickIntervalS);
  const maxTickIndex = Math.ceil(maxTime / tickIntervalS);

  const ticks = [];
  for (let i = minTickIndex; i <= maxTickIndex; i++) {
    const timeValue = i * tickIntervalS;
    const labelUs = (timeValue * 1e6).toFixed(0);
    const screenX = ((timeValue - offset) / length) * width;
    if (screenX >= 0 && screenX <= width) {
      ticks.push(
        <span
          class="grid-tick x-tick"
          key={i}
          style={{ left: screenX, top: height - 13 }}
        >
          {labelUs + "\u03BCs"}
        </span>
      );
    }
  }

  return <div>{ticks}</div>;
}

function TimeCursor() {
  const interval = state.timelineLength.value;
  const perc = (state.time.value - state.timelineOffset.value) / interval;
  const draggable = state.timelineDraggable.value;
  const dragging = draggable.dragging === "timeline-cursor";

  const classes = [
    "timeline-time-cursor",
    dragging && "timeline-time-cursor-dragging",
  ].filter(Boolean).join(" ");

  return (
    <div
      class={classes}
      style={{ left: `${100 * perc}%`, top: 0 }}
    />
  );
}

export function Timeline() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderDataRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      state.timelineContainerSize.value = [el.offsetWidth, el.offsetHeight];
    };
    window.addEventListener("resize", updateSize);
    updateSize();

    let dragging = false;

    const setTimeFromPointer = (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = el.offsetWidth;
      const offset = state.timelineOffset.value;
      const length = state.timelineLength.value;
      const t = offset + (x / width) * length;
      state.time.value = Math.max(offset, Math.min(offset + length, t));
    };

    const onPointerDown = (e) => {
      dragging = true;
      state.forceCurrentTimeAtFocus.value = false;
      state.timelineDraggable.value = { ...state.timelineDraggable.value, dragging: "timeline-cursor" };
      setTimeFromPointer(e);
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      setTimeFromPointer(e);
    };

    const onPointerUp = (e) => {
      dragging = false;
      state.timelineDraggable.value = { ...state.timelineDraggable.value, dragging: null };
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);

    const gl = createHiddenGL();
    if (gl) {
      renderDataRef.current = initTimeline(gl);

      function renderLoop() {
        const st = getState();
        const rd = renderDataRef.current;
        if (rd && canvasRef.current) {
          renderTimelineFrame(rd, st, canvasRef.current);
        }
        animFrameRef.current = requestAnimationFrame(renderLoop);
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      window.removeEventListener("resize", updateSize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div id="timelineContainer" class="stackedContainer" ref={containerRef}>
      <canvas class="fillSpace" ref={canvasRef} />
      <TimeCursor />
      <TimelineTicks />
    </div>
  );
}
