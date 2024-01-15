import { params } from "/v3/js/params.js";


function rescaleInputWidth(inputEl, numDecimals) {
    const asFloat = parseFloat(inputEl.value);
    const isNegative = asFloat < 0;
    const numDigits = Math.max(Math.floor(Math.log10(Math.abs(asFloat))), 0) + 1 + isNegative;
    const width = Math.max(
        inputEl.value.length,
        numDigits + numDecimals + (numDecimals !== 0)  // Account for the period character
    );
    inputEl.style.width = `${width}ch`;
}


export function select(id, label, options, callback) {
    const controlEl = document.createElement("div");
    controlEl.classList.add("control");

    const labelEl = document.createElement("label");
    labelEl.setAttribute("for", id);
    labelEl.innerText = label;

    const selectEl = document.createElement("select");
    selectEl.setAttribute("id", id);
    selectEl.addEventListener("change", (e) => callback(e.target.value));
    for (const [value, text] of options) {
        const option = document.createElement("option");
        option.setAttribute("value", value);
        option.innerText = text;
        selectEl.appendChild(option);
    }
    selectEl.value = params[id];

    controlEl.appendChild(labelEl);
    controlEl.appendChild(selectEl);
    return controlEl;
}



export function slider(id, label, min, max, step, unitsLabel, scalingFactor, numDecimals, callback) {
    const controlEl = document.createElement("div");
    controlEl.classList.add("control");

    const labelEl = document.createElement("label");
    labelEl.setAttribute("for", id);
    labelEl.innerText = label;

    const valueInputEl = document.createElement("input");
    valueInputEl.classList.add("slider-input");
    // Type is "text" because "number" inputs are tricky to work with
    valueInputEl.setAttribute("type", "text");
    valueInputEl.setAttribute("id", id);
    valueInputEl.value = (params[id] / scalingFactor).toFixed(numDecimals);
    valueInputEl.addEventListener("input",
        (e) => callback(parseFloat(e.target.value) * scalingFactor));
    valueInputEl.addEventListener("input",
        (e) => valueSliderEl.value = e.target.value);
    rescaleInputWidth(valueInputEl, numDecimals);

    const unitsEl = document.createElement("span");
    unitsEl.classList.add("units");
    unitsEl.innerText = unitsLabel;

    const sliderWrapperEl = document.createElement("div");
    sliderWrapperEl.classList.add("slider-wrapper");

    const minEl = document.createElement("span");
    minEl.classList.add("min-value");
    minEl.innerText = min;

    const maxEl = document.createElement("span");
    maxEl.classList.add("max-value");
    maxEl.innerText = max;

    const valueSliderEl = document.createElement("input");
    valueSliderEl.setAttribute("id", id);
    valueSliderEl.setAttribute("type", "range");
    valueSliderEl.setAttribute("min", min);
    valueSliderEl.setAttribute("max", max);
    valueSliderEl.setAttribute("step", step);
    valueSliderEl.setAttribute("value", params[id] / scalingFactor);
    valueSliderEl.addEventListener("input", (e) => {
        callback(parseFloat(e.target.value) * scalingFactor);
    });
    valueSliderEl.addEventListener("input", (e) => {
        valueInputEl.value = e.target.value;
        rescaleInputWidth(valueInputEl, numDecimals);
    });

    controlEl.appendChild(labelEl);
    controlEl.appendChild(valueInputEl);
    controlEl.appendChild(unitsEl);
    controlEl.appendChild(sliderWrapperEl);
    sliderWrapperEl.appendChild(minEl);
    sliderWrapperEl.appendChild(valueSliderEl);
    sliderWrapperEl.appendChild(maxEl);
    return controlEl;
}

export function checkbox(id, label, callback) {
    const controlEl = document.createElement("div");
    controlEl.classList.add("control");

    const labelEl = document.createElement("label");
    labelEl.setAttribute("for", id);
    labelEl.innerText = label;

    const checkboxEl = document.createElement("input");
    checkboxEl.setAttribute("type", "checkbox");
    checkboxEl.setAttribute("id", id);
    checkboxEl.checked = params[id];
    checkboxEl.addEventListener("change", (e) => callback(e.target.checked));

    controlEl.appendChild(labelEl);
    controlEl.appendChild(checkboxEl);
    return controlEl;
}

export function controlsGroup(label, controls, isOpenByDefault=true) {
    const detailsEl = document.createElement("details");
    if (isOpenByDefault) detailsEl.setAttribute("open", "");
    const summaryEl = document.createElement("summary");
    summaryEl.innerText = label;
    detailsEl.appendChild(summaryEl);
    const detailsControlsDiv = document.createElement("div");
    detailsControlsDiv.classList.add("detailsControlsContainer");
    detailsEl.appendChild(detailsControlsDiv);
    for (const control of controls) {
        detailsControlsDiv.appendChild(control);
    }
    return detailsEl;
}



export function initControls(controlsDiv, app) {
    controlsDiv.appendChild(select(
        "displayMode", "Wave display mode",
        [[-1, "Hide"], [0, "Phase"], [1, "Envelope"], [2, "Intensity"]],
        (value) => app.updateParam("displayMode", value),
    ));
    // TODO: Fix maximumIntensity calculation and uncomment this
    //controlsDiv.appendChild(checkbox(
    //    "calculateMaximumIntensity", "Maximum intensity",
    //    (value) => app.updateParam("calculateMaximumIntensity", value),
    //));
    controlsDiv.appendChild(controlsGroup("Beamforming parameters", [
        select(
            "transmittedWaveType", "Transmitted wave type",
            [[0, "Focused"], [1, "Plane"], [2, "Diverging"]],
            (value) => app.updateParam("transmittedWaveType", value),
        ),
        slider(
            "centerFrequency", "Center frequency",
            0.1, 6, 0.01, "MHz", 1e6, 2,
            (value) => app.updateParam("centerFrequency", value),
        ),
        slider(
            "pulseLength", "Pulse length",
            0.1, 100, 0.01, "wavelengths", 1, 2,
            (value) => app.updateParam("pulseLength", value),
        ),
        slider(
            "probeNumElements", "Number of transducer elements",
            1, 256, 1, "", 1, 0,
            (value) => app.updateParam("probeNumElements", value),
        ),
    ]));
    //controlsDiv.appendChild(slider(
    //    "probeRadiusOfCurvature", "Radius of curvature",
    //    -0.05, 0.05, 0.001, "m", 1, 3,
    //    (value) => app.updateParam("probeRadiusOfCurvature", value),
    //));
    controlsDiv.appendChild(slider(
        "soundSpeed", "Sound speed",
        100, 3000, 1, "m/s", 1, 0,
        (value) => app.updateParam("soundSpeed", value),
    ));
    controlsDiv.appendChild(slider(
        "soundSpeedAssumedTx", "Sound speed assumed on transmit",
        100, 3000, 1, "m/s", 1, 0,
        (value) => app.updateParam("soundSpeedAssumedTx", value),
    ));
    controlsDiv.appendChild(slider(
        "gain", "Gain",
        -60, 60, 0.01, "dB", 1, 2,
        (value) => app.updateParam("gain", value),
    ));
    controlsDiv.appendChild(slider(
        "timelineGain", "Timeline gain",
        -60, 60, 0.01, "dB", 1, 2,
        (value) => app.updateParam("timelineGain", value),
    ));
}