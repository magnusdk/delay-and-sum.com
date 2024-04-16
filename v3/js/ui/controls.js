import { params } from "/v3/js/params.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { Colors } from "/v3/js/ui/colors.js";

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


export function select(id, value, label, options, callback) {
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
    selectEl.value = value;

    controlEl.appendChild(labelEl);
    controlEl.appendChild(selectEl);
    return controlEl;
}



export function slider(id, value, label, min, max, step, unitsLabel, scalingFactor, numDecimals, callback) {
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
    valueInputEl.value = (value / scalingFactor).toFixed(numDecimals);
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
    valueSliderEl.setAttribute("value", value / scalingFactor);
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

export function checkbox(id, value, label, callback) {
    const controlEl = document.createElement("div");
    controlEl.classList.add("control");

    const labelEl = document.createElement("label");
    labelEl.setAttribute("for", id);
    labelEl.innerText = label;

    const checkboxEl = document.createElement("input");
    checkboxEl.setAttribute("type", "checkbox");
    checkboxEl.setAttribute("id", id);
    checkboxEl.checked = value;
    checkboxEl.addEventListener("change", (e) => callback(e.target.checked));

    controlEl.appendChild(labelEl);
    controlEl.appendChild(checkboxEl);
    return controlEl;
}

export function controlsGroup(label, controls, isOpenByDefault = true) {
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


function updateApodizationVisualizer(ctx) {
    const apodizationValues = tukey(
        params.probeNumElements,
        params.tukeyApodizationRatio,
    );
    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height * 0.9);
    ctx.beginPath();
    ctx.moveTo(-10, ctx.canvas.height);
    ctx.lineTo(-10, ctx.canvas.height * 0.9);
    ctx.lineTo(0, ctx.canvas.height * 0.9);
    for (let i = 0; i < apodizationValues.length; i++) {
        ctx.lineTo(
            i / (apodizationValues.length - 1) * ctx.canvas.width,
            (2.2 - apodizationValues[i]) * ctx.canvas.height * 0.45,
        );
    }
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height * 0.9);
    ctx.lineTo(ctx.canvas.width + 10, ctx.canvas.height * 0.9);
    ctx.lineTo(ctx.canvas.width + 10, ctx.canvas.height);
    ctx.strokeStyle = Colors.apodizationOutline;
    ctx.fillStyle = Colors.apodizationFill;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
}



export function initControls(controlsDiv, app) {
    const apodizationVisualizerCanvas = document.createElement("canvas");
    apodizationVisualizerCanvas.width = 200;
    apodizationVisualizerCanvas.height = 20;
    const apodizationVisualizerCanvasCtx = apodizationVisualizerCanvas.getContext("2d");

    controlsDiv.appendChild(controlsGroup("Lateral beam profile", [
        slider(
            "lateralBeamProfileSampleWidth", params["lateralBeamProfileSampleWidth"], "Sample line width",
            0.001, 0.1, 0.0001, "", 1, 2,
            (value) => {
                app.updateParam("lateralBeamProfileSampleWidth", value);
                updateApodizationVisualizer(apodizationVisualizerCanvasCtx);
            },
        ),
        app.samplePointsCanvas.canvas,
    ]));

    controlsDiv.appendChild(select(
        "displayMode", params["displayMode"], "Wave display mode",
        [[-1, "Hide"], [0, "Phase"], [1, "Envelope"], [2, "Intensity"]],
        (value) => app.updateParam("displayMode", value),
    ));

    controlsDiv.appendChild(select(
        "transmittedWaveType", params["transmittedWaveType"], "Transmitted wave type",
        [[0, "Focused"], [1, "Plane"], [2, "Diverging"]],
        (value) => app.updateParam("transmittedWaveType", value),
    ));
    controlsDiv.appendChild(slider(
        "depthDispersionStrength", params["depthDispersionStrength"], "Depth dispersion strength",
        0.0, 1.0, 0.01, "", 1.0, 1,
        (value) => app.updateParam("depthDispersionStrength", value),
    ));
    controlsDiv.appendChild(slider(
        "centerFrequency", params["centerFrequency"], "Center frequency",
        0.1, 6, 0.01, "MHz", 1e6, 2,
        (value) => app.updateParam("centerFrequency", value),
    ));
    controlsDiv.appendChild(slider(
        "pulseLength", params["pulseLength"], "Pulse length",
        0.1, 100, 0.01, "wavelengths", 1, 2,
        (value) => app.updateParam("pulseLength", value),
    ));
    controlsDiv.appendChild(slider(
        "probeNumElements", params["probeNumElements"], "Number of transducer elements",
        1, 256, 1, "", 1, 0,
        (value) => {
            app.updateParam("probeNumElements", value);
            updateApodizationVisualizer(apodizationVisualizerCanvasCtx);
        }
    ));
    controlsDiv.appendChild(controlsGroup("Apodization", [
        slider(
            "tukeyApodizationRatio", params["tukeyApodizationRatio"], "Tukey ratio",
            0, 1, 0.01, "", 1, 2,
            (value) => {
                app.updateParam("tukeyApodizationRatio", value);
                updateApodizationVisualizer(apodizationVisualizerCanvasCtx);
            },
        ),
        apodizationVisualizerCanvas,
    ]));
    updateApodizationVisualizer(apodizationVisualizerCanvasCtx);

    controlsDiv.appendChild(slider(
        "soundSpeed", params["soundSpeed"], "Sound speed",
        100, 3000, 1, "m/s", 1, 0,
        (value) => app.updateParam("soundSpeed", value),
    ));
    controlsDiv.appendChild(slider(
        "soundSpeedAssumedTx", params["soundSpeedAssumedTx"], "Sound speed assumed on transmit",
        100, 3000, 1, "m/s", 1, 0,
        (value) => app.updateParam("soundSpeedAssumedTx", value),
    ));
    controlsDiv.appendChild(slider(
        "gain", params["gain"], "Gain",
        -60, 60, 0.01, "dB", 1, 2,
        (value) => app.updateParam("gain", value),
    ));
    controlsDiv.appendChild(slider(
        "timelineGain", params["timelineGain"], "Timeline gain",
        -60, 60, 0.01, "dB", 1, 2,
        (value) => app.updateParam("timelineGain", value),
    ));

    controlsDiv.appendChild(controlsGroup("Display parameters", [
        checkbox(
            "calculateMaximumIntensity", params["calculateMaximumIntensity"], "Calculate maximum intensity",
            (value) => app.updateParam("calculateMaximumIntensity", value),
        ),
        checkbox(
            "showGrid", params["showGrid"], "Show grid",
            (value) => {
                app.updateParam("showGrid", value);
                document.getElementById("showGridTickLabels").disabled = !value;
            },
        ),
        checkbox(
            "showGridTickLabels", params["showGridTickLabels"], "Show grid tick labels",
            (value) => app.updateParam("showGridTickLabels", value),
        ),
    ]));
}