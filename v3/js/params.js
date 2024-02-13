import { debounce } from "/v3/js/util.js";

export const defaultParams = {
    // Display parameters
    cameraTransform: [0.04, 0, 0, 0.04, 0, -0.001],
    showGrid: true,
    showGridTickLabels: true,

    //// Sector scan background parameters
    sectorDepthsMin: 0,
    sectorDepthsMax: 0.02,
    // sectorAzimuth


    //// Beamforming and sampling parameters
    transmittedWaveType: 0,  // 0: focused, 1: plane, 2: diverging
    virtualSource: [0.002, 0.01],
    samplePoint: [-0.004, 0.012],

    probeType: "linear",
    probeNumElements: 64,
    probeLeft: [-0.003, 0],
    probeRight: [0.003, 0],
    probeRadiusOfCurvature: 0.1,
    tukeyApodizationRatio: 0,


    //// Simulation parameters
    time: 0,
    soundSpeed: 1540,
    soundSpeedAssumedTx: 1540,
    pulseLength: 1.5,
    centerFrequency: 3e6,
    displayMode: 0,  // -1: hide, 0: phase, 1: envelope, 2: intensity
    gain: 0,  // dB
    timelineGain: 0,  // dB
    calculateMaximumIntensity: false,
}

// Calculate params.sectorAzimuth such that the sector scan touches the sides of the grid.
const depthLength = defaultParams.sectorDepthsMax - defaultParams.sectorDepthsMin;
const radiusNorm = depthLength / (defaultParams.zMax - defaultParams.zMin);
defaultParams.sectorAzimuth = Math.asin(1 / (2 * radiusNorm)) * 2;


const overriddenParams = {};
export const params = new Proxy(defaultParams, {
    get: (target, name) => (name in overriddenParams) ? overriddenParams[name] : target[name],
    set: (target, name, value) => {
        overriddenParams[name] = value;
        return true;
    }
});


function _dumpParamsToURL() {
    let url = new URL(window.location.href);
    for (let key in overriddenParams) {
        let value = overriddenParams[key];
        if (typeof value === "number" && (value <= 1e-4 || value >= 1e4)) {
            value = value.toExponential(3);
        } else if (Array.isArray(value) && value.every(v => typeof v === "number")) {
            value = value.map(v => v.toExponential(3)).join(",");
        }
        url.searchParams.set(key, value);
    }
    window.history.replaceState({}, "", url.toString());
}
const dumpParamsToURL = debounce(_dumpParamsToURL, 100);
const updatedParams = new Set(Object.keys(params));
export function updateParam(name, value) {
    params[name] = value;
    dumpParamsToURL();
    updatedParams.add(name);
}

export function isUpdatedParam(...paramNames) {
    // Return true if any of the given params have been updated since the last frame.
    return paramNames.some(name => updatedParams.has(name));
}

export function clearUpdatedParams() {
    updatedParams.clear();
}


export function loadParamsFromURL() {
    // Write each param to overriddenParams
    let url = new URL(window.location.href);
    for (let key in params) {
        let value = url.searchParams.get(key);
        if (value === null) continue;
        if (typeof params[key] === "number") {
            value = parseFloat(value);
        } else if (typeof params[key] === "boolean") {
            value = (value == "true");
        } else if (Array.isArray(params[key]) && params[key].every(v => typeof v === "number")) {
            value = value.split(",").map(v => parseFloat(v));
        }
        updateParam(key, value);
    }
}

export function resetParams() {
    for (let key in overriddenParams) {
        delete overriddenParams[key];
    }
    // Clean up URL such that it doesn't contain any search params
    let url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
}