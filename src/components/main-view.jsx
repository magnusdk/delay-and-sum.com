import { useRef, useEffect } from "preact/hooks";
import * as state from "../state.js";
import {
  initMainSimulation,
  renderMainFrame,
  elementGeometry,
  screenToWorldMatrix,
  worldToScreenMatrix,
  metersPerPixel,
  transformPoint,
  transformPoints,
  zoomCamera,
  panCamera,
  updateFromCorners,
  sub,
  add,
} from "../simulation.js";
import { initInteraction } from "../interaction.js";
import { Grid } from "./grid.jsx";
import { drawSimulationUI, drawWaveGeometry } from "./overlays.jsx";

export function MainView() {
  const containerRef = useRef(null);
  const waveCanvasRef = useRef(null);
  const simCanvasRef = useRef(null);
  const uiCanvasRef = useRef(null);
  const renderDataRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      state.simulationContainerSize.value = [el.offsetWidth, el.offsetHeight];
    };
    window.addEventListener("resize", updateSize);
    updateSize();

    const hiddenCanvas = document.createElement("canvas");
    const gl = hiddenCanvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    renderDataRef.current = initMainSimulation(gl);

    function getPos(element, offsetPos) {
      const [vw, vh] = state.simulationContainerSize.value;
      const cam = state.camera.value;
      const simulation = transformPoint(offsetPos, screenToWorldMatrix(vw, vh, cam));
      const mpp = metersPerPixel(vw, vh, cam);
      const magBase10 = Math.log10(mpp);
      const magSnap = 2 + Math.round(magBase10 - 0.6);
      const snapScale = Math.pow(10, -magSnap);
      const simulationSnapToGrid = [
        Math.round(simulation[0] * snapScale) / snapScale,
        Math.round(simulation[1] * snapScale) / snapScale,
      ];
      return { offset: offsetPos, simulation, simulationSnapToGrid };
    }

    function getDraggables() {
      const vs = state.virtualSource.value;
      const sp = state.samplePoint.value;
      const st = { ...getCurrentState() };
      const geo = elementGeometry(st);
      const [vw, vh] = state.simulationContainerSize.value;
      const cam = state.camera.value;
      const w2s = worldToScreenMatrix(vw, vh, cam);

      const [vsScreen, spScreen, c1Screen, c2Screen, centerScreen] =
        transformPoints([vs, sp, geo.corner1, geo.corner2, geo.center], w2s);

      const draggables = [
        {
          name: "virtual-source",
          type: "point",
          pos: vsScreen,
          update: (_, pos) => { state.virtualSource.value = pos; },
        },
        {
          name: "sample-point",
          type: "point",
          pos: spScreen,
          update: (_, pos) => { state.samplePoint.value = pos; },
        },
      ];

      if (geo.nElements === 1) {
        draggables.push({
          name: "corner-1",
          type: "point",
          pos: centerScreen,
          update: (_, pos) => {
            state.probe.value = { ...state.probe.value, center: pos };
          },
        });
      } else {
        draggables.push(
          {
            name: "corner-1",
            type: "point",
            pos: c1Screen,
            update: (_, pos) => {
              const upd = updateFromCorners(geo.corner2, pos);
              state.probe.value = { ...state.probe.value, ...upd };
            },
          },
          {
            name: "corner-2",
            type: "point",
            pos: c2Screen,
            update: (_, pos) => {
              const upd = updateFromCorners(pos, geo.corner1);
              state.probe.value = { ...state.probe.value, ...upd };
            },
          }
        );
        if (c1Screen[0] !== c2Screen[0] || c1Screen[1] !== c2Screen[1]) {
          draggables.push({
            name: "probe-body",
            type: "line",
            corners: [c1Screen, c2Screen],
            priority: 1,
            update: (prevPos, curPos, snapToGrid) => {
              if (snapToGrid) {
                state.probe.value = { ...state.probe.value, center: curPos };
              } else {
                const d = sub(curPos, prevPos);
                const p = state.probe.value;
                state.probe.value = { ...p, center: add(p.center, d) };
              }
            },
          });
        }
      }
      return draggables;
    }

    const cleanupInteraction = initInteraction(el, {
      getPos,
      getDraggables,
      getCameraScale: () => state.camera.value.scale,
      onCameraZoom: (anchor, factor) => {
        state.camera.value = zoomCamera(state.camera.value, anchor, factor);
      },
      onCameraPan: (dx, dy) => {
        state.camera.value = panCamera(state.camera.value, dx, dy);
      },
      onCameraTransform: ({ anchor, scale, dx, dy }) => {
        let cam = state.camera.value;
        cam = zoomCamera(cam, anchor, scale);
        cam = panCamera(cam, dx, dy);
        state.camera.value = cam;
      },
      onHoverChange: (d) => {
        state.simulationDraggable.value = {
          ...state.simulationDraggable.value,
          hovering: d,
        };
      },
      onDragChange: (d) => {
        state.simulationDraggable.value = {
          ...state.simulationDraggable.value,
          dragging: d,
        };
      },
    });

    function renderLoop() {
      const st = getCurrentState();
      const rd = renderDataRef.current;
      if (rd && simCanvasRef.current) {
        renderMainFrame(rd, st, simCanvasRef.current);
      }

      if (uiCanvasRef.current) {
        drawSimulationUI(uiCanvasRef.current, st);
      }
      if (waveCanvasRef.current) {
        drawWaveGeometry(waveCanvasRef.current, st);
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    }
    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("resize", updateSize);
      cleanupInteraction();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const cursor =
    state.simulationDraggable.value?.hovering ||
    state.simulationDraggable.value?.dragging
      ? "pointer"
      : "default";

  return (
    <div
      id="simulationCanvasesContainer"
      class="stackedContainer"
      ref={containerRef}
      style={{ cursor }}
    >
      <canvas class="fillSpace" ref={waveCanvasRef} />
      <canvas class="fillSpace" ref={simCanvasRef} />
      <canvas class="fillSpace" ref={uiCanvasRef} />
      <Grid />
    </div>
  );
}

function getCurrentState() {
  return {
    camera: state.camera.value,
    nPixels: state.nPixels.value,
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
    displayMode: state.displayMode.value,
    maximumAmplitudeSimulation: state.maximumAmplitudeSimulation.value,
    timelineOffset: state.timelineOffset.value,
    timelineLength: state.timelineLength.value,
    minimumDb: state.minimumDb.value,
    maximumDb: state.maximumDb.value,
    displayDb: state.displayDb.value,
    showSimplifiedGeometry: state.showSimplifiedGeometry.value,
    showGrid: state.showGrid.value,
    sampleTimelineAt: state.sampleTimelineAt.value,
    timelineGain: state.timelineGain.value,
    plotType: state.plotType.value,
    plotUseMaximumAmplitude: state.plotUseMaximumAmplitude.value,
    beamProfileSampleLineLength: state.beamProfileSampleLineLength.value,
    plotMinimumDb: state.plotMinimumDb.value,
    plotMaximumDb: state.plotMaximumDb.value,
    probe: state.probe.value,
    simulationContainerSize: state.simulationContainerSize.value,
  };
}

export { getCurrentState };
