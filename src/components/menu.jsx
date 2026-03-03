import { useRef, useEffect, useCallback } from "preact/hooks";
import * as state from "../state.js";
import { tukey } from "../simulation.js";

function clamp(x, min, max) {
  if (min != null && max != null) return Math.max(min, Math.min(max, x));
  if (min != null) return Math.max(min, x);
  if (max != null) return Math.min(max, x);
  return x;
}

function wrapAround(x, limit) {
  if (limit == null) return x;
  if (x < -limit) return x + 2 * limit;
  if (x > limit) return x - 2 * limit;
  return x;
}

function toStateFormat(x, opts) {
  let v = parseFloat(x);
  if (opts.wrapAround != null) v = wrapAround(v, opts.wrapAround);
  v = clamp(v, opts.min, opts.max);
  if (opts.magnitude != null) v *= opts.magnitude;
  if (Number.isNaN(v)) v = opts.min || 0;
  return v;
}

function fromStateFormat(x, opts) {
  let v = x;
  if (opts.magnitude != null) v /= opts.magnitude;
  v = clamp(v, opts.min, opts.max);
  if (opts.nDecimals != null) v = v.toFixed(opts.nDecimals);
  return v;
}

function resizeInput(el) {
  el.size = Math.max(1, String(el.value).length);
}

function getSignalValue(sig, path) {
  let v = sig.value;
  if (path) for (const k of path) v = v[k];
  return v;
}

function setSignalValue(sig, path, val) {
  if (!path || path.length === 0) {
    sig.value = val;
    return;
  }
  const clone = Array.isArray(sig.value) ? [...sig.value] : { ...sig.value };
  let obj = clone;
  for (let i = 0; i < path.length - 1; i++) {
    obj[path[i]] = Array.isArray(obj[path[i]]) ? [...obj[path[i]]] : { ...obj[path[i]] };
    obj = obj[path[i]];
  }
  obj[path[path.length - 1]] = val;
  sig.value = clone;
}

function MenuSection({ title, children }) {
  const ref = useRef(null);
  const toggle = useCallback(() => {
    const cl = ref.current.classList;
    cl.toggle("menu-minimized");
  }, []);

  return (
    <div class="menu-section" ref={ref}>
      <h1 onClick={toggle}>{title}</h1>
      {children}
    </div>
  );
}

