import { params } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { allFunctions } from "/v3/js/simulation/common.js";
import { pressureFieldAtPoints } from "/v3/js/simulation/pressureField.js";
import { Colors } from "/v3/js/ui/colors.js";
import { getLateralBeamProfilePoints } from "/v3/js/util.js";

export class SamplePointsCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");
        this.simulationCanvas = document.createElement("canvas");
        this.simulationCanvas.width = width;
        this.gpu = new GPUX({ canvas: this.simulationCanvas });
        this.kernel = this.gpu.createKernel(pressureFieldAtPoints)
            .setOutput([this.width])
            .setFunctions(allFunctions)
            .setConstants({
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
            });
    }

    update() {
        const [xs, zs] = getLateralBeamProfilePoints(this.width);
        if (xs.length !== this.width || zs.length !== this.width) {
            throw new Error(`xs and zs must have length equal to ${this.width}`);
        }

        const depthDispersionStrength = params.depthDispersionStrength;
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
        while (elementsX.length < this.kernel.constants.maxNumElements) {
            elementsX.push(0);
            elementsZ.push(0);
            elementWeights.push(0);
        }
        while (virtualSourcesX.length < this.kernel.constants.maxNumVirtualSources) {
            virtualSourcesX.push(0);
            virtualSourcesZ.push(0);
            virtualSourcesAzimuths.push(0);
        }

        this.samples = this.kernel(
            xs, zs, params.time,
            elementsX, elementsZ, elementWeights, probe.numElements,
            waveOriginX, waveOriginZ, params.transmittedWaveType,
            virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength,
            params.soundSpeed, params.soundSpeedAssumedTx, depthDispersionStrength,
            params.gain, params.displayMode,
        );
        let max = Math.max(...this.samples);
        let min = Math.min(...this.samples);
        // Try to normalize the samples such that the height is always 1, except for 
        // when max is really small. The following works like a smoothed version of 
        // Math.max(0.001, max):
        max = Math.sqrt(0.001 + max * max);

        // Render the samples as lines
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = Colors.pink;
        this.ctx.beginPath();
        for (let i = 0; i < this.width; i++) {
            // normalize with max and min
            const y = (this.samples[i] - min) / (max - min);
            this.ctx.lineTo(i, this.height * 0.9 - y * this.height * 0.8);
        }
        this.ctx.stroke();
    }
}