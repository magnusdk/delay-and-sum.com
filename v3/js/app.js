import { Grid, getCanvasPointFromMouseEvent, getCanvasPointFromTouchEvent } from "/v3/js/grid.js";
import { getScaleMatrix, matrixMatrixMultiply } from "/v3/js/linalg.js";
import { clearUpdatedParams, params, resetParams, updateParam } from "/v3/js/params.js";
import { BackgroundCanvas } from "/v3/js/ui/canvases/backgroundCanvas.js";
import { ForegroundCanvas } from "/v3/js/ui/canvases/foregroundCanvas.js";
import { PrimarySimulationCanvas } from "/v3/js/ui/canvases/primarySimulationCanvas.js";
import { TimelineCanvas } from "/v3/js/ui/canvases/timelineCanvas.js";
import { DraggableManager } from "/v3/js/ui/draggableManager.js";
import { TooltipManager } from "/v3/js/ui/tooltipManager.js";

export class App {
    constructor(
        backgroundCanvasElement,
        primarySimulationCanvasElement,
        secondarySimulationCanvasElement,
        foregroundCanvasElement,
        timelineCanvasElement
    ) {
        this.backgroundCanvasElement = backgroundCanvasElement;
        this.primarySimulationCanvasElement = primarySimulationCanvasElement;
        this.secondarySimulationCanvasElement = secondarySimulationCanvasElement;
        this.foregroundCanvasElement = foregroundCanvasElement;
        this.timelineCanvasElement = timelineCanvasElement;

        this.grid = new Grid(this.primarySimulationCanvasElement);
        this.primarySimulationCanvas = new PrimarySimulationCanvas(
            this.primarySimulationCanvasElement,
            this.primarySimulationCanvasElement.width,
            this.primarySimulationCanvasElement.height,
            this.grid,
        );
        this.secondarySimulationCanvas = new SecondarySimulationCanvas(
            this.secondarySimulationCanvasElement,
            this.secondarySimulationCanvasElement.width,
            this.secondarySimulationCanvasElement.height,
            this.grid,
        );

        this.draggableManager = new DraggableManager(this.grid);
        this.draggableManager.addPoint("virtualSource");
        this.draggableManager.addPoint("samplePoint");
        this.draggableManager.addPoint("probeLeft", { hidden: true, "relative": true });
        this.draggableManager.addPoint("probeRight", { hidden: true, "relative": true });
        this.draggableManager.addMidPoint("probeLeft", "probeRight", { hidden: true });

        this.timelineCanvas = new TimelineCanvas(this.timelineCanvasElement, this.grid);
        this.backgroundCanvas = new BackgroundCanvas(
            this.backgroundCanvasElement,
            this.grid,
            this.draggableManager,
            {
                drawProbeLine: true,
                drawSonifiedArea: true,
                drawVirtualSourceGeometry: true,
            },
        );

        this.foregroundCanvas = new ForegroundCanvas(
            this.foregroundCanvasElement,
            this.grid,
            this.draggableManager,
            {
                gridLines: true,
            },
        );
        this.tooltipManager = new TooltipManager();

        this.connectEventListeners();
    }

    start() {
        const update = () => {
            // Each canvas only updates if a given parameter has changed since the last call to update()
            // We reset the updated parameters at the end of the loop by calling clearUpdatedParams()
            this.backgroundCanvas.update();
            this.primarySimulationCanvas.update();
            //this.secondarySimulationCanvas.update();
            this.timelineCanvas.update(this.timelineCanvasElement);
            this.foregroundCanvas.update();
            clearUpdatedParams();
            this.draggableManager.isUpdated = false;
            requestAnimationFrame(update);
        }
        update();
    }

    handleStartDraggingPoint(x, z) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.draggableManager.startDragging(x, z);
    }
    handleMoveDraggingPoint(x, z, clientX, clientY) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.tooltipManager.update(clientX, clientY, x, z);
        this.tooltipManager.show();
        this.draggableManager.update(x, z);
    }
    handleEndDraggingPoint(x, z) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.draggableManager.stopDragging(x, z);
        this.tooltipManager.hide();
    }

    handleStartDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.startDragging(t);
    }
    handleMoveDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.dragTime(t);
    }
    handleEndDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.stopDragging(t);
    }


    connectEventListeners() {
        // Event listeners for mouse events
        this.foregroundCanvasElement.addEventListener("mousedown", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvasElement, e);
            this.handleStartDraggingPoint(x, z);
        });
        this.foregroundCanvasElement.addEventListener("mousemove", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvasElement, e);
            this.handleMoveDraggingPoint(x, z, e.clientX, e.clientY);
        });
        this.foregroundCanvasElement.addEventListener("mouseup", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvasElement, e);
            this.handleEndDraggingPoint(x, z);
            this.tooltipManager.hide();
        });
        this.foregroundCanvasElement.addEventListener("mouseleave", (e) => this.tooltipManager.hide());
        this.timelineCanvasElement.addEventListener("mousedown", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            this.handleStartDraggingTimeline(x);
        });
        this.timelineCanvasElement.addEventListener("mousemove", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            this.handleMoveDraggingTimeline(x);
        });
        this.timelineCanvasElement.addEventListener("mouseup", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            this.handleEndDraggingTimeline(x);
        });

        // Event listeners for touch events
        this.foregroundCanvasElement.addEventListener("touchstart", (e) => {
            e.preventDefault();
            let [x, z] = getCanvasPointFromTouchEvent(this.foregroundCanvasElement, e);
            this.handleStartDraggingPoint(x, z);
        });
        this.foregroundCanvasElement.addEventListener("touchmove", (e) => {
            e.preventDefault();
            let [x, z] = getCanvasPointFromTouchEvent(this.foregroundCanvasElement, e);
            this.handleMoveDraggingPoint(x, z, e.touches[0].clientX, e.touches[0].clientY);
        });
        this.foregroundCanvasElement.addEventListener("touchend", (e) => {
            e.preventDefault();
            let [x, z] = getCanvasPointFromTouchEvent(this.foregroundCanvasElement, e);
            this.handleEndDraggingPoint(x, z);
            this.tooltipManager.hide();
        });
        this.foregroundCanvasElement.addEventListener("touchcancel", (e) => {
            e.preventDefault();
            let [x, z] = getCanvasPointFromTouchEvent(this.foregroundCanvasElement, e);
            this.handleEndDraggingPoint(x, z);
            this.tooltipManager.hide();
        });
        this.timelineCanvasElement.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const [x, y] = getCanvasPointFromTouchEvent(this.timelineCanvasElement, e);
                this.handleStartDraggingTimeline(x);
            }
        });
        this.timelineCanvasElement.addEventListener("touchmove", (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const [x, y] = getCanvasPointFromTouchEvent(this.timelineCanvasElement, e);
                this.handleMoveDraggingTimeline(x);
            }
        });
        this.timelineCanvasElement.addEventListener("touchend", (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const [x, y] = getCanvasPointFromTouchEvent(this.timelineCanvasElement, e);
                this.handleEndDraggingTimeline(x);
            }
        });

        // Add global mouseup listener to stop dragging if mouse leaves the window
        window.addEventListener("mouseup", (e) => {
            this.draggableManager.stopDragging();
            this.timelineCanvas.stopDragging();
        });

        // Modified code taken from https://gist.github.com/Martin-Pitt/2756cf86dca90e179b4e75003d7a1a2b
        this.foregroundCanvasElement.addEventListener('wheel', e => {
            e.preventDefault();

            if (e.ctrlKey) {
                const s = Math.exp(e.deltaY / 100);
                let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvasElement, e);
                const [anchorX, anchorZ] = this.grid.fromCanvasCoords(x, z);
                const transform = getScaleMatrix(s, anchorX, anchorZ);
                updateParam("cameraTransform", matrixMatrixMultiply(transform, params.cameraTransform));
            } else {
                const newCameraTransform = [
                    params.cameraTransform[0],
                    params.cameraTransform[1],
                    params.cameraTransform[2],
                    params.cameraTransform[3],
                    params.cameraTransform[4] + 2 * e.deltaX / this.grid.toCanvasSize(1),
                    params.cameraTransform[5] + 2 * e.deltaY / this.grid.toCanvasSize(1),
                ]
                updateParam("cameraTransform", newCameraTransform);
            }
        }, {
            passive: false
        });
    }

    updateParam(name, value) {
        updateParam(name, value);
    }

    resetParams() {
        resetParams();
    }
}