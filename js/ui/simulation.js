import { params } from "/js/params.js";


function dist(x, z) {
    return Math.sqrt(x ** 2 + z ** 2);
}

function focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    const originToVirtualSourceDist = dist(virtualSourceX - waveOriginX, virtualSourceZ - waveOriginZ);
    const elToVirtualSourceDist = dist(virtualSourceX - elX, virtualSourceZ - elZ);
    return elToVirtualSourceDist - originToVirtualSourceDist
}

function planeWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    const virtualSourceDist = dist(virtualSourceX - waveOriginX, virtualSourceZ - waveOriginZ);
    // Place the virtual source really far away. The grid is assumed to be small, so 10 meters should be enough!
    const dx = (virtualSourceX - waveOriginX) / virtualSourceDist * 1
    const dz = (virtualSourceZ - waveOriginZ) / virtualSourceDist * 1
    return focusedWaveDistance(dx, dz, waveOriginX, waveOriginZ, elX, elZ)
}

function divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    // Reflect the virtual source across the wave origin
    const dx = waveOriginX - (virtualSourceX - waveOriginX)
    const dz = waveOriginZ - (virtualSourceZ - waveOriginZ)
    // Flip the sign of the distance to make it be behind the probe
    return -focusedWaveDistance(dx, dz, waveOriginX, waveOriginZ, elX, elZ)
}

function getPosition() {
    let {
        thread: { x, y },
        constants: {
            canvasWidth, canvasHeight,
            gridWidth, gridHeight,
            gridXMin, gridXMax, gridZMin, gridZMax,
        }
    } = this;
    x = x / canvasWidth * gridWidth + gridXMin;
    let z = (1 - y / canvasHeight) * gridHeight + gridZMin;
    return [x, z];
}

function postProcesspixel(real, imag, gain, displayMode) {
    // Color selection. Correspond to pink for positive phase, blue for 
    // negative phase (following palette in /js/ui/colors.js).
    const pinkR = 1;
    const pinkG = 0.09803921568627451;
    const pinkB = 0.3686274509803922;
    const blueR = 0;
    const blueG = 0.5215686274509804;
    const blueB = 1;

    if (displayMode >= 1) {
        // Amplitude or intensity post-processing mode
        let env = dist(real, imag) / Math.sqrt(2);
        if (displayMode == 2) {
            // Intensity post-processing mode
            env = env ** 2;
        }
        // TODO: Use defined color palette
        this.color(0, 0, 0, env * 10 ** (gain / 20));
    } else if (displayMode == -1) {
        // Hide post-processing mode
        this.color(0, 0, 0, 0);
    }
    else {
        let env = dist(real, imag) / Math.sqrt(2);
        this.color(
            real > 0 ? pinkR : blueR,
            real > 0 ? pinkG : blueG,
            real > 0 ? pinkB : blueB,
            Math.abs(real) * 10 ** (gain / 20),
        );
    }
}


function pulse(phase, pulseLength) {
    const gauss = Math.exp(-Math.pow(phase / pulseLength * 2, 2));
    const real = Math.sin(phase * Math.PI * 2) * gauss;
    const imag = Math.cos(phase * Math.PI * 2) * gauss;
    return [real, imag];
}


function mainSimulationkernel(
    t,
    elementsX, elementsZ, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources } } = this;
    const [x, z] = getPosition();
    let real = 0;
    let imag = 0;
    for (let i = 0; i < maxNumVirtualSources; i++) {
        if (i >= numVirtualSources) break;
        let virtualSourceX = virtualSourcesX[i];
        let virtualSourceZ = virtualSourcesZ[i];
        for (let j = 0; j < maxNumElements; j++) {
            if (j >= numElements) break;
            const elX = elementsX[j];
            const elZ = elementsZ[j];

            let t0 = 0;
            if (transmittedWaveType == 0) {
                t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 1) {
                t0 = planeWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 2) {
                t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            }

            const phase = (dist(x - elX, z - elZ) / soundSpeed - (t + t0)) * f;
            const [real1, imag1] = pulse(phase, pulseLength);
            real += real1; imag += imag1;
        }
    }
    //real /= numElements; imag /= numElements;
    postProcesspixel(real, imag, gain, displayMode);
}


export class MainSimulationCanvas {
    constructor(width, height) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.canvas, webGl: this.gl });
        this.simulationKernel = this.gpu.createKernel(mainSimulationkernel)
            .setOutput([this.gpu.canvas.width, this.gpu.canvas.height])
            .setGraphical(true)
            .setFunctions([getPosition, dist, pulse, focusedWaveDistance, planeWaveDistance, divergingWaveDistance, postProcesspixel])
            .setConstants({
                "canvasWidth": this.gpu.canvas.width,
                "canvasHeight": this.gpu.canvas.height,
                "gridWidth": params.width,
                "gridHeight": params.height,
                "gridXMin": params.xMin,
                "gridXMax": params.xMax,
                "gridZMin": params.zMin,
                "gridZMax": params.zMax,
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
            })
    }

    draw(canvas, probe) {
        const [elementsX, elementsZ] = [probe.x, probe.z];
        const virtualSourcesX = [params.virtualSource[0]];
        const virtualSourcesZ = [params.virtualSource[1]];

        // center of probe
        const [waveOriginX, waveOriginZ] = probe.center;
        // Ensure correct size of arrays
        while (elementsX.length < this.simulationKernel.constants.maxNumElements) {
            elementsX.push(0);
            elementsZ.push(0);
        }
        while (virtualSourcesX.length < this.simulationKernel.constants.maxNumVirtualSources) {
            virtualSourcesX.push(0);
            virtualSourcesZ.push(0);
        }
        this.simulationKernel(
            params.time,
            elementsX, elementsZ, params.probeNumElements,
            waveOriginX, waveOriginZ, params.transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength,
            params.soundSpeed, params.soundSpeedAssumedTx,
            params.gain, params.displayMode,
        );
        const ctx = canvas.getContext("2d");

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(this.canvas, 0, 0);
        ctx.restore();
    }
}
