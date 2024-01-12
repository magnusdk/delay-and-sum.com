import { TooltipManager } from "/v3/js/ui/tooltipManager.js";
import { getCanvasPointFromMouseEvent, getCanvasPointFromTouchEvent } from "/v3/js/util.js";
import { Grid } from "/v3/js/grid.js";
import { DraggableManager } from "/v3/js/ui/draggableManager.js";
import { MainCanvas } from "/v3/js/ui/mainCanvas.js";
import { LinearProbe } from "/v3/js/probe.js";
import { params, resetParams, updateParam } from "/v3/js/params.js";
import { PrimarySimulationCanvas, SecondarySimulationCanvas, TimelineCanvas } from "/v3/js/ui/simulation.js";


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

        this.grid = new Grid(
            this.primarySimulationCanvasElement.width,
            this.primarySimulationCanvasElement.height,
        );
        this.primarySimulationCanvas = new PrimarySimulationCanvas(
            this.primarySimulationCanvasElement,
            this.primarySimulationCanvasElement.width,
            this.primarySimulationCanvasElement.height,
            this.grid,
        );
        this.secondarySimulationCanvas = new SecondarySimulationCanvas(
            this.secondarySimulationCanvasElement.width,
            this.secondarySimulationCanvasElement.height,
            this.grid,
        );

        this.probe = new LinearProbe();
        this.draggableManager = new DraggableManager();
        this.draggableManager.addPoint("virtualSource");
        this.draggableManager.addPoint("samplePoint");
        this.draggableManager.addPoint("probeLeft", { hidden: true, "relative": true });
        this.draggableManager.addPoint("probeRight", { hidden: true, "relative": true });
        this.draggableManager.addMidPoint("probeLeft", "probeRight", { hidden: true });

        this.timelineCanvas = new TimelineCanvas(this.grid);
        this.mainCanvas = new MainCanvas(
            this.backgroundCanvasElement,
            this.foregroundCanvasElement,
            this.grid,
            this.probe,
            this.draggableManager,
            {
                drawProbeLine: true,
                drawSonifiedArea: true,
                drawVirtualSourceGeometry: true,
                sectorScanBackground: false,
                gridLines: true,
            },
        );
        this.tooltipManager = new TooltipManager();

        this.connectEventListeners();

        // We need to copy the image from primary canvas because of a alpha composition bug in Safari/iOS (I think)
        // See this.primarySimulationCanvas.update() instead
        //primarySimulationCanvasElement.replaceWith(this.primarySimulationCanvas.canvas);

        // For the secondary canvas we can just draw directly to it, so we replace the element with the GPU.js canvas
        secondarySimulationCanvas.replaceWith(this.secondarySimulationCanvas.canvas);
    }

    start() {
        this.grid.update();
        this.probe.loadParams();
        const draw = () => {
            if (this.mainCanvas.shouldRedraw) {
                this.mainCanvas.draw();
                this.primarySimulationCanvas.update(this.probe);
                if (params.calculateMaximumIntensity) {
                    this.secondarySimulationCanvas.update(this.probe);
                } else {
                    this.secondarySimulationCanvas.clear();
                }
                this.mainCanvas.shouldRedraw = false;

                // TODO: Only update when needed or move shouldRedraw outside of mainCanvas
                this.timelineCanvas.draw(this.timelineCanvasElement, this.probe);
            }
            requestAnimationFrame(draw);
        }
        draw();
    }

    handleStartDraggingPoint(x, z) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.draggableManager.startDragging(x, z);
        this.mainCanvas.shouldRedraw = true;
    }
    handleMoveDraggingPoint(x, z, clientX, clientY) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.tooltipManager.update(clientX, clientY, x, z);
        this.tooltipManager.show();

        this.draggableManager.update(x, z);
        this.probe.loadParams();
        this.mainCanvas.shouldRedraw = true;
    }
    handleEndDraggingPoint(x, z) {
        [x, z] = this.grid.fromCanvasCoords(x, z);
        this.draggableManager.stopDragging(x, z);
        this.mainCanvas.shouldRedraw = true;
        this.tooltipManager.hide();
    }

    handleStartDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.startDragging(t);
        this.mainCanvas.shouldRedraw = true;
    }
    handleMoveDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.dragTime(t);
        this.mainCanvas.shouldRedraw = true;
    }
    handleEndDraggingTimeline(x) {
        const t = x / this.timelineCanvasElement.width;
        this.timelineCanvas.stopDragging(t);
        this.mainCanvas.shouldRedraw = true;
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
            this.mainCanvas.shouldRedraw = true;
        });
    }

    updateParam(name, value) {
        updateParam(name, value);
        this.grid.update();
        this.probe.loadParams();
        this.mainCanvas.shouldRedraw = true;
    }

    resetParams() {
        resetParams();
        this.grid.update();
        this.probe.loadParams();
        this.mainCanvas.shouldRedraw = true;
    }
}