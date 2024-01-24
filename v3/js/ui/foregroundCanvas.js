import { Colors } from "/v3/js/ui/colors.js";
import { isUpdatedParam } from "/v3/js/params.js";


export class ForegroundCanvas {
    constructor(foregroundCanvas, grid, draggableManager, opts) {
        this.foregroundCanvas = foregroundCanvas;
        this.foregroundCtx = this.foregroundCanvas.getContext("2d");
        this.grid = grid;
        this.draggableManager = draggableManager;
        this.shouldRedraw = true;
        this.opts = opts ? opts : {};
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
            if (draggablePoint.opts["hidden"] || draggablePoint.isDisabled()) {
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
                this.foregroundCtx.arc(x, z, 8, 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            } else if (draggablePoint == this.draggableManager.hovering) {
                this.foregroundCtx.fillStyle = color;
                this.foregroundCtx.beginPath();
                this.foregroundCtx.arc(x, z, 10, 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            } else {
                this.foregroundCtx.fillStyle = color;
                this.foregroundCtx.beginPath();
                this.foregroundCtx.arc(x, z, 8, 0, 2 * Math.PI);
                this.foregroundCtx.fill();
            }
        }
        this.foregroundCtx.restore();
    }

    update() {
        if (this.draggableManager.isUpdated || isUpdatedParam("cameraTransform")) {
            this.drawTopUI();
        }
    }
}