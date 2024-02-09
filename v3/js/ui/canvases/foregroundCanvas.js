import { Colors } from "/v3/js/ui/colors.js";
import { isUpdatedParam } from "/v3/js/params.js";


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

        if (this.opts["gridLines"]) {
            // TODO: Fix grid lines wrt zooming
            //this.drawGrid(0.001, 0.001);
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