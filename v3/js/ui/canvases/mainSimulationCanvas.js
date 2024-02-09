import { invertScaleTranslationTransform, transformVector } from "/v3/js/linalg.js";
import { isUpdatedParam, params } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { dist, divergingWaveDistance, focusedWaveDistance, getPosition, planeWaveDistance, postProcesspixel, pressureFieldAtPoint, pulse } from "/v3/js/simulation/common.js";
import { mainSimulationkernel } from "/v3/js/simulation/pressureField.js";

export class MainSimulationCanvas {
    constructor(DOMCanvasElement, width, height, grid) {
        this.DOMCanvasElement = DOMCanvasElement;
        this.DOMCanvasElementCtx = DOMCanvasElement.getContext("2d");
        this.canvas = document.createElement("canvas");
        this.canvas.id = "mainSimulationCanvas";
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

    update() {
        if (isUpdatedParam(
            "tukeyApodizationRatio",
            "virtualSource",
            "cameraTransform",
            "time",
            "transmittedWaveType",
            "centerFrequency",
            "pulseLength",
            "soundSpeed",
            "soundSpeedAssumedTx",
            "gain",
            "displayMode",
            "probeType",
            "probeNumElements",
            "probeLeft",
            "probeRight",
        )) {
            const probe = ProbeInfo.fromParams(params);
            const [elementsX, elementsZ] = [Array.from(probe.x), Array.from(probe.z)];
            const elementWeights = tukey(probe.numElements, params.tukeyApodizationRatio);
            const virtualSourcesX = [params.virtualSource[0]];
            const virtualSourcesZ = [params.virtualSource[1]];
            // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
            const virtualSourcesAzimuths = [
                Math.atan2(
                    virtualSourcesX[0] - probe.center[0],
                    virtualSourcesZ[0] - probe.center[1]
                ) + Math.PI / 2,
            ];

            const [waveOriginX, waveOriginZ] = probe.center;
            // Ensure correct size of arrays
            while (elementsX.length < this.simulationKernel.constants.maxNumElements) {
                elementsX.push(0);
                elementsZ.push(0);
                elementWeights.push(0);
            }
            while (virtualSourcesX.length < this.simulationKernel.constants.maxNumVirtualSources) {
                virtualSourcesX.push(0);
                virtualSourcesZ.push(0);
                virtualSourcesAzimuths.push(0);
            }
            this.simulationKernel(
                ...params.cameraTransform,
                params.time,
                elementsX, elementsZ, elementWeights, probe.numElements,
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
}