function Slider({ label, signal: sig, path, magnitude, sensitivity, nDecimals, min, max, wrapAround: wrap, units, on }) {
  const opts = { magnitude, sensitivity, nDecimals, min, max, wrapAround: wrap };
  const controlRef = useRef(null);
  const inputRef = useRef(null);

  const rawValue = getSignalValue(sig, path);
  const displayValue = fromStateFormat(rawValue, opts);

  useEffect(() => {
    const el = controlRef.current;
    const input = inputRef.current;
    if (!el || !input) return;

    let dragging = false;

    const onPointerDown = (e) => {
      if (e.target.tagName.toLowerCase() === "input") return;
      dragging = true;
      state.isDragging.value = true;
    };

    const onPointerUp = () => {
      dragging = false;
      state.isDragging.value = false;
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      const delta = e.movementX * (sensitivity || 1);
      const current = parseFloat(input.value);
      const newVal = toStateFormat(current + delta, opts);
      setSignalValue(sig, path, newVal);
      input.value = fromStateFormat(newVal, opts);
      resizeInput(input);
    };

    const handleKeyDown = (e) => {
      if ("0123456789-Enter".includes(e.key)) input.select();
    };

    el.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointermove", onPointerMove);

    el.addEventListener("focus", () => document.addEventListener("keydown", handleKeyDown));
    el.addEventListener("blur", () => document.removeEventListener("keydown", handleKeyDown));

    if (on) {
      for (const [evt, fn] of Object.entries(on)) el.addEventListener(evt, fn);
    }

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const onChange = (e) => {
    const newVal = toStateFormat(e.target.value, opts);
    setSignalValue(sig, path, newVal);
    e.target.value = fromStateFormat(newVal, opts);
    resizeInput(e.target);
  };

  const onInput = (e) => resizeInput(e.target);
  const onClick = (e) => e.target.select();

  return (
    <div class="control slidable-control" ref={controlRef} tabIndex={0}>
      <label>{label}</label>
      <input
        ref={inputRef}
        size={String(displayValue).length || 1}
        value={displayValue}
        onChange={onChange}
        onInput={onInput}
        onClick={onClick}
      />
      <span class="control-units">{units}</span>
    </div>
  );
}

function Select({ signal: sig, path, options }) {
  const currentValue = getSignalValue(sig, path);
  const onChange = (e) => setSignalValue(sig, path, e.target.value);

  return (
    <div class="control-select">
      <select value={currentValue} onChange={onChange}>
        {options.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ signal: sig, path, label }) {
  const checked = getSignalValue(sig, path);
  const onChange = (e) => setSignalValue(sig, path, e.target.checked);

  return (
    <div class="control">
      <label>{label}</label>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span class="control-units" />
    </div>
  );
}

function ApodizationPlot() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const roll = state.tukeyRoll.value;
      const points = tukey(width, roll).map((w, i) => [
        (i / (width - 1)) * width,
        (2.2 - w) * 0.45 * height,
      ]);

      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
      ctx.fillRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(-10, height);
      ctx.lineTo(-10, points[0][1]);
      for (const [x, y] of points) ctx.lineTo(x, y);
      ctx.lineTo(width + 10, points[points.length - 1][1]);
      ctx.lineTo(width + 10, height);

      ctx.fillStyle = "rgba(255, 194, 213, 1)";
      ctx.fill();

      ctx.lineWidth = 10;
      ctx.strokeStyle = "white";
      ctx.stroke();

      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255, 25, 94, 1)";
      ctx.stroke();
    };

    const dispose = state.tukeyRoll.subscribe(draw);
    draw();
    return dispose;
  }, []);

  return (
    <div class="control-canvas">
      <canvas ref={canvasRef} width={400} height={100} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data-driven menu configuration
// ---------------------------------------------------------------------------

const mm = { magnitude: 1e-3, nDecimals: 1, sensitivity: 0.1, units: "mm" };
const dB = { sensitivity: 0.1, nDecimals: 1, units: "dB" };
const plotVisible = { visible: () => state.plotType.value !== "no-plot" };

const MENU_SECTIONS = [
  { title: "Array", controls: [
    { type: "slider", label: "No. of elements", signal: () => state.probe, path: ["nElements"], min: 1, max: 256 },
    { type: "slider", label: "X", signal: () => state.probe, path: ["center", 0], ...mm },
    { type: "slider", label: "Y", signal: () => state.probe, path: ["center", 1], ...mm },
    { type: "slider", label: "Width", signal: () => state.probe, path: ["arrayWidth"], ...mm, min: 0 },
    { type: "slider", label: "Normal azimuth", signal: () => state.probe, path: ["normalAzimuth"], nDecimals: 1, wrapAround: 180, units: "\u00B0" },
  ]},
  { title: "Transmitted wave", controls: [
    { type: "select", signal: () => state.delayModel, options: [["focused", "Focused wave"], ["plane", "Plane wave"], ["diverging", "Diverging wave"]] },
    { type: "slider", label: "Focus X", signal: () => state.virtualSource, path: [0], ...mm },
    { type: "slider", label: "Focus Y", signal: () => state.virtualSource, path: [1], ...mm },
    { type: "slider", label: "Center frequency", signal: () => state.centerFrequency, magnitude: 1e6, sensitivity: 0.01, nDecimals: 2, min: 0.01, units: "MHz" },
    { type: "slider", label: "Pulse length", signal: () => state.pulseLength, sensitivity: 0.1, nDecimals: 2, min: 0.1, units: "\u03BB" },
    { type: "slider", label: "Attenuation", signal: () => state.attenuationFactor, min: 0, sensitivity: 0.1, nDecimals: 2 },
    { type: "slider", label: "Sound speed", signal: () => state.soundSpeed, min: 1, units: "m/s" },
    { type: "slider", label: "Sound speed assumed during focusing", signal: () => state.soundSpeedTx, min: 1, units: "m/s" },
    { type: "custom", render: () => <div class="content"><h2>Transmit apodization</h2></div> },
    { type: "custom", render: () => <ApodizationPlot /> },
    { type: "slider", label: "Tukey roll", signal: () => state.tukeyRoll, sensitivity: 0.01, nDecimals: 2, min: 0, max: 1 },
  ]},
  { title: "Field display options", controls: [
    { type: "custom", render: () => {
      const opts = [["phase", "Display phase"], ["envelope", "Display envelope"], ["intensity", "Display intensity"]];
      if (state.maximumAmplitudeSimulation.value) opts.push(["time-delays", "Display time delays"]);
      return <Select signal={state.displayMode} options={opts} />;
    }},
    { type: "slider", label: "Minimum dB", signal: () => state.minimumDb, ...dB },
    { type: "slider", label: "Maximum dB", signal: () => state.maximumDb, ...dB },
    { type: "checkbox", signal: () => state.maximumAmplitudeSimulation, label: "Show maximum amplitude" },
    { type: "checkbox", signal: () => state.displayDb, label: "Display in dB" },
    { type: "checkbox", signal: () => state.showSimplifiedGeometry, label: "Show simplified geometry" },
    { type: "checkbox", signal: () => state.showGrid, label: "Show grid" },
  ]},
  { title: "Timeline display options", controls: [
    { type: "select", signal: () => state.sampleTimelineAt, options: [["probe", "Probe (render channel data)"], ["sample-point", "Sample point"]] },
    { type: "slider", label: "Timeline gain", signal: () => state.timelineGain, sensitivity: 0.1, nDecimals: 1, visible: () => state.sampleTimelineAt.value === "sample-point" },
    { type: "slider", label: "Timeline offset", signal: () => state.timelineOffset, magnitude: 1e-6, sensitivity: 0.1, nDecimals: 1, units: "\u03BCs" },
    { type: "slider", label: "Timeline length", signal: () => state.timelineLength, magnitude: 1e-6, sensitivity: 0.1, nDecimals: 1, min: 0, units: "\u03BCs" },
  ]},
  { title: "Plot", controls: [
    { type: "select", signal: () => state.plotType, options: [["no-plot", "Don't display plot"], ["lateral-beam-profile", "Lateral beam profile"], ["axial-beam-profile", "Axial beam profile"]] },
    { type: "slider", label: "Beam profile sample line width", signal: () => state.beamProfileSampleLineLength, ...mm, min: 0, ...plotVisible, on: {
      pointerdown: () => {}, pointermove: () => {},
      pointerup: () => { state.plotSampleLine.value = null; },
      pointerleave: () => { state.plotSampleLine.value = null; },
    }},
    { type: "checkbox", signal: () => state.plotUseMaximumAmplitude, label: "Sample maximum amplitude", ...plotVisible },
    { type: "slider", label: "Minimum dB", signal: () => state.plotMinimumDb, ...dB, ...plotVisible },
    { type: "slider", label: "Maximum dB", signal: () => state.plotMaximumDb, ...dB, ...plotVisible },
  ]},
  { title: "General", controls: [
    { type: "checkbox", signal: () => state.forceCurrentTimeAtFocus, label: "Force wavefront to be at focus point" },
    { type: "custom", render: () => (
      <div class="control">
        <label>Disable point scatterer</label>
        <input type="checkbox" checked={state.samplePointStrength.value === 0} onChange={(e) => { state.samplePointStrength.value = e.target.checked ? 0 : 1; }} />
        <span class="control-units" />
      </div>
    )},
    { type: "custom", render: () => <div class="control"><button onClick={() => state.resetState()}>Reset all state</button></div> },
    { type: "custom", render: () => (
      <>
        <hr />
        <div class="content">
          <h2>About</h2>
          <p>Developed at and funded by NTNU.{" "}<a href="https://github.com/magnusdk/delay-and-sum.com">Find the source code on GitHub.</a></p>
          <p>This work was presented as a poster at IUS 2024.{" "}<a href="https://delay-and-sum.com/poster_delay_and_sum_com.pdf">Click here to view the poster as a PDF.</a></p>
          <p>If you find any bugs or have suggestions for improvements,{" "}<a href="https://github.com/magnusdk/delay-and-sum.com/issues/new">please create an issue on GitHub.</a>{" "}Thank you! {"<3"}</p>
          <p>Otherwise, to get in touch:{" "}<a href="mailto:magnus.kvalevag@ntnu.no">magnus.kvalevag@ntnu.no</a></p>
        </div>
        <div style={{ height: "120px" }} />
      </>
    )},
  ]},
];

// ---------------------------------------------------------------------------
// Generic renderer
// ---------------------------------------------------------------------------

const COMPONENTS = { slider: Slider, select: Select, checkbox: Checkbox };

function renderControl(control, index) {
  if (control.visible && !control.visible()) return null;
  if (control.type === "custom") return <span key={index}>{control.render()}</span>;
  const { type, visible, signal: sigFn, ...props } = control;
  const Component = COMPONENTS[type];
  return Component ? <Component key={index} signal={sigFn()} {...props} /> : null;
}

export function Menu() {
  const isOpen = state.menuOpen.value;
  const dragging = state.isDragging.value;

  const containerClass = [
    "menu-container",
    isOpen && "is-open",
    dragging && "is-updating-parameter",
  ].filter(Boolean).join(" ");

  return (
    <div class={containerClass}>
      <div class="menu-gradient-overlay" />
      <button class="menu-button-mobile" onClick={() => state.menuOpen.value = true}>
        Open menu
      </button>
      <div class="menu">
        {isOpen && (
          <div class="control">
            <button onClick={() => state.menuOpen.value = false}>Close menu</button>
          </div>
        )}
        {MENU_SECTIONS.map((section, si) => (
          <MenuSection key={si} title={section.title}>
            {section.controls.map((control, ci) => renderControl(control, ci))}
          </MenuSection>
        ))}
      </div>
    </div>
  );
}
