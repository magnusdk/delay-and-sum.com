import * as state from "../state.js";
import {
  metersPerPixel,
  worldToScreenMatrix,
  screenToWorldMatrix,
  transformPoint,
} from "../simulation.js";

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

export function Grid() {
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
