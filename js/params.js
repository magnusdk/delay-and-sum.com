import { debounce } from "/js/util.js";

export const defaultParams = {

    //// Main grid coordinates
    xMin: -0.0105,
    xMax: 0.0105,
    zMin: -0.001,
    zMax: 0.02,
    // width
    // height
    closestDraggableDistance: 0.001,


    //// Sector scan background parameters
    sectorDepthsMin: 0,
    sectorDepthsMax: 0.02,
    // sectorAzimuth


    //// Beamforming and sampling parameters
    transmittedWaveType: 0,  // 0: focused, 1: plane, 2: diverging
    virtualSource: [0.002, 0.01],
    samplePoint: [0.002, 0.015],

    probeType: "linear",
    probeNumElements: 64,
    probeLeft: [-0.003, 0],
    probeRight: [0.003, 0],


    //// Simulation parameters
    time: 0,
    soundSpeed: 1540,
    soundSpeedAssumedTx: 1540,
    pulseLength: 1,
    centerFrequency: 3e6,
    gain: 0,  // dB
    displayMode: 0,  // -1: hide, 0: phase, 1: envelope, 2: intensity
}

defaultParams.width = Math.abs(defaultParams.xMax - defaultParams.xMin);
defaultParams.height = Math.abs(defaultParams.zMax - defaultParams.zMin);

// Calculate params.sectorAzimuth such that the sector scan touches the sides of the grid.
const depthLength = defaultParams.sectorDepthsMax - defaultParams.sectorDepthsMin;
const radiusNorm = depthLength / defaultParams.height;
defaultParams.sectorAzimuth = Math.asin(1 / (2 * radiusNorm)) * 2;


const overriddenParams = {};
export const params = new Proxy(defaultParams, {
    get: (target, name) => (name in overriddenParams) ? overriddenParams[name] : target[name],
    set: (target, name, value) => {
        overriddenParams[name] = value;
        return true;
    }
});


export function loadParamsFromURL() {
    // Write each param to overriddenParams
    let url = new URL(window.location.href);
    for (let key in params) {
        let value = url.searchParams.get(key);
        if (value === null) continue;
        if (typeof params[key] === "number") {
            value = parseFloat(value);
        }else if (typeof params[key] === "boolean") {
            value = (value == "true");
        } else if (Array.isArray(params[key]) && params[key].every(v => typeof v === "number")) {
            value = value.split(",").map(v => parseFloat(v));
        }
        overriddenParams[key] = value;
    }
}

function _dumpParamsToURL() {
    let url = new URL(window.location.href);
    for (let key in overriddenParams) {
        let value = overriddenParams[key];
        if (typeof value === "number" && value >= 1e4) {
            value = value.toExponential(3);
        } else if (Array.isArray(value) && value.every(v => typeof v === "number")) {
            value = value.map(v => v.toExponential(3)).join(",");
        }
        url.searchParams.set(key, value);
    }
    window.history.replaceState({}, "", url.toString());
}
export const dumpParamsToURL = debounce(_dumpParamsToURL, 100)

export function updateParam(name, value) {
    params[name] = value;
    dumpParamsToURL();
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