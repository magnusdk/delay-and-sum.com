import { isUpdatedParam, params } from "/v3/js/params.js";
import { Colors } from "/v3/js/ui/colors.js";


function getSubmultipleOfMeter(n) {
    // n is the zoom level 10**n
    // Return the name´, i.e. mm, cm, m, km
    if (n == -3) return "mm";
    if (n == -2) return "cm";
    if (n == -1) return "dm";
    if (n == 0) return "m";
    if (n == 1) return "dam";
    if (n == 2) return "hm";
    if (n == 3) return "km";
    return "10^" + n + "m";
}

function presentMeterValue(x, n) {
    const d = Math.max(0, -3 - n);
    if (n < -3) {
        // Use mm for everything below mm
        n = -3;
    } else if (n == -1) {
        // Use cm instead of dm
        n = -2;
    } else if (0 < n && n < 3) {
        // Use meters up to kilometers
        n = 0;
    } else if (n > 3) {
        // Use kilometers for everything above
        n = 3;
    }
    x = x / (10 ** n);
    return x.toFixed(d) + " " + getSubmultipleOfMeter(n);
}

function drawGrid(canvas, ctx, grid) {
    const [topLeftX, topLeftZ] = grid.fromCanvasCoords(0, 0);
    const [bottomRightX, bottomRightZ] = grid.fromCanvasCoords(canvas.width, canvas.height);
    const width = bottomRightX - topLeftX;
    const height = bottomRightZ - topLeftZ;

    // When the user zooms in such that the number of grid cells drawn is less than 
    // minNumberOfCellsRendered, the grid will be drawn at a higher level of detail.
    const minNumberOfCellsRendered = 3;
    const snap = Math.floor(Math.log10(width) - Math.log10(minNumberOfCellsRendered));
    let dx = 10 ** snap;
    let snappedX = Math.ceil(topLeftX / dx) * dx;
    let snappedZ = Math.ceil(topLeftZ / dx) * dx;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += dx) {
        const [xCanvas, _] = grid.toCanvasCoords(snappedX + x, 0);
        ctx.moveTo(xCanvas, 0);
        ctx.lineTo(xCanvas, canvas.height);
    }
    for (let z = 0; z < height; z += dx) {
        const [_, zCanvas] = grid.toCanvasCoords(0, snappedZ + z);
        ctx.moveTo(0, zCanvas);
        ctx.lineTo(canvas.width, zCanvas);
    }
    ctx.stroke();

    // Draw an extra thick stroke at the origin
    ctx.beginPath();
    const [xCanvas, zCanvas] = grid.toCanvasCoords(0, 0);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.lineWidth = 4;
    ctx.moveTo(0 - canvas.width, zCanvas);
    ctx.lineTo(0 + canvas.width, zCanvas);
    ctx.moveTo(xCanvas, 0 - canvas.height);
    ctx.lineTo(xCanvas, 0 + canvas.height);
    ctx.stroke();
    ctx.restore();

    if (params.showGridTickLabels) {
        if (width / dx > 12) {
            dx = 5 * 10 ** (snap);
            snappedX = Math.ceil(topLeftX / dx) * dx;
            snappedZ = Math.ceil(topLeftZ / dx) * dx;
        }
        for (let x = 0; x < width; x += dx) {
            const [xCanvas, _] = grid.toCanvasCoords(snappedX + x, 0);
            ctx.font = "20px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillText(presentMeterValue(snappedX + x, snap), xCanvas + 5, canvas.height - 5);
        }
        for (let z = 0; z < height; z += dx) {
            const [_, zCanvas] = grid.toCanvasCoords(0, snappedZ + z);
            ctx.font = "20px Arial";
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillText(presentMeterValue(snappedZ + z, snap), 5, zCanvas - 5);
        }
    }
}


export class ForegroundCanvas {
    constructor(canvas, grid, draggableManager, opts) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.grid = grid;
        this.draggableManager = draggableManager;
        this.shouldRedraw = true;
        this.opts = opts ? opts : {};
    }

    drawTopUI() {
        // Clear the canvas (must be transparent)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (params.showGrid) {
            drawGrid(this.canvas, this.ctx, this.grid);
        }
        // Draw draggable points
        this.ctx.save();
        for (const [name, draggablePoint] of Object.entries(this.draggableManager.draggablePoints)) {
            if (draggablePoint.opts["hidden"] || draggablePoint.isDisabled()) {
                continue;
            }

            const [x, z] = this.grid.toCanvasCoords(...draggablePoint.getPosition());
            let fillColor = Colors.defaultPoint;

            if (name == "virtualSource") {
                fillColor = Colors.virtualSource;
            } else if (name == "samplePoint") {
                fillColor = Colors.samplePoint;
            }

            this.ctx.fillStyle = fillColor;
            this.ctx.strokeStyle = "white";
            if (draggablePoint.isDragging) {
                this.ctx.beginPath();
                this.ctx.arc(x, z, 8, 0, 2 * Math.PI);
            } else if (draggablePoint == this.draggableManager.hovering) {
                this.ctx.beginPath();
                this.ctx.arc(x, z, 10, 0, 2 * Math.PI);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(x, z, 8, 0, 2 * Math.PI);
            }
            this.ctx.fill();
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    update() {
        if (this.draggableManager.isUpdated || isUpdatedParam("cameraTransform", "showGrid", "showGridTickLabels")) {
            this.drawTopUI();
        }
    }
}