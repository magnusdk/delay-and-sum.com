import { isUpdatedParam } from "/v3/js/params.js";
import { Colors } from "/v3/js/ui/colors.js";


function drawGrid(canvas, ctx, grid) {
    const [topLeftX, topLeftZ] = grid.fromCanvasCoords(0, 0);
    const [bottomRightX, bottomRightZ] = grid.fromCanvasCoords(canvas.width, canvas.height);
    const width = bottomRightX - topLeftX;
    const height = bottomRightZ - topLeftZ;

    // When the user zooms in such that the number of grid cells drawn is less than 
    // minNumberOfCellsRendered, the grid will be drawn at a higher level of detail.
    const minNumberOfCellsRendered = 3;
    const snap = Math.floor(Math.log10(width) - Math.log10(minNumberOfCellsRendered));
    const dx = 10 ** snap;
    const snappedX = Math.ceil(topLeftX / dx) * dx;
    const snappedZ = Math.ceil(topLeftZ / dx) * dx;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    let i = 0;
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

        if (this.opts["drawGrid"]) {
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
        if (this.draggableManager.isUpdated || isUpdatedParam("cameraTransform")) {
            this.drawTopUI();
        }
    }
}