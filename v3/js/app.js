import { TooltipManager } from "/v3/js/ui/tooltipManager.js";
import { getCanvasPointFromMouseEvent } from "/v3/js/util.js";
import { Grid } from "/v3/js/grid.js";
import { DraggableManager } from "/v3/js/ui/draggableManager.js";
import { MainCanvas } from "/v3/js/ui/mainCanvas.js";
import { LinearProbe } from "/v3/js/probe.js";
import { resetParams, updateParam } from "/v3/js/params.js";
import { MainSimulationCanvas, TimelineCanvas } from "/v3/js/ui/simulation.js";


export class App {
    constructor(
        backgroundCanvasElement,
        simulationCanvasElement,
        foregroundCanvasElement,
        timelineCanvasElement
    ) {
        this.backgroundCanvas = backgroundCanvasElement;
        this.simulationCanvas = simulationCanvasElement;
        this.foregroundCanvas = foregroundCanvasElement;
        this.timelineCanvasElement = timelineCanvasElement;

        this.mainSimulationCanvas = new MainSimulationCanvas(
            this.simulationCanvas.width,
            this.simulationCanvas.height
        );

        this.probe = new LinearProbe();
        this.draggableManager = new DraggableManager();
        this.draggableManager.addPoint("virtualSource");
        this.draggableManager.addPoint("samplePoint");
        this.draggableManager.addPoint("probeLeft", { hidden: true, "relative": true });
        this.draggableManager.addPoint("probeRight", { hidden: true, "relative": true });
        this.draggableManager.addMidPoint("probeLeft", "probeRight", { hidden: true });

        this.grid = new Grid(this.simulationCanvas.width, this.simulationCanvas.height);
        this.timelineCanvas = new TimelineCanvas(this.grid);
        this.mainCanvas = new MainCanvas(
            this.backgroundCanvas,
            this.foregroundCanvas,
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
    }

    start() {
        this.probe.loadParams();
        const draw = () => {
            if (this.mainCanvas.shouldRedraw) {
                this.mainCanvas.draw();
                this.mainSimulationCanvas.draw(this.simulationCanvas, this.probe);
                this.mainCanvas.shouldRedraw = false;

                // TODO: Only update when needed or move shouldRedraw outside of mainCanvas
                this.timelineCanvas.draw(this.timelineCanvasElement, this.probe);
            }
            requestAnimationFrame(draw);
        }
        draw();
    }


    connectEventListeners() {
        this.foregroundCanvas.addEventListener("mousemove", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvas, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.tooltipManager.update(e.clientX, e.clientY, x, z);
            this.tooltipManager.show();

            this.draggableManager.update(x, z);
            this.probe.loadParams();
            this.mainCanvas.shouldRedraw = true;
        });
        this.foregroundCanvas.addEventListener("mousedown", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvas, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.draggableManager.startDragging(x, z);
            this.mainCanvas.shouldRedraw = true;
        });
        this.foregroundCanvas.addEventListener("mouseup", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.foregroundCanvas, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.draggableManager.stopDragging(x, z);
            this.mainCanvas.shouldRedraw = true;
        });
        this.foregroundCanvas.addEventListener("mouseleave", (e) => {
            this.tooltipManager.hide();
        });

        // Drag time over the timeline
        this.timelineCanvasElement.addEventListener("mousemove", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            const t = x / this.timelineCanvasElement.width;
            this.timelineCanvas.dragTime(t);
            this.mainCanvas.shouldRedraw = true;
        });
        this.timelineCanvasElement.addEventListener("mousedown", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            const t = x / this.timelineCanvasElement.width;
            this.timelineCanvas.startDragging(t);
            this.mainCanvas.shouldRedraw = true;
        });
        this.timelineCanvasElement.addEventListener("mouseup", (e) => {
            const [x, y] = getCanvasPointFromMouseEvent(this.timelineCanvasElement, e);
            const t = x / this.timelineCanvasElement.width;
            this.timelineCanvas.stopDragging(t);
            this.mainCanvas.shouldRedraw = true;
        });
    }

    updateParam(name, value) {
        updateParam(name, value);
        this.probe.loadParams();
        this.mainCanvas.shouldRedraw = true;
    }

    resetParams() {
        resetParams();
        this.probe.loadParams();
        this.mainCanvas.shouldRedraw = true;
    }
}