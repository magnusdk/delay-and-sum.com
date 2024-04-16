import { Colors } from "/v3/js/ui/colors.js";
import { params, isUpdatedParam } from "/v3/js/params.js";
import { drawPlaneWave, drawSonifiedAreaPlaneWave } from "/v3/js/ui/waveDrawing/plane.js";
import { drawDivergingWave, drawSonifiedAreaDivergingWave } from "/v3/js/ui/waveDrawing/diverging.js";
import { drawFocusedWave, drawSonifiedAreaFocusedWave } from "/v3/js/ui/waveDrawing/focused.js";
import { ProbeInfo } from "/v3/js/probe.js";


export class BackgroundCanvas {
    constructor(canvas, grid, draggableManager, opts) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.grid = grid;
        this.draggableManager = draggableManager;
        this.shouldRedraw = true;
        this.opts = opts ? opts : {};
    }

    drawProbe() {
        const probe = ProbeInfo.fromParams(params);
        this.ctx.save();
        // Draw probe
        const elRadiusPx = 4;

        // Draw probe around elements
        if (this.opts["drawProbeLine"]) {
            let [xMin, zMin] = this.grid.toCanvasCoords(probe.xMin, probe.zMin);
            let [xMax, zMax] = this.grid.toCanvasCoords(probe.xMax, probe.zMax);

            this.ctx.strokeStyle = Colors.probe;
            this.ctx.lineCap = "round";
            this.ctx.lineWidth = 4;

            this.ctx.beginPath();
            this.ctx.moveTo(xMin, zMin);
            for (let i = 0; i < probe.numElements; i++) {
                let [x, z] = this.grid.toCanvasCoords(probe.x[i], probe.z[i]);
                this.ctx.lineTo(x, z);
            }
            this.ctx.lineTo(xMax, zMax);
            this.ctx.stroke();
        }

        // Draw probe element outlines
        for (let i = 0; i < probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(probe.x[i], probe.z[i]);
            this.ctx.strokeStyle = Colors.probeElementsOutline;
            this.ctx.lineWidth = 8;
            this.ctx.beginPath();
            this.ctx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
        // Draw probe element fillings
        for (let i = 0; i < probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(probe.x[i], probe.z[i]);
            this.ctx.fillStyle = Colors.probeElements;
            this.ctx.beginPath();
            this.ctx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawVirtualSourceGeometry(probe) {
        if (params.transmittedWaveType == 0) {
            // Focused wave
            drawFocusedWave(this.ctx, this.grid, probe, params.virtualSource, params.time, params.soundSpeed);
        } else if (params.transmittedWaveType == 1) {
            // Plane wave
            drawPlaneWave(this.ctx, this.grid, probe, params.virtualSource, params.time, params.soundSpeed);
        } else if (params.transmittedWaveType == 2) {
            // Diverging wave
            drawDivergingWave(this.ctx, this.grid, probe, params.virtualSource, params.time, params.soundSpeed);
        } else {
            drawVirtualSourceGeometry(this.ctx, this.grid, probe, params.virtualSource);
        }
    }

    clearCanvas() {
        this.ctx.save();
        this.ctx.fillStyle = Colors.scanArea;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawSonifiedArea(probe) {
        if (params.transmittedWaveType == 0) {
            // Focused wave
            drawSonifiedAreaFocusedWave(this.ctx, this.grid, probe, params.virtualSource);
        }
        else if (params.transmittedWaveType == 1) {
            // Plane wave
            drawSonifiedAreaPlaneWave(this.ctx, this.grid, probe, params.virtualSource);
        } else if (params.transmittedWaveType == 2) {
            // Diverging wave
            drawSonifiedAreaDivergingWave(this.ctx, this.grid, probe, params.virtualSource);
        } else {
            drawSonifiedArea(this.ctx, this.grid, probe, params.virtualSource);
        }
    }

    update() {
        if (isUpdatedParam(
            "sectorDepthsMax",
            "sectorDepthsMin",
            "sectorAzimuth",
            "transmittedWaveType",
            "time",
            "soundSpeed",
            "virtualSource",
            "probeType",
            "probeNumElements",
            "probeLeft",
            "probeRight",
            "cameraTransform",
            "showSimplifiedWaveGeometry",
        )) {
            const probe = ProbeInfo.fromParams(params);
            this.clearCanvas();
            console.log(params.showSimplifiedWaveGeometry)
            if (params.showSimplifiedWaveGeometry) {
                this.drawSonifiedArea(probe);
            }
            this.drawProbe(probe);
            if (params.showSimplifiedWaveGeometry) {
                this.drawVirtualSourceGeometry(probe);
            }
        }
    }
}