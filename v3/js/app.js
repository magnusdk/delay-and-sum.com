import { Grid, getCanvasPointFromMouseEvent, getCanvasPointFromTouchEvent } from "/v3/js/grid.js";
import { getScaleMatrix, matrixMatrixMultiply } from "/v3/js/linalg.js";
import { clearUpdatedParams, params, resetParams, updateParam } from "/v3/js/params.js";
import { BackgroundCanvas } from "/v3/js/ui/canvases/backgroundCanvas.js";
import { SamplePointsCanvas } from "/v3/js/ui/canvases/controlCanvases/samplePointsCanvas.js";
import { ForegroundCanvas } from "/v3/js/ui/canvases/foregroundCanvas.js";
import { MainSimulationCanvas } from "/v3/js/ui/canvases/mainSimulationCanvas.js";
import { OverlaySimulationCanvas } from "/v3/js/ui/canvases/overlaySimulationCanvas.js";
import { TimelineCanvas } from "/v3/js/ui/canvases/timelineCanvas.js";
import { DraggableManager } from "/v3/js/ui/draggableManager.js";
import { SnapshotsManager } from "/v3/js/ui/snapshotsManager.js";
import { TimelineAnimator } from "/v3/js/ui/timelineAnimator.js";
import { TooltipManager } from "/v3/js/ui/tooltipManager.js";


export class App {
    constructor(
        backgroundCanvasElement,
        mainSimulationCanvasElement,
        overlaySimulationCanvasElement,
        foregroundCanvasElement,
        timelineCanvasElement,
        snapshotsContainerElement,
    ) {
        this.backgroundCanvasElement = backgroundCanvasElement;
        this.mainSimulationCanvasElement = mainSimulationCanvasElement;
        this.overlaySimulationCanvasElement = overlaySimulationCanvasElement;
        this.foregroundCanvasElement = foregroundCanvasElement;
        this.timelineCanvasElement = timelineCanvasElement;
        this.snapshotsContainerElement = snapshotsContainerElement;

        this.grid = new Grid(this.mainSimulationCanvasElement);
        this.mainSimulationCanvas = new MainSimulationCanvas(
            this.mainSimulationCanvasElement,
            this.mainSimulationCanvasElement.width,
            this.mainSimulationCanvasElement.height,
            this.grid,
        );
        this.overlaySimulationCanvas = new OverlaySimulationCanvas(
            this.overlaySimulationCanvasElement, 100, 100, this.grid
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

        this.samplePointsCanvas = new SamplePointsCanvas(512, 50);
        this.foregroundCanvas = new ForegroundCanvas(
            this.foregroundCanvasElement,
            this.grid,
            this.samplePointsCanvas.width,
            this.draggableManager,
        );
        this.tooltipManager = new TooltipManager();
        this.timelineAnimator = new TimelineAnimator(this.grid);
        this.snapshotsManager = new SnapshotsManager(this);
        this.params = params;
        
        this.connectEventListeners();
    }

    update() {
        // Each canvas only updates if a given parameter has changed since the last call to update()
        // We reset the updated parameters at the end of the loop by calling clearUpdatedParams()
        this.backgroundCanvas.update();
        this.mainSimulationCanvas.update();
        this.overlaySimulationCanvas.update();
        this.timelineCanvas.update(this.timelineCanvasElement);
        this.foregroundCanvas.update();
        this.samplePointsCanvas.update();
        clearUpdatedParams();
        this.draggableManager.isUpdated = false;

        if (params.animateTimeline) {
            this.timelineAnimator.update();
        }
    }

    start() {
        const _update = () => {
            //const startTime = performance.now();
            this.update();
            //const endTime = performance.now();
            //const elapsedTime = endTime - startTime;
            //console.log("Average elapsed time:", elapsedTime, "milliseconds");
            requestAnimationFrame(_update);
        }
        _update();
        //console.log(foo(params, this.samplePointsCanvas));
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

    resetParams(...paramNames) {
        resetParams(...paramNames);
    }
}