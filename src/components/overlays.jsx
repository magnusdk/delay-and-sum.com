/**
 * Canvas2D overlay rendering: probe dots, draggable points, and wave geometry.
 */

import {
  elementGeometry,
  worldToCanvasMatrix,
  canvasViewportScaling,
  transformPoint,
  transformPoints,
  scaleVector,
  sub,
  add,
  mul,
  len,
  normalize,
  dist,
} from "../simulation.js";
import * as state from "../state.js";

// ---- Colors (matching CSS variables) ----
const LIGHT_PINK = "rgba(255, 194, 213, 1)";
const PINK = "rgba(255, 25, 94, 1)";
const CYAN = "rgba(0, 240, 255, 1)";
const BLUE = "rgba(0, 133, 255, 1)";
const DARK_BLUE = "rgba(29, 81, 153, 1)";

function withAlpha(color, alpha) {
  return color.replace(/[\d.]+\)$/, `${alpha})`);
}

// ---- Dot drawing ----

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
  if (hovering && !dragging) {
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 3;
  }
  if (dragging) {
    ctx.shadowColor = withAlpha(color, 0.5);
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
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

  // Draw line connecting elements
  ctx.beginPath();
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < positions.length; i++) {
    ctx.lineTo(positions[i][0], positions[i][1]);
  }
  ctx.stroke();

  // Corner dots
  drawDot(ctx, "corner-1", DARK_BLUE, first, st, vw, vh, cw, ch);
  drawDot(ctx, "corner-2", DARK_BLUE, last, st, vw, vh, cw, ch);

  // Element dots
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

/** Draw simulation UI overlay (probe, virtual source dot, sample point dot). */
export function drawSimulationUI(canvas, st) {
  const [vw, vh] = st.simulationContainerSize;
  if (!vw || !vh) return;

  const cw = canvas.width || vw;
  const ch = canvas.height || vh;
  // Resize canvas to match viewport pixel ratio
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

  // Beam profile sample line
  const lp = state.plotLeftMostPos.value;
  const rp = state.plotRightMostPos.value;
  if (lp && rp) {
    const [lpC, rpC] = transformPoints([lp, rp], w2c);
    ctx.beginPath();
    ctx.strokeStyle = DARK_BLUE;
    ctx.moveTo(lpC[0], lpC[1]);
    ctx.lineTo(rpC[0], rpC[1]);
    ctx.stroke();
  }

  // Beam profile hover dot
  const hoverPos = state.plotHoverPos.value;
  const hoverUvX = state.plotHoverPosUvX.value;
  if (hoverPos && hoverUvX != null && hoverUvX >= -1 && hoverUvX <= 1) {
    const hpC = transformPoint(hoverPos, w2c);
    drawDot(ctx, "plot/hover-pos", DARK_BLUE, hpC, st, vw, vh, canvas.width, canvas.height);
  }
}

// ---- Wave Geometry ----

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

/** Draw simplified wave geometry overlay. */
export function drawWaveGeometry(canvas, st) {
  if (!st.showSimplifiedGeometry) return;

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

  // Dashed line from wave origin beyond focus
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

  // Full ellipse (light pink)
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.ellipse(vsC[0], vsC[1], radius * aspect, radius / aspect, 0, 0, 2 * Math.PI);
  ctx.stroke();

  // Active arc (pink)
  if (geo.nElements > 1) {
    let a1 = geo.corner1VsAzimuth;
    let a2 = geo.corner2VsAzimuth;
    if (metersTraveled <= 0) {
      a1 += Math.PI;
      a2 += Math.PI;
    }
    const side = getSide(c1C, c2C, vsC);
    if (side > 0) {
      [a1, a2] = [a1, a2];
    } else {
      [a1, a2] = [a2, a1];
    }
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

  // Dashed line
  ctx.setLineDash([10, 20]);
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(woC[0], woC[1]);
  ctx.lineTo(beyondVs[0], beyondVs[1]);
  ctx.stroke();
  ctx.restore();

  // Wavefront line (light pink, full width)
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

  // Active wavefront (pink, probe width only)
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

  // Dashed line
  ctx.setLineDash([10, 20]);
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.moveTo(woC[0], woC[1]);
  ctx.lineTo(beyondVs[0], beyondVs[1]);
  ctx.stroke();
  ctx.restore();

  // Ellipse
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.strokeStyle = LIGHT_PINK;
  ctx.beginPath();
  ctx.ellipse(vsFlippedC[0], vsFlippedC[1], radius * aspect, radius / aspect, 0, 0, 2 * Math.PI);
  ctx.stroke();

  // Active arc
  if (geo.nElements > 1) {
    let a1 = geo.corner1VsAzimuth;
    let a2 = geo.corner2VsAzimuth;
    if (metersTraveled <= 0) {
      a1 += Math.PI;
      a2 += Math.PI;
    }
    const side = getSide(c1C, c2C, vsFlippedC);
    if (side < 0) {
      [a1, a2] = [a1, a2];
    } else {
      [a1, a2] = [a2, a1];
    }
    ctx.beginPath();
    ctx.strokeStyle = PINK;
    ctx.arc(vsFlippedC[0], vsFlippedC[1], radius, a1, a2);
    ctx.stroke();
  }
  ctx.restore();
}

export function Overlays() {
  return null; // Overlays are drawn imperatively via drawSimulationUI/drawWaveGeometry
}
