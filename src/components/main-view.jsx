import { useRef, useEffect } from "preact/hooks";
import * as state from "../state.js";
import { getState } from "../state.js";
import {
  initMainSimulation,
  renderMainFrame,
  elementGeometry,
  screenToWorldMatrix,
  worldToScreenMatrix,
  worldToCanvasMatrix,
  canvasViewportScaling,
  metersPerPixel,
  transformPoint,
  transformPoints,
  scaleVector,
  zoomCamera,
  panCamera,
  updateFromCorners,
  sub,
  add,
  mul,
  len,
  normalize,
  dist,
} from "../simulation.js";
import { initInteraction } from "../interaction.js";
import { createHiddenGL } from "../webgl.js";

// --- Colors ---
const LIGHT_PINK = "rgba(255, 194, 213, 1)";
const PINK = "rgba(255, 25, 94, 1)";
const CYAN = "rgba(0, 240, 255, 1)";
const BLUE = "rgba(0, 133, 255, 1)";
const DARK_BLUE = "rgba(29, 81, 153, 1)";

function withAlpha(color, alpha) {
  return color.replace(/[\d.]+\)$/, `${alpha})`);
}

// --- Overlay drawing helpers ---

function getDotSize(name, st) {
  const drag = st.simulationDraggable;
  if (drag?.dragging?.name === name) return 7;
  if (drag?.hovering?.name === name) return 6;
  return 5;
}

function drawDot(ctx, name, color, pos, st, vw, vh, cw, ch) {
  const drag = st.simulationDraggable;
  const dragging = drag?.dragging?.name === name;
  const hovering = drag?.hovering?.name === name;
  const size = getDotSize(name, st);
  const [scaleX, scaleY] = canvasViewportScaling(vw, vh, cw, ch);
  const sx = size * scaleX;
  const sy = size * scaleY;

  ctx.save();
  ctx.fillStyle = dragging ? withAlpha(color, 0.5) : color;
  if (hovering || dragging) {
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = dragging ? 5 : 4;
    ctx.shadowOffsetY = dragging ? 4 : 3;
  }
  ctx.beginPath();
  ctx.ellipse(pos[0], pos[1], sx, sy, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

function drawProbe(ctx, geo, w2c, st, vw, vh, cw, ch) {
  const positions = transformPoints(geo.positions, w2c);
  const [scaleX, scaleY] = canvasViewportScaling(vw, vh, cw, ch);
  const first = positions[0];
  const last = positions[positions.length - 1];

  ctx.beginPath();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < positions.length; i++) {
    ctx.lineTo(positions[i][0], positions[i][1]);
  }
  ctx.stroke();

  drawDot(ctx, "corner-1", DARK_BLUE, first, st, vw, vh, cw, ch);
  drawDot(ctx, "corner-2", DARK_BLUE, last, st, vw, vh, cw, ch);

  for (const [x, y] of positions) {
    ctx.save();
    ctx.fillStyle = DARK_BLUE;
    ctx.translate(x, y);
    ctx.rotate(geo.normalAzimuthRad);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2 * scaleX, 2 * scaleY, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

function drawPolygon(ctx, points, fillStyle) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.fill();
  ctx.restore();
}

function getSide(v1, v2, v) {
  const [sx, sy] = sub(v2, v1);
  const [sx2, sy2] = sub(v, v1);
  return Math.sign(sx * sy2 - sy * sx2);
}

function drawSimulationUI(canvas, st) {
  const [vw, vh] = st.simulationContainerSize;
  if (!vw || !vh) return;

  const cw = canvas.width || vw;
  const ch = canvas.height || vh;
  const dpr = window.devicePixelRatio || 1;
  const expectedW = Math.round(vw * dpr);
  const expectedH = Math.round(vh * dpr);
  if (canvas.width !== expectedW || canvas.height !== expectedH) {
    canvas.width = expectedW;
    canvas.height = expectedH;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cam = st.camera;
  const w2c = worldToCanvasMatrix(vw, vh, canvas.width, canvas.height, cam);
  const geo = elementGeometry(st);

  drawProbe(ctx, geo, w2c, st, vw, vh, canvas.width, canvas.height);

  const [vsCanvas, spCanvas] = transformPoints(
    [st.virtualSource, st.samplePoint],
    w2c
  );
  drawDot(ctx, "virtual-source", PINK, vsCanvas, st, vw, vh, canvas.width, canvas.height);
  drawDot(ctx, "sample-point", BLUE, spCanvas, st, vw, vh, canvas.width, canvas.height);

  const sampleLine = st.plotSampleLine;
  if (sampleLine) {
    const [lpC, rpC] = transformPoints([sampleLine.left, sampleLine.right], w2c);
    ctx.beginPath();
    ctx.strokeStyle = DARK_BLUE;
    ctx.moveTo(lpC[0], lpC[1]);
    ctx.lineTo(rpC[0], rpC[1]);
    ctx.stroke();
  }

  const hover = st.plotHover;
  if (hover && hover.uvX != null && hover.uvX >= -1 && hover.uvX <= 1) {
    const hpC = transformPoint(hover.pos, w2c);
    drawDot(ctx, "plot/hover-pos", DARK_BLUE, hpC, st, vw, vh, canvas.width, canvas.height);
  }
}

// --- Wave geometry drawing ---

function drawFocusedGeometry(ctx, st, geo, w2c, aspect, diagLength) {
  const vs = st.virtualSource;
  const metersToCenter = dist(vs, geo.center);
  const metersTraveled = metersToCenter - st.time * st.soundSpeed;
  const radiusVec = scaleVector([metersTraveled, 0], w2c);
  const radius = len(radiusVec);

  const [vsC, c1C, c2C, woC] = transformPoints(
    [vs, geo.corner1, geo.corner2, geo.waveOrigin],
    w2c
  );

  if (geo.nElements > 1) {
    drawPolygon(ctx, [vsC, c1C, c2C], withAlpha(CYAN, 0.3));
    const dir1 = normalize(sub(vsC, c1C));
    const dir2 = normalize(sub(vsC, c2C));
    drawPolygon(
      ctx,
      [vsC, add(vsC, mul(dir1, diagLength * 10)), add(vsC, mul(dir2, diagLength * 10))],
      withAlpha(CYAN, 0.3)
    );
  }

  const beyondVs = add(woC, mul(normalize(sub(vsC, woC)), diagLength * 10));
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.setLineDash([10, 20]);
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(woC[0], woC[1]);
  ctx.lineTo(beyondVs[0], beyondVs[1]);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.ellipse(vsC[0], vsC[1], radius * aspect, radius / aspect, 0, 0, 2 * Math.PI);
  ctx.stroke();

  if (geo.nElements > 1) {
    let a1 = geo.corner1VsAzimuth;
    let a2 = geo.corner2VsAzimuth;
    if (metersTraveled <= 0) {
      a1 += Math.PI;
      a2 += Math.PI;
    }
    if (getSide(c1C, c2C, vsC) <= 0) [a1, a2] = [a2, a1];
    ctx.beginPath();
    ctx.strokeStyle = PINK;
    ctx.arc(vsC[0], vsC[1], radius, a1, a2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlaneGeometry(ctx, st, geo, w2c, aspect, diagLength) {
  const vs = st.virtualSource;
  const waveDir = normalize(sub(vs, geo.waveOrigin));
  const waveDir90 = [-waveDir[1], waveDir[0]];

  const distVec = mul(waveDir, st.time * st.soundSpeed);
  const distScaled = scaleVector(distVec, w2c);
  const distance = distScaled[0] * waveDir[0] + distScaled[1] * waveDir[1];

  const [vsC, c1C, c2C, woC] = transformPoints(
    [vs, geo.corner1, geo.corner2, geo.waveOrigin],
    w2c
  );

  if (geo.nElements > 1) {
    drawPolygon(
      ctx,
      [
        c1C,
        add(c1C, mul(waveDir, diagLength * 10)),
        add(c2C, mul(waveDir, diagLength * 10)),
        c2C,
      ],
      withAlpha(CYAN, 0.3)
    );
  }

  const beyondVs = add(woC, mul(normalize(sub(vsC, woC)), diagLength * 10));
  const projectedLength =
    0.5 * (sub(c2C, c1C)[0] * waveDir90[0] + sub(c2C, c1C)[1] * waveDir90[1]);

  const p = add(woC, mul(waveDir, distance));

  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.setLineDash([10, 20]);
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(woC[0], woC[1]);
  ctx.lineTo(beyondVs[0], beyondVs[1]);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[0] + diagLength * 10 * waveDir90[0], p[1] + diagLength * 10 * waveDir90[1]);
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[0] - diagLength * 10 * waveDir90[0], p[1] - diagLength * 10 * waveDir90[1]);
  ctx.stroke();

  ctx.strokeStyle = PINK;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[0] + projectedLength * waveDir90[0], p[1] + projectedLength * waveDir90[1]);
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[0] - projectedLength * waveDir90[0], p[1] - projectedLength * waveDir90[1]);
  ctx.stroke();
  ctx.restore();
}

function drawDivergingGeometry(ctx, st, geo, w2c, aspect, diagLength) {
  const vs = st.virtualSource;
  const vsFlipped = sub(mul(geo.center, 2), vs);

  const dirC1 = normalize(sub(geo.corner1, vsFlipped));
  const dirC2 = normalize(sub(geo.corner2, vsFlipped));

  const metersTraveled = -st.time * st.soundSpeed - dist(vsFlipped, geo.center);
  const radiusVec = scaleVector([metersTraveled, 0], w2c);
  const radius = len(radiusVec);

  const [vsC, vsFlippedC, c1C, c2C, woC] = transformPoints(
    [vs, vsFlipped, geo.corner1, geo.corner2, geo.waveOrigin],
    w2c
  );

  if (geo.nElements > 1) {
    const sDir1 = normalize(sub(c1C, vsFlippedC));
    const sDir2 = normalize(sub(c2C, vsFlippedC));
    drawPolygon(
      ctx,
      [c1C, add(c1C, mul(sDir1, diagLength * 10)), add(c2C, mul(sDir2, diagLength * 10)), c2C],
      withAlpha(CYAN, 0.3)
    );
  }

  const beyondVs = add(woC, mul(normalize(sub(vsC, woC)), diagLength * 10));

  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  ctx.setLineDash([10, 20]);
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(woC[0], woC[1]);
  ctx.lineTo(beyondVs[0], beyondVs[1]);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.ellipse(vsFlippedC[0], vsFlippedC[1], radius * aspect, radius / aspect, 0, 0, 2 * Math.PI);
  ctx.stroke();

  if (geo.nElements > 1) {
    let a1 = geo.corner1VsAzimuth;
    let a2 = geo.corner2VsAzimuth;
    if (metersTraveled <= 0) {
      a1 += Math.PI;
      a2 += Math.PI;
    }
    if (getSide(c1C, c2C, vsFlippedC) >= 0) [a1, a2] = [a2, a1];
    ctx.beginPath();
    ctx.strokeStyle = PINK;
    ctx.arc(vsFlippedC[0], vsFlippedC[1], radius, a1, a2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaveGeometry(canvas, st) {
  const [vw, vh] = st.simulationContainerSize;
  if (!vw || !vh) return;

  const dpr = window.devicePixelRatio || 1;
  const expectedW = Math.round(vw * dpr);
  const expectedH = Math.round(vh * dpr);
  if (canvas.width !== expectedW || canvas.height !== expectedH) {
    canvas.width = expectedW;
    canvas.height = expectedH;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Clear before this check so toggling the option off wipes the last frame.
  if (!st.showSimplifiedGeometry) return;

  const cam = st.camera;
  const w2c = worldToCanvasMatrix(vw, vh, canvas.width, canvas.height, cam);
  const [scaleX, scaleY] = canvasViewportScaling(vw, vh, canvas.width, canvas.height);
  const aspect = scaleX / scaleY;
  const geo = elementGeometry(st);
  const diagLength = len([vw, vh]);

  if (st.delayModel === "focused") {
    drawFocusedGeometry(ctx, st, geo, w2c, aspect, diagLength);
  } else if (st.delayModel === "plane") {
    drawPlaneGeometry(ctx, st, geo, w2c, aspect, diagLength);
  } else if (st.delayModel === "diverging") {
    drawDivergingGeometry(ctx, st, geo, w2c, aspect, diagLength);
  }
}

// --- Grid ---

function magnitudeMap(magBase10) {
  if (magBase10 <= -3) return -3;   // mm
  if (magBase10 <= -1) return -2;   // cm
  if (magBase10 <= 2) return 0;     // m
  return 3;                          // km
}

function presentUnit(magBase10) {
  switch (magnitudeMap(magBase10)) {
    case -3: return "mm";
    case -2: return "cm";
    case 0: return "m";
    case 3: return "km";
  }
}

function presentTickValue(x, magBase10) {
  const presentedMag = magnitudeMap(magBase10);
  const nDecimals = Math.max(0, presentedMag - magBase10);
  let rounded = (x * Math.pow(10, -presentedMag)).toFixed(nDecimals);
  if (parseFloat(rounded) === 0) rounded = "0";
  return rounded + presentUnit(presentedMag);
}

function getGridCSS(ox, oy, cellSize, alpha, thickness) {
  return (
    `linear-gradient(to right, rgba(0, 0, 0, ${alpha}) ${thickness}px, transparent ${thickness}px) ` +
    `${ox}px 0 / ${cellSize}px 1px, ` +
    `linear-gradient(to bottom, rgba(0, 0, 0, ${alpha}) ${thickness}px, transparent ${thickness}px) ` +
    `0 ${oy}px / 1px ${cellSize}px`
  );
}

function Grid() {
  if (!state.showGrid.value) return null;

  const [vw, vh] = state.simulationContainerSize.value;
  if (!vw || !vh) return null;

  const cam = state.camera.value;
  const mpp = metersPerPixel(vw, vh, cam);
  const [origoX, origoY] = transformPoint([0, 0], worldToScreenMatrix(vw, vh, cam));

  const magBase10 = Math.log10(mpp);
  const magSnap = Math.ceil(magBase10);
  const approxPxPerCellMag = 2;
  const cellSize = Math.pow(10, approxPxPerCellMag - magBase10 + magSnap);
  const origoModX = ((origoX % cellSize) + cellSize) % cellSize;
  const origoModY = ((origoY % cellSize) + cellSize) % cellSize;

  const magSnapSoft = Math.ceil(magBase10 - 0.6);
  const cellSizeSoft = 100 / Math.pow(10, magBase10 - magSnapSoft);

  const magSnapTicks = Math.ceil(magBase10 - 0.3);
  const cellSizeTicks = 100 / Math.pow(10, magBase10 - magSnapTicks);

  const p = Math.max(0, Math.min(1, (cellSizeSoft - 25) / 75));
  const bg =
    getGridCSS(origoModX, origoModY, cellSize, 0.2 * (1 - p), 1) +
    "," +
    getGridCSS(origoModX, origoModY, cellSizeSoft, 0.2 * p, 1);

  const startX = origoModX - Math.ceil(origoModX / cellSizeTicks) * cellSizeTicks;
  const startY = origoModY - Math.ceil(origoModY / cellSizeTicks) * cellSizeTicks;

  const s2w = screenToWorldMatrix(vw, vh, cam);
  const xTicks = [];
  for (let xScreen = startX; xScreen < vw; xScreen += cellSizeTicks) {
    const [x] = transformPoint([xScreen, 0], s2w);
    xTicks.push(
      <span
        class="grid-tick x-tick"
        style={{ left: xScreen, top: 0 }}
      >
        {presentTickValue(x, magSnapTicks + approxPxPerCellMag)}
      </span>
    );
  }

  const yTicks = [];
  for (let yScreen = startY; yScreen < vh + cellSizeTicks; yScreen += cellSizeTicks) {
    const [, y] = transformPoint([0, yScreen], s2w);
    yTicks.push(
      <span
        class="grid-tick y-tick"
        style={{ left: 0, top: yScreen }}
      >
        {presentTickValue(y, magSnapTicks + approxPxPerCellMag)}
      </span>
    );
  }

  return (
    <div class="fillSpace" style={{ background: bg, overflow: "hidden" }}>
      {xTicks}
      {yTicks}
    </div>
  );
}

// --- Main component ---

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

    const gl = createHiddenGL();
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
      const st = getState();
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
      const st = getState();
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
