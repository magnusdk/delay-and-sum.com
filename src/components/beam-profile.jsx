import { useRef, useEffect } from "preact/hooks";
import * as state from "../state.js";
import {
  initBeamProfile,
  renderBeamProfileFrame,
  elementGeometry,
  normalize,
  sub,
  add,
  mul,
  rot90,
} from "../simulation.js";

/** Read beam-profile-relevant state into a plain object. */
function getBeamProfileState() {
  return {
    virtualSource: state.virtualSource.value,
    samplePoint: state.samplePoint.value,
    samplePointStrength: state.samplePointStrength.value,
    centerFrequency: state.centerFrequency.value,
    pulseLength: state.pulseLength.value,
    soundSpeed: state.soundSpeed.value,
    soundSpeedTx: state.soundSpeedTx.value,
    time: state.time.value,
    delayModel: state.delayModel.value,
    attenuationFactor: state.attenuationFactor.value,
    tukeyRoll: state.tukeyRoll.value,
    plotType: state.plotType.value,
    plotUseMaximumAmplitude: state.plotUseMaximumAmplitude.value,
    beamProfileSampleLineLength: state.beamProfileSampleLineLength.value,
    plotMinimumDb: state.plotMinimumDb.value,
    plotMaximumDb: state.plotMaximumDb.value,
    probe: state.probe.value,
    simulationContainerSize: state.simulationContainerSize.value,
  };
}

/** Compute the beam profile sample line endpoints for overlay rendering. */
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
  const x = state.plotHoverPosOffsetX.value;
  const uvX = state.plotHoverPosUvX.value;
  if (x == null || uvX == null || uvX < -1 || uvX > 1) return null;

  return (
    <div style={{
      pointerEvents: "none",
      position: "absolute",
      left: x,
      top: 0,
      height: "100%",
      width: "2px",
      backgroundColor: "rgba(29, 81, 153, 1)",
    }} />
  );
}

export function BeamProfile() {
  const plotType = state.plotType.value;
  if (plotType === "no-plot") return null;

  const canvasRef = useRef(null);
  const renderDataRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Init beam profile WebGL rendering
    const hiddenCanvas = document.createElement("canvas");
    const gl = hiddenCanvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });

    if (gl) {
      renderDataRef.current = initBeamProfile(gl);

      function renderLoop() {
        const st = getBeamProfileState();
        const rd = renderDataRef.current;
        if (rd && canvas) {
          renderBeamProfileFrame(rd, st, canvas);

          // Update sample line positions for overlay
          const line = computeSampleLine(st);
          state.plotLeftMostPos.value = line.left;
          state.plotRightMostPos.value = line.right;
        }
        animFrameRef.current = requestAnimationFrame(renderLoop);
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    // Pointer event handlers for hover position tracking
    const onPointerMove = (e) => {
      const uvX = (e.offsetX / canvas.offsetWidth) * 2 - 1;
      state.plotHoverPosUvX.value = uvX;
      state.plotHoverPosOffsetX.value = e.offsetX;

      // Calculate hover world position from beam profile geometry
      const st = getBeamProfileState();
      const line = computeSampleLine(st);
      state.plotHoverPos.value = add(line.center, mul(line.beamDir, uvX * st.beamProfileSampleLineLength / 2));
    };

    const onPointerLeave = () => {
      state.plotHoverPosUvX.value = null;
      state.plotHoverPosOffsetX.value = null;
      state.plotHoverPos.value = null;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [plotType]);

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
