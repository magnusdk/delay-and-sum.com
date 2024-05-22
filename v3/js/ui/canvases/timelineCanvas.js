import { isUpdatedParam, params, updateParam } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { allFunctions } from "/v3/js/simulation/common.js";
import { timelinekernel } from "/v3/js/simulation/timeline.js";
import { Colors } from "/v3/js/ui/colors.js";
import { getMaxTime, getMinTime } from "/v3/js/util.js";

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
            .setFunctions(allFunctions)
            .setConstants({
                "canvasWidth": this.gpu.canvas.width,
                "canvasHeight": this.gpu.canvas.height,
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
            });
    }

    update(canvas) {
        if (isUpdatedParam(
            "cameraTransform",
            "probeType",
            "probeNumElements",
            "probeLeft",
            "probeRight",
            "tukeyApodizationRatio",
            "virtualSource",
            "samplePoint",
            "soundSpeed",
            "soundSpeed",
            "probeNumElements",
            "elementDirectivityModel",
            "transmittedWaveType",
            "centerFrequency",
            "pulseLength",
            "soundSpeed",
            "soundSpeedAssumedTx",
            "depthDispersionStrength",
            "timelineGain",
            "displayMode",
            "time",
        )) {
            const depthDispersionStrength = params.depthDispersionStrength;
            const probe = ProbeInfo.fromParams(params);
            const [elementsX, elementsZ] = [Array.from(probe.x), Array.from(probe.z)];
            const elementWeights = tukey(probe.numElements, params.tukeyApodizationRatio);
            const elementNormalAzimuths = probe.elementNormalAzimuths;
            const elementWidths = probe.elementWidths;
            const virtualSourcesX = [params.virtualSource[0]];
            const virtualSourcesZ = [params.virtualSource[1]];
            // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
            const virtualSourcesAzimuths = [
                Math.atan2(
                    virtualSourcesX[0] - probe.center[0],
                    virtualSourcesZ[0] - probe.center[1]
                ) + Math.PI / 2
            ];
            const samplePointX = params.samplePoint[0];
            const samplePointZ = params.samplePoint[1];

            const minTime = getMinTime(params.soundSpeed);
            const maxTime = getMaxTime(this.grid, params.soundSpeed);

            // center of probe
            const [waveOriginX, waveOriginZ] = probe.center;
            // Ensure correct size of arrays
            while (elementsX.length < this.kernel.constants.maxNumElements) {
                elementsX.push(0);
                elementsZ.push(0);
                elementWeights.push(0);
                elementNormalAzimuths.push(0);
                elementWidths.push(0);
            }
            while (virtualSourcesX.length < this.kernel.constants.maxNumVirtualSources) {
                virtualSourcesX.push(0);
                virtualSourcesZ.push(0);
                virtualSourcesAzimuths.push(0);
            }
            const samples = this.kernel(
                minTime, maxTime,
                samplePointX, samplePointZ,
                elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, params.elementDirectivityModel, params.probeNumElements,
                waveOriginX, waveOriginZ, params.transmittedWaveType,
                virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, virtualSourcesX.length,
                params.centerFrequency, params.pulseLength,
                params.soundSpeed, params.soundSpeedAssumedTx, depthDispersionStrength,
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
            const x = (params.time - minTime) / (maxTime - minTime) * canvas.width;
            ctx.moveTo(x, canvas.height / 8);
            ctx.lineTo(x, canvas.height / 8 * 7);
            ctx.stroke();
            ctx.restore();
        }
    }

    dragTime(x) {
        const minTime = getMinTime(params.soundSpeed);
        const maxTime = getMaxTime(this.grid, params.soundSpeed);
        if (this.dragging) {
            updateParam("time", x * (maxTime - minTime) + minTime);
        }
    }

    startDragging(x) {
        const minTime = getMinTime(params.soundSpeed);
        const maxTime = getMaxTime(this.grid, params.soundSpeed);
        updateParam("time", x * (maxTime - minTime) + minTime);
        this.dragging = true;
    }
    stopDragging(x) {
        this.dragging = false;
    }
}