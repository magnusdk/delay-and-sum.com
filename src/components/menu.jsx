import { useRef, useEffect, useCallback } from "preact/hooks";
import * as state from "../state.js";

// ---- Value conversion helpers ----

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

// ---- Signal path helpers ----
// For signals holding objects (like probe), read/write nested paths.

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
  // Clone and set nested path
  const clone = Array.isArray(sig.value) ? [...sig.value] : { ...sig.value };
  let obj = clone;
  for (let i = 0; i < path.length - 1; i++) {
    obj[path[i]] = Array.isArray(obj[path[i]]) ? [...obj[path[i]]] : { ...obj[path[i]] };
    obj = obj[path[i]];
  }
  obj[path[path.length - 1]] = val;
  sig.value = clone;
}

// ---- Menu Section ----

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

// ---- Slider ----

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
      if ("0123456789-Enter".includes(e.key) || e.key === "Enter") {
        input.select();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointermove", onPointerMove);

    el.addEventListener("focus", () => document.addEventListener("keydown", handleKeyDown));
    el.addEventListener("blur", () => document.removeEventListener("keydown", handleKeyDown));

    // Custom event listeners from `on` prop
    if (on) {
      if (on.pointerdown) el.addEventListener("pointerdown", on.pointerdown);
      if (on.pointermove) el.addEventListener("pointermove", on.pointermove);
      if (on.pointerup) el.addEventListener("pointerup", on.pointerup);
      if (on.pointerleave) el.addEventListener("pointerleave", on.pointerleave);
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

// ---- Select ----

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

// ---- Checkbox ----

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

// ---- Apodization Plot ----

function tukey(n, r) {
  const w = [];
  for (let i = 1; i <= n; i++) {
    const x = i / (n + 1);
    if (x < r / 2) {
      w.push(0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - r / 2))));
    } else if (x < 1 - r / 2) {
      w.push(1);
    } else {
      w.push(0.5 * (1 + Math.cos((2 * Math.PI / r) * (x - (1 - r / 2)))));
    }
  }
  const mean = w.reduce((a, b) => a + b, 0) / n;
  return w.map(v => v / mean);
}

function ApodizationPlot() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");

    // Subscribe to tukeyRoll changes by reading signal in effect
    const draw = () => {
      const roll = state.tukeyRoll.value;
      const points = tukey(width, roll).map((w, i) => [
        (i / (width - 1)) * width,
        (2.2 - w) * 0.45 * height,
      ]);

      ctx.clearRect(0, 0, width, height);

      // Background fill
      ctx.fillStyle = "rgba(0, 240, 255, 0.25)";
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.fill();

      // Apodization shape
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

    // Use signal effect to reactively redraw
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

// ---- Menu Container ----

export function Menu() {
  const isOpen = state.menuOpen.value;
  const dragging = state.isDragging.value;
  const displayModeValue = state.displayMode.value;
  const maxAmpSim = state.maximumAmplitudeSimulation.value;
  const sampleAt = state.sampleTimelineAt.value;
  const plotTypeValue = state.plotType.value;

  const containerClass = [
    "menu-container",
    isOpen && "is-open",
    dragging && "is-updating-parameter",
  ].filter(Boolean).join(" ");

  const displayModeOptions = [
    ["phase", "Display phase"],
    ["envelope", "Display envelope"],
    ["intensity", "Display intensity"],
  ];
  if (maxAmpSim) {
    displayModeOptions.push(["time-delays", "Display time delays"]);
  }

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

        {/* Array */}
        <MenuSection title="Array">
          <Slider label="No. of elements" signal={state.probe} path={["nElements"]} min={1} max={256} />
          <Slider label="X" signal={state.probe} path={["center", 0]} magnitude={1e-3} nDecimals={1} sensitivity={0.1} units="mm" />
          <Slider label="Y" signal={state.probe} path={["center", 1]} magnitude={1e-3} nDecimals={1} sensitivity={0.1} units="mm" />
          <Slider label="Width" signal={state.probe} path={["arrayWidth"]} magnitude={1e-3} nDecimals={1} sensitivity={0.1} min={0} units="mm" />
          <Slider label="Normal azimuth" signal={state.probe} path={["normalAzimuth"]} nDecimals={1} wrapAround={180} units={"\u00B0"} />
        </MenuSection>

        {/* Transmitted wave */}
        <MenuSection title="Transmitted wave">
          <Select signal={state.delayModel} options={[
            ["focused", "Focused wave"],
            ["plane", "Plane wave"],
            ["diverging", "Diverging wave"],
          ]} />
          <Slider label="Focus X" signal={state.virtualSource} path={[0]} magnitude={1e-3} nDecimals={1} sensitivity={0.1} units="mm" />
          <Slider label="Focus Y" signal={state.virtualSource} path={[1]} magnitude={1e-3} nDecimals={1} sensitivity={0.1} units="mm" />
          <Slider label="Center frequency" signal={state.centerFrequency} magnitude={1e6} sensitivity={0.01} nDecimals={2} min={0.01} units="MHz" />
          <Slider label="Pulse length" signal={state.pulseLength} sensitivity={0.1} nDecimals={2} min={0.1} units={"\u03BB"} />
          <Slider label="Attenuation" signal={state.attenuationFactor} min={0} sensitivity={0.1} nDecimals={2} />
          <Slider label="Sound speed" signal={state.soundSpeed} min={1} units="m/s" />
          <Slider label="Sound speed assumed during focusing" signal={state.soundSpeedTx} min={1} units="m/s" />
          <div class="content"><h2>Transmit apodization</h2></div>
          <ApodizationPlot />
          <Slider label="Tukey roll" signal={state.tukeyRoll} sensitivity={0.01} nDecimals={2} min={0} max={1} />
        </MenuSection>

        {/* Field display options */}
        <MenuSection title="Field display options">
          <Select signal={state.displayMode} options={displayModeOptions} />
          <Slider label="Minimum dB" signal={state.minimumDb} sensitivity={0.1} nDecimals={1} units="dB" />
          <Slider label="Maximum dB" signal={state.maximumDb} sensitivity={0.1} nDecimals={1} units="dB" />
          <Checkbox signal={state.maximumAmplitudeSimulation} label="Show maximum amplitude" />
          <Checkbox signal={state.displayDb} label="Display in dB" />
          <Checkbox signal={state.showSimplifiedGeometry} label="Show simplified geometry" />
          <Checkbox signal={state.showGrid} label="Show grid" />
        </MenuSection>

        {/* Timeline display options */}
        <MenuSection title="Timeline display options">
          <Select signal={state.sampleTimelineAt} options={[
            ["probe", "Probe (render channel data)"],
            ["sample-point", "Sample point"],
          ]} />
          {sampleAt === "sample-point" && (
            <Slider label="Timeline gain" signal={state.timelineGain} sensitivity={0.1} nDecimals={1} />
          )}
          <Slider label="Timeline offset" signal={state.timelineOffset} magnitude={1e-6} sensitivity={0.1} nDecimals={1} units={"\u03BCs"} />
          <Slider label="Timeline length" signal={state.timelineLength} magnitude={1e-6} sensitivity={0.1} nDecimals={1} min={0} units={"\u03BCs"} />
        </MenuSection>

        {/* Plot */}
        <MenuSection title="Plot">
          <Select signal={state.plotType} options={[
            ["no-plot", "Don't display plot"],
            ["lateral-beam-profile", "Lateral beam profile"],
            ["axial-beam-profile", "Axial beam profile"],
          ]} />
          {plotTypeValue !== "no-plot" && (
            <>
              <Slider
                label="Beam profile sample line width" signal={state.beamProfileSampleLineLength}
                min={0} magnitude={1e-3} nDecimals={1} sensitivity={0.1} units="mm"
                on={{
                  pointerdown: () => { /* TODO: beam profile start/end pos */ },
                  pointermove: () => { /* TODO: beam profile start/end pos */ },
                  pointerup: () => { state.plotLeftMostPos.value = null; state.plotRightMostPos.value = null; },
                  pointerleave: () => { state.plotLeftMostPos.value = null; state.plotRightMostPos.value = null; },
                }}
              />
              <Checkbox signal={state.plotUseMaximumAmplitude} label="Sample maximum amplitude" />
              <Slider label="Minimum dB" signal={state.plotMinimumDb} sensitivity={0.1} nDecimals={1} units="dB" />
              <Slider label="Maximum dB" signal={state.plotMaximumDb} sensitivity={0.1} nDecimals={1} units="dB" />
            </>
          )}
        </MenuSection>

        {/* General */}
        <MenuSection title="General">
          <Checkbox signal={state.forceCurrentTimeAtFocus} label="Force wavefront to be at focus point" />
          <div class="control">
            <label>Disable point scatterer</label>
            <input
              type="checkbox"
              checked={state.samplePointStrength.value === 0}
              onChange={(e) => { state.samplePointStrength.value = e.target.checked ? 0 : 1; }}
            />
            <span class="control-units" />
          </div>
          <div class="control">
            <button onClick={() => state.resetState()}>Reset all state</button>
          </div>
          <hr />
          <div class="content">
            <h2>About</h2>
            <p>
              Developed at and funded by NTNU.{" "}
              <a href="https://github.com/magnusdk/delay-and-sum.com">Find the source code on GitHub.</a>
            </p>
            <p>
              This work was presented as a poster at IUS 2024.{" "}
              <a href="https://delay-and-sum.com/poster_delay_and_sum_com.pdf">Click here to view the poster as a PDF.</a>
            </p>
            <p>
              If you find any bugs or have suggestions for improvements,{" "}
              <a href="https://github.com/magnusdk/delay-and-sum.com/issues/new">please create an issue on GitHub.</a>
              {" "}Thank you! {"<3"}
            </p>
            <p>
              Otherwise, to get in touch:{" "}
              <a href="mailto:magnus.kvalevag@ntnu.no">magnus.kvalevag@ntnu.no</a>
            </p>
          </div>
          <div style={{ height: "120px" }} />
        </MenuSection>
      </div>
    </div>
  );
}
