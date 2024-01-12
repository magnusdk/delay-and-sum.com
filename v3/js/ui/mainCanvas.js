import { Colors } from "/v3/js/ui/colors.js";
import { params } from "/v3/js/params.js";
import { drawPlaneWave, drawSonifiedAreaPlaneWave } from "/v3/js/ui/waveDrawing/plane.js";
import { drawDivergingWave, drawSonifiedAreaDivergingWave } from "/v3/js/ui/waveDrawing/diverging.js";
import { drawFocusedWave, drawSonifiedAreaFocusedWave } from "/v3/js/ui/waveDrawing/focused.js";


export class MainCanvas {
    constructor(backgroundCanvas, foregroundCanvas, grid, probe, draggableManager, opts) {
        this.backgroundCanvas = backgroundCanvas;
        this.foregroundCanvas = foregroundCanvas;
        this.backgroundCtx = this.backgroundCanvas.getContext("2d");
        this.foregroundCtx = this.foregroundCanvas.getContext("2d");
        this.grid = grid;
        this.probe = probe
        this.draggableManager = draggableManager;
        this.shouldRedraw = true;
        this.opts = opts ? opts : {};
    }

    drawProbe() {
        this.backgroundCtx.save();
        // Draw probe
        const elRadiusPx = this.grid.toCanvasSize(1e-4);

        // Draw probe around elements
        if (this.opts["drawProbeLine"]) {
            let [xMin, zMin] = this.grid.toCanvasCoords(this.probe.xMin, this.probe.zMin);
            let [xMax, zMax] = this.grid.toCanvasCoords(this.probe.xMax, this.probe.zMax);

            this.backgroundCtx.strokeStyle = Colors.probe;
            // rounded butts
            this.backgroundCtx.lineCap = "round";
            this.backgroundCtx.lineWidth = this.grid.toCanvasSize(1e-4);

            this.backgroundCtx.beginPath();
            this.backgroundCtx.moveTo(xMin, zMin);
            this.backgroundCtx.lineTo(xMax, zMax);
            this.backgroundCtx.stroke();
        }

        // Draw probe element outlines
        for (let i = 0; i < this.probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(this.probe.x[i], this.probe.z[i]);
            this.backgroundCtx.strokeStyle = Colors.probeElementsOutline;
            this.backgroundCtx.lineWidth = this.grid.toCanvasSize(2e-4);
            this.backgroundCtx.beginPath();
            this.backgroundCtx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.backgroundCtx.stroke();
        }
        // Draw probe element fillings
        for (let i = 0; i < this.probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(this.probe.x[i], this.probe.z[i]);
            this.backgroundCtx.fillStyle = Colors.probeElements;
            this.backgroundCtx.beginPath();
            this.backgroundCtx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.backgroundCtx.fill();
        }
    }

