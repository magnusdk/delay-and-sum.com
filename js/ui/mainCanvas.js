import { Colors } from "/js/ui/colors.js";
import { params } from "/js/params.js";


function drawVirtualSourceCircle(ctx, grid, probe, virtualSource) {
    const distance = (Math.sqrt(
        Math.pow(virtualSource[0] - probe.center[0], 2) +
        Math.pow(virtualSource[1] - probe.center[1], 2),
    ) - params.time) * params.soundSpeed;
    const sign = Math.sign(distance);
    const radius = Math.abs(grid.toCanvasSize(distance));
    const [x, z] = grid.toCanvasCoords(...virtualSource);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = Colors.hexToRGB(Colors.insonifiedVirtualCircle, 0.5);
    ctx.lineWidth = 3;
    ctx.arc(x, z, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = Colors.sonifiedVirtualCircle;
    ctx.lineCap = "round";

    let angleLeft = Math.atan2(
        virtualSource[1] - probe.zMin,
        virtualSource[0] - probe.xMin,
    ) - (sign > 0 ? Math.PI : 0);
    let angleRight = Math.atan2(
        virtualSource[1] - probe.zMax,
        virtualSource[0] - probe.xMax,
    ) - (sign > 0 ? Math.PI : 0);
    // Swap angles if the virtual source is behind the probe
    const side = Math.sign(
        (probe.xMax - probe.xMin) * (virtualSource[1] - probe.zMin) -
        (probe.zMax - probe.zMin) * (virtualSource[0] - probe.xMin),
    );
    if (side > 0) {
        [angleLeft, angleRight] = [angleRight, angleLeft];
    }
    ctx.arc(x, z, radius, angleRight, angleLeft);
    ctx.stroke();
    ctx.restore();
}


function drawInsonifiedArea(ctx, grid, probe, virtualSource) {
    ctx.save();
    ctx.fillStyle = Colors.hexToRGB(Colors.sonifiedArea, 0.3);
    const angleLeft = Math.atan2(
        virtualSource[1] - probe.zMin,
        virtualSource[0] - probe.xMin,
    );
    const angleRight = Math.atan2(
        virtualSource[1] - probe.zMax,
        virtualSource[0] - probe.xMax,
    );
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(probe.xMax, probe.zMax));
    ctx.lineTo(...grid.toCanvasCoords(probe.xMin, probe.zMin));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angleLeft) * 1000,
        probe.zMin + Math.sin(angleLeft) * 1000,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angleRight) * 1000,
        probe.zMin + Math.sin(angleRight) * 1000,
    ));
    ctx.fill();

    ctx.restore();
}

export class MainCanvas {
    constructor(canvas, grid, probe, draggableManager, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.grid = grid;
        this.probe = probe
        this.draggableManager = draggableManager;
        this.shouldRedraw = true;
        this.opts = opts ? opts : {};
    }

    drawProbe() {
        this.ctx.save();
        // Draw probe
        const elRadiusPx = 3;
        const probeHeightPx = 5;

        // Draw probe around elements
        if (this.opts["fancyProbe"]) {
            let [xMin, zMin] = this.grid.toCanvasCoords(this.probe.xMin, this.probe.zMin);
            let [xMax, zMax] = this.grid.toCanvasCoords(this.probe.xMax, this.probe.zMax);

            this.ctx.strokeStyle = Colors.probe;
            // rounded butts
            this.ctx.lineCap = "round";
            this.ctx.lineWidth = 3;

            this.ctx.beginPath();
            this.ctx.moveTo(xMin, zMin);
            this.ctx.lineTo(xMax, zMax);
            this.ctx.stroke();
            //this.ctx.fillStyle = Colors.probe;
            //const dx = xMin - xMax;
            //const dz = zMin - zMax;
            //const angle = Math.atan2(dz, dx);
            //const angle90 = angle + Math.PI / 2;
            //const sinAngle = Math.sin(angle);
            //const cosAngle = Math.cos(angle);
            //const sinAngle90 = Math.sin(angle90);
            //const cosAngle90 = Math.cos(angle90);
            //const p1 = [xMin + sinAngle90 * elRadiusPx, zMin - cosAngle90 * elRadiusPx];
            //const p2 = [xMax - sinAngle90 * elRadiusPx, zMax + cosAngle90 * elRadiusPx];
            //const p3 = [xMax - sinAngle * probeHeightPx, zMax + cosAngle * probeHeightPx];
            //const p4 = [xMin - sinAngle * probeHeightPx, zMin + cosAngle * probeHeightPx];
            //this.ctx.moveTo(...p1);
            //this.ctx.lineTo(...p2);
            //this.ctx.lineTo(...p3);
            //this.ctx.lineTo(...p4);
            //this.ctx.fill();
        }

        // Draw probe element outlines
        for (let i = 0; i < this.probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(this.probe.x[i], this.probe.z[i]);
            this.ctx.strokeStyle = Colors.probeElementsOutline;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
        // Draw probe element fillings
        for (let i = 0; i < this.probe.numElements; i++) {
            let [x, z] = this.grid.toCanvasCoords(this.probe.x[i], this.probe.z[i]);
            this.ctx.fillStyle = Colors.probeElements;
            this.ctx.beginPath();
            this.ctx.arc(x, z, elRadiusPx, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }

    drawBackground() {
        if (this.opts["sectorScanBackground"]) {
            // Draw a white sector scan with a dark blue background
            this.ctx.save();
            this.ctx.fillStyle = Colors.background;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.beginPath();
            const [x, z] = this.grid.toCanvasCoords(0, params.sectorDepthsMin);
            this.ctx.moveTo(x, z);
            this.ctx.arc(
                x, z, this.grid.toCanvasSize(params.sectorDepthsMax - params.sectorDepthsMin),
                Math.PI / 2 - params.sectorAzimuth / 2,
                Math.PI / 2 + params.sectorAzimuth / 2,
            );
            this.ctx.fillStyle = Colors.scanArea;
            this.ctx.fill();
            this.ctx.restore();
        } else {
            // Just clear the canvas
            this.ctx.save();
            this.ctx.fillStyle = Colors.scanArea;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fill();
            this.ctx.restore();
        }

        if (this.opts["drawInsonifiedArea"]) {
            drawInsonifiedArea(this.ctx, this.grid, this.probe, params.virtualSource);
        }
        this.drawProbe();
        if (this.opts["drawVirtualSourceCircle"]) {
            drawVirtualSourceCircle(this.ctx, this.grid, this.probe, params.virtualSource);
        }
    }

    drawTopUI() {
        // Draw draggable points
        this.ctx.save();
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
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, z, 5, 0, 2 * Math.PI);
                this.ctx.fill();
            } else if (draggablePoint == this.draggableManager.hovering) {
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, z, 8, 0, 2 * Math.PI);
                this.ctx.fill();
            } else {
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, z, 5, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        }
        this.ctx.restore();
    }

    draw() {
        this.drawBackground();
        this.drawTopUI();
    }
}