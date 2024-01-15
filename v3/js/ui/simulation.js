import { params, updateParam } from "/v3/js/params.js";
import { Colors } from "/v3/js/ui/colors.js";
import { invertScaleTranslationTransform, transformVector } from "/v3/js/util.js";


function dist(x, z) {
    return Math.sqrt(x ** 2 + z ** 2);
}

function focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    const originToVirtualSourceDist = dist(virtualSourceX - waveOriginX, virtualSourceZ - waveOriginZ);
    const elToVirtualSourceDist = dist(virtualSourceX - elX, virtualSourceZ - elZ);
    return elToVirtualSourceDist - originToVirtualSourceDist
}

function planeWaveDistance(azimuth, waveOriginX, waveOriginZ, elX, elZ) {
    const [dX, dY] = [elX - waveOriginX, elZ - waveOriginZ]
    return (
        dX * Math.sin(azimuth + Math.PI / 2) +
        dY * Math.cos(azimuth + Math.PI / 2)
    )
}

function divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    // Reflect the virtual source across the wave origin
    const dx = waveOriginX - (virtualSourceX - waveOriginX)
    const dz = waveOriginZ - (virtualSourceZ - waveOriginZ)
    // Flip the sign of the distance to make it be behind the probe
    return -focusedWaveDistance(dx, dz, waveOriginX, waveOriginZ, elX, elZ)
}

function getPosition(cT0, cT1, cT2, cT3, cT4, cT5) {
    let {
        thread: { x, y },
        constants: { canvasHeight, ibT0, ibT1, ibT2, ibT3, ibT4, ibT5 }
    } = this;
    y = canvasHeight - y;  // Invert y-axis
    x = ibT0 * x + ibT2 * y + ibT4;
    y = ibT1 * x + ibT3 * y + ibT5;
    x = x * cT0 + y * cT2 + cT4;
    y = x * cT1 + y * cT3 + cT5;
    return [x, y];
}

function postProcesspixel(real, imag, gain, displayMode) {
    // Color selection. Correspond to pink for positive phase, blue for 
    // negative phase (following palette in /v3/js/ui/colors.js).
    const pinkR = 1;
    const pinkG = 0.09803921568627451;
    const pinkB = 0.3686274509803922;
    const blueR = 0;
    const blueG = 0.5215686274509804;
    const blueB = 1;

    const env = dist(real, imag);
    if (displayMode >= 1) {
        // Amplitude or intensity post-processing mode
        if (displayMode == 2) {
            // Intensity post-processing mode
            env = env ** 2;
        }
        // TODO: Use defined color palette
        this.color(0, 0, 0, env * 10 ** (gain / 20));
    } else if (displayMode == -1) {
        // Hide post-processing mode
        this.color(0, 0, 0, 0);
    } else {
        this.color(
            real > 0 ? pinkR : blueR,
            real > 0 ? pinkG : blueG,
            real > 0 ? pinkB : blueB,
            env * 10 ** (gain / 20),
        );
    }
}


function pulse(phase, pulseLength) {
    const gauss = Math.exp(-Math.pow(phase / pulseLength * 2, 2));
    const real = Math.sin(phase * Math.PI * 2) * gauss;
    const imag = Math.cos(phase * Math.PI * 2) * gauss;
    return [real, imag];
}


function pressureFieldAtPoint(
    x, z, t,
    elementsX, elementsZ, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    maxNumElements, maxNumVirtualSources,
) {
    let real = 0;
    let imag = 0;
    for (let i = 0; i < maxNumVirtualSources; i++) {
        if (i >= numVirtualSources) break;
        const virtualSourceX = virtualSourcesX[i];
        const virtualSourceZ = virtualSourcesZ[i];
        const virtualSourceAzimuth = virtualSourcesAzimuths[i];
        for (let j = 0; j < maxNumElements; j++) {
            if (j >= numElements) break;
            const elX = elementsX[j];
            const elZ = elementsZ[j];

            let t0 = 0;
            if (transmittedWaveType == 0) {
                t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 1) {
                t0 = planeWaveDistance(virtualSourceAzimuth, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 2) {
                t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            }

            const phase = (dist(x - elX, z - elZ) / soundSpeed - (t + t0)) * f;
            const [real1, imag1] = pulse(phase, pulseLength);
            real += real1; imag += imag1;
        }
    }
    // Normalize wrt number of elements. Multiplying by 50 is completely arbitrary.
    real = real / numElements * 50;
    imag = imag / numElements * 50;
    return [real, imag];
}


function mainSimulationkernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    t,
    elementsX, elementsZ, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5);
    const [real, imag] = pressureFieldAtPoint(
        x, z, t,
        elementsX, elementsZ, numElements,
        waveOriginX, waveOriginZ, transmittedWaveType,
        virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
        f, pulseLength, soundSpeed, soundSpeedAssumedTx,
        maxNumElements, maxNumVirtualSources,
    );
    postProcesspixel(real, imag, gain, displayMode);
    //this.color(z*10, 0, 0, 1);
}


