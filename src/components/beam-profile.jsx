import { useRef, useEffect } from "preact/hooks";
import * as state from "../state.js";
import { getState } from "../state.js";
import {
  initBeamProfile,
  renderBeamProfileFrame,
  elementGeometry,
  sub,
  add,
  mul,
  rot90,
} from "../simulation.js";
import { createHiddenGL } from "../webgl.js";

function computeSampleLine(st) {
  const geo = elementGeometry(st);
  const isLateral = st.plotType === "lateral-beam-profile";
  const waveDir = geo.waveDirection;
  const beamDir = isLateral ? rot90(waveDir) : waveDir;
  const dist = (st.time - geo.t0) * st.soundSpeed;
  const center = add(geo.waveOrigin, mul(waveDir, dist));
  const halfLen = st.beamProfileSampleLineLength / 2;
  return {
    left: sub(center, mul(beamDir, halfLen)),
    right: add(center, mul(beamDir, halfLen)),
    center,
    beamDir,
  };
}

function HoveredLine() {
  const hover = state.plotHover.value;
  if (!hover || hover.uvX == null || hover.uvX < -1 || hover.uvX > 1) return null;

  return (
    <div style={{
      pointerEvents: "none",
      position: "absolute",
      left: hover.offsetX,
      top: 0,
      height: "100%",
      width: "2px",
      backgroundColor: "rgba(29, 81, 153, 1)",
    }} />
  );
}

export function BeamProfile() {
  const plotType = state.plotType.value;
  // This component stays mounted even with no plot open, so the hooks below
  // must run unconditionally -- bailing out before them would leave the render
  // loop and its cleanup stranded.
  const active = plotType !== "no-plot";

  const canvasRef = useRef(null);
  const renderDataRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = createHiddenGL();

    if (gl) {
      renderDataRef.current = initBeamProfile(gl);

      function renderLoop() {
        const st = getState();
        const rd = renderDataRef.current;
        // Read the ref each frame: closing and reopening the plot swaps in a
        // new canvas element.
        const target = canvasRef.current;
        if (rd && target) {
          renderBeamProfileFrame(rd, st, target);

          const line = computeSampleLine(st);
          state.plotSampleLine.value = { left: line.left, right: line.right };
        }
        animFrameRef.current = requestAnimationFrame(renderLoop);
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    const onPointerMove = (e) => {
      const uvX = (e.offsetX / canvas.offsetWidth) * 2 - 1;

      const st = getState();
      const line = computeSampleLine(st);
      const pos = add(line.center, mul(line.beamDir, uvX * st.beamProfileSampleLineLength / 2));
      state.plotHover.value = { pos, uvX, offsetX: e.offsetX };
    };

    const onPointerLeave = () => {
      state.plotHover.value = null;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      renderDataRef.current = null;
      // WebGL contexts are a limited resource; dropping the reference is not
      // enough, the browser evicts the oldest live context instead.
      if (gl) gl.getExtension("WEBGL_lose_context")?.loseContext();
      // These overlays belong to the plot, so they must not outlive it.
      state.plotSampleLine.value = null;
      state.plotHover.value = null;
    };
  }, [active, plotType]);

  if (!active) return null;

  const title = plotType === "lateral-beam-profile"
    ? "Lateral Beam Profile"
    : "Axial Beam Profile";

  return (
    <div class="plot-container">
      <button class="close-button" onClick={() => state.plotType.value = "no-plot"} />
      <h1>{title}</h1>
      <canvas class="fillSpace" ref={canvasRef} />
      <HoveredLine />
    </div>
  );
}