    drawBackground() {
        if (this.opts["sectorScanBackground"]) {
            // Draw a white sector scan with a dark blue background
            this.backgroundCtx.save();
            this.backgroundCtx.fillStyle = Colors.background;
            this.backgroundCtx.fillRect(0, 0, this.foregroundCanvas.width, this.foregroundCanvas.height);
            this.backgroundCtx.beginPath();
            const [x, z] = this.grid.toCanvasCoords(0, params.sectorDepthsMin);
            this.backgroundCtx.moveTo(x, z);
            this.backgroundCtx.arc(
                x, z, this.grid.toCanvasSize(params.sectorDepthsMax - params.sectorDepthsMin),
                Math.PI / 2 - params.sectorAzimuth / 2,
                Math.PI / 2 + params.sectorAzimuth / 2,
            );
            this.backgroundCtx.fillStyle = Colors.scanArea;
            this.backgroundCtx.fill();
            this.backgroundCtx.restore();
        } else {
            // Just clear the canvas
            this.backgroundCtx.save();
            this.backgroundCtx.fillStyle = Colors.scanArea;
            this.backgroundCtx.fillRect(0, 0, this.foregroundCanvas.width, this.foregroundCanvas.height);
            this.backgroundCtx.fill();
            this.backgroundCtx.restore();
        }

        if (this.opts["drawSonifiedArea"]) {
            if (params.transmittedWaveType == 0) {
                // Focused wave
                drawSonifiedAreaFocusedWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource);
            }
            else if (params.transmittedWaveType == 1) {
                // Plane wave
                drawSonifiedAreaPlaneWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource);
            } else if (params.transmittedWaveType == 2) {
                // Diverging wave
                drawSonifiedAreaDivergingWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource);
            } else {
                drawSonifiedArea(this.backgroundCtx, this.grid, this.probe, params.virtualSource);
            }
        }
        this.drawProbe();
        if (this.opts["drawVirtualSourceGeometry"]) {
            if (params.transmittedWaveType == 0) {
                // Focused wave
                drawFocusedWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource, params.time, params.soundSpeed);
            } else if (params.transmittedWaveType == 1) {
                // Plane wave
                drawPlaneWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource, params.time, params.soundSpeed);
            } else if (params.transmittedWaveType == 2) {
                // Diverging wave
                drawDivergingWave(this.backgroundCtx, this.grid, this.probe, params.virtualSource, params.time, params.soundSpeed);
            } else {
                drawVirtualSourceGeometry(this.backgroundCtx, this.grid, this.probe, params.virtualSource);
            }
        }
    }

    drawGrid(xStep, zStep) {
        this.foregroundCtx.save();
        this.foregroundCtx.strokeStyle = Colors.grid;
        this.foregroundCtx.lineWidth = Math.max(1, this.grid.toCanvasSize(0.25e-4));
        this.foregroundCtx.beginPath();
        for (let x = params.xMin; x <= params.xMax; x += xStep) {
            const [xCanvas, zCanvas] = this.grid.toCanvasCoords(x, params.zMin);
            this.foregroundCtx.moveTo(xCanvas, zCanvas);
            this.foregroundCtx.lineTo(xCanvas, zCanvas + this.foregroundCanvas.height);
        }
        for (let z = params.zMin; z <= params.zMax; z += zStep) {
            const [xCanvas, zCanvas] = this.grid.toCanvasCoords(params.xMin, z);
            this.foregroundCtx.moveTo(xCanvas, zCanvas);
            this.foregroundCtx.lineTo(xCanvas + this.foregroundCanvas.width, zCanvas);
        }
        this.foregroundCtx.stroke();
        this.foregroundCtx.restore();
    }

    drawTopUI() {
        // Clear the canvas (must be transparent)
        this.foregroundCtx.clearRect(0, 0, this.foregroundCanvas.width, this.foregroundCanvas.height);

        if (this.opts["gridLines"]) {
            // TODO: Fix grid lines wrt zooming
            //this.drawGrid(0.001, 0.001);
        }
        // Draw draggable points
        this.foregroundCtx.save();
        for (const [name, draggablePoint] of Object.entries(this.draggableManager.draggablePoints)) {
            if (draggablePoint.opts["hidden"]) {
                continue;
            }

            const [x, z] = this.grid.toCanvasCoords(...draggablePoint.getPosition());
            let color = Colors.defaultPoint;

            if (name == "virtualSource") {
                color = Colors.virtualSource;
            } else if (name == "samplePoint") {
                color = Colors.samplePoint;
            }

            if (draggablePoint.isDragging) {
                this.foregroundCtx.fillStyle = color;
                this.foregroundCtx.beginPath();
                this.foregroundCtx.arc(x, z, this.grid.toCanvasSize(2e-4), 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            } else if (draggablePoint == this.draggableManager.hovering) {
                this.foregroundCtx.fillStyle = color;
                this.foregroundCtx.beginPath();
                this.foregroundCtx.arc(x, z, this.grid.toCanvasSize(3e-4), 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            } else {
                this.foregroundCtx.fillStyle = color;
                this.foregroundCtx.beginPath();
                this.foregroundCtx.arc(x, z, this.grid.toCanvasSize(2e-4), 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            }
        }
        this.foregroundCtx.restore();
    }

    draw() {
        this.drawBackground();
        this.drawTopUI();
    }
}