function timelinekernel(
    minTime, maxTime,
    samplePointX, samplePointZ,
    elementsX, elementsZ, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain, displayMode,
) {
    const {
        thread: { x },
        constants: { canvasWidth, maxNumElements, maxNumVirtualSources }
    } = this;
    const t = x / canvasWidth * (maxTime - minTime) + minTime;
    const [real, imag] = pressureFieldAtPoint(
        samplePointX, samplePointZ, t,
        elementsX, elementsZ, numElements,
        waveOriginX, waveOriginZ, transmittedWaveType,
        virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
        f, pulseLength, soundSpeed, soundSpeedAssumedTx,
        maxNumElements, maxNumVirtualSources,
    );
    const env = dist(real, imag);
    if (displayMode >= 1) {
        // Amplitude or intensity post-processing mode
        if (displayMode == 2) {
            // Intensity post-processing mode
            return env ** 2 * 10 ** (gain / 20);
        } else {
            return env * 10 ** (gain / 20)
        }
    } else {
        return real * 10 ** (gain / 20)
    }
}

function maximumIntensityKernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    elementsX, elementsZ, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources, numTimeSteps, minTime, maxTime } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5);
    let maxEnv = 0.0;
    for (let i = 0; i < numTimeSteps; i++) {
        const t = i / numTimeSteps * maxTime + minTime;
        const [real, imag] = pressureFieldAtPoint(
            x, z, t,
            elementsX, elementsZ, numElements,
            waveOriginX, waveOriginZ, transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, numVirtualSources,
            f, pulseLength, soundSpeed, soundSpeedAssumedTx,
            maxNumElements, maxNumVirtualSources,
        );
        const env = dist(real, imag);
        maxEnv = Math.max(maxEnv, env);
    }
    maxEnv = maxEnv ** 2 / 100;
    this.color(0, 0, 0, maxEnv * 10 ** (gain / 20));
}


export class PrimarySimulationCanvas {
    constructor(DOMCanvasElement, width, height, grid) {
        this.DOMCanvasElement = DOMCanvasElement;
        this.DOMCanvasElementCtx = DOMCanvasElement.getContext("2d");
        this.canvas = document.createElement("canvas");
        this.canvas.id = "primarySimulationCanvas";
        this.canvas.width = width;
        this.canvas.height = height;
        this.grid = grid;
        this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.canvas, webGl: this.gl });
        this.simulationKernel = this.gpu.createKernel(mainSimulationkernel)
            .setOutput([this.gpu.canvas.width, this.gpu.canvas.height])
            .setGraphical(true)
            .setFunctions([invertScaleTranslationTransform, transformVector, getPosition, pressureFieldAtPoint, dist, pulse, focusedWaveDistance, planeWaveDistance, divergingWaveDistance, postProcesspixel])
            .setConstants({
                "ibT0": grid.inverseBaseTransform[0],
                "ibT1": grid.inverseBaseTransform[1],
                "ibT2": grid.inverseBaseTransform[2],
                "ibT3": grid.inverseBaseTransform[3],
                "ibT4": grid.inverseBaseTransform[4],
                "ibT5": grid.inverseBaseTransform[5],
                "canvasHeight": this.gpu.canvas.height,
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
            });
    }

    update(probe) {
        const [elementsX, elementsZ] = [probe.x, probe.z];
        const virtualSourcesX = [params.virtualSource[0]];
        const virtualSourcesZ = [params.virtualSource[1]];
        // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
        const virtualSourcesAzimuths = [
            Math.atan2(virtualSourcesX[0] - probe.center[0], virtualSourcesZ[0] - probe.center[1]) + Math.PI / 2
        ];

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
            virtualSourcesAzimuths.push(0);
        }
        this.simulationKernel(
            ...params.cameraTransform,
            params.time,
            elementsX, elementsZ, params.probeNumElements,
            waveOriginX, waveOriginZ, params.transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength,
            params.soundSpeed, params.soundSpeedAssumedTx,
            params.gain, params.displayMode,
        );
        // Clear DOMCanvasElementCtx
        this.DOMCanvasElementCtx.clearRect(0, 0, this.DOMCanvasElement.width, this.DOMCanvasElement.height);
        this.DOMCanvasElementCtx.drawImage(this.canvas, 0, 0);
    }
}


export class SecondarySimulationCanvas {
    constructor(width, height, grid) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "secondarySimulationCanvas";
        this.canvas.width = width;
        this.canvas.height = height;
        this.grid = grid;
        this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.canvas, webGl: this.gl });
        this.minTime = -params.pulseLength / params.centerFrequency * 10;
        this.maxTime = params.sectorDepthsMax / params.soundSpeed * 1.5;
        this.simulationKernel = this.gpu.createKernel(maximumIntensityKernel)
            .setOutput([this.gpu.canvas.width, this.gpu.canvas.height])
            .setGraphical(true)
            .setFunctions([invertScaleTranslationTransform, transformVector, getPosition, pressureFieldAtPoint, dist, pulse, focusedWaveDistance, planeWaveDistance, divergingWaveDistance, postProcesspixel])
            .setConstants({
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
                "numTimeSteps": 400,
                "minTime": this.minTime,
                "maxTime": this.maxTime,
            });
    }

    update(probe) {
        const [elementsX, elementsZ] = [probe.x, probe.z];
        const virtualSourcesX = [params.virtualSource[0]];
        const virtualSourcesZ = [params.virtualSource[1]];
        // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
        const virtualSourcesAzimuths = [
            Math.atan2(virtualSourcesX[0] - probe.center[0], virtualSourcesZ[0] - probe.center[1]) + Math.PI / 2
        ];

        const [waveOriginX, waveOriginZ] = probe.center;
        // Ensure correct size of arrays
        while (elementsX.length < this.simulationKernel.constants.maxNumElements) {
            elementsX.push(0);
            elementsZ.push(0);
        }
        while (virtualSourcesX.length < this.simulationKernel.constants.maxNumVirtualSources) {
            virtualSourcesX.push(0);
            virtualSourcesZ.push(0);
            virtualSourcesAzimuths.push(0);
        }
        this.simulationKernel(
            this.grid.xMin, this.grid.xMax, this.grid.zMin, this.grid.zMax,
            elementsX, elementsZ, params.probeNumElements,
            waveOriginX, waveOriginZ, params.transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength,
            params.soundSpeed, params.soundSpeedAssumedTx,
            params.gain, params.displayMode,
        );
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
}



export class TimelineCanvas {
    constructor(canvasElement, grid) {
        this.grid = grid;
        this.canvas = document.createElement("canvas");
        this.canvas.width = canvasElement.width;
        this.canvas.height = canvasElement.height;
        this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.canvas, webGl: this.gl });
        this.kernel = this.gpu.createKernel(timelinekernel)
            .setOutput([this.gpu.canvas.width])
            .setFunctions([invertScaleTranslationTransform, transformVector, pressureFieldAtPoint, dist, pulse, focusedWaveDistance, planeWaveDistance, divergingWaveDistance])
            .setConstants({
                "canvasWidth": this.gpu.canvas.width,
                "canvasHeight": this.gpu.canvas.height,
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
            });
    }

    draw(canvas, probe) {
        const [elementsX, elementsZ] = [probe.x, probe.z];
        const virtualSourcesX = [params.virtualSource[0]];
        const virtualSourcesZ = [params.virtualSource[1]];
        // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
        const virtualSourcesAzimuths = [
            Math.atan2(virtualSourcesX[0] - probe.center[0], virtualSourcesZ[0] - probe.center[1]) + Math.PI / 2
        ];
        const samplePointX = params.samplePoint[0];
        const samplePointZ = params.samplePoint[1];

        // Set the min and max time rendered on the timeline.
        // time=0 is when the center of the pulse passes through the center of the probe.
        this.minTime = -5e-3 / params.soundSpeed;
        this.maxTime = this.grid.pixelsPerMeter / this.grid.toCanvasSize(1) / params.soundSpeed;

        // center of probe
        const [waveOriginX, waveOriginZ] = probe.center;
        // Ensure correct size of arrays
        while (elementsX.length < this.kernel.constants.maxNumElements) {
            elementsX.push(0);
            elementsZ.push(0);
        }
        while (virtualSourcesX.length < this.kernel.constants.maxNumVirtualSources) {
            virtualSourcesX.push(0);
            virtualSourcesZ.push(0);
            virtualSourcesAzimuths.push(0);
        }
        const samples = this.kernel(
            this.minTime, this.maxTime,
            samplePointX, samplePointZ,
            elementsX, elementsZ, params.probeNumElements,
            waveOriginX, waveOriginZ, params.transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength,
            params.soundSpeed, params.soundSpeedAssumedTx,
            params.timelineGain, params.displayMode,
        );
        const ctx = canvas.getContext("2d");

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.beginPath();
        ctx.strokeStyle = Colors.timelineSamples;
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.moveTo(0, canvas.height / 2);
        for (let i = 0; i < samples.length; i++) {
            ctx.lineTo(i, canvas.height / 2 - samples[i] * 30);
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.restore();

        //Draw a line at the current time
        ctx.save();
        ctx.strokeStyle = Colors.timelineTimeMarker;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        const x = (params.time - this.minTime) / (this.maxTime - this.minTime) * canvas.width;
        ctx.moveTo(x, canvas.height / 8);
        ctx.lineTo(x, canvas.height / 8 * 7);
        ctx.stroke();
        ctx.restore();
    }

    dragTime(x) {
        if (this.dragging) {
            updateParam("time", x * (this.maxTime - this.minTime) + this.minTime);
        }
    }

    startDragging(x) {
        updateParam("time", x * (this.maxTime - this.minTime) + this.minTime);
        this.dragging = true;
    }
    stopDragging(x) {
        this.dragging = false;
    }
}