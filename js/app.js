import { TooltipManager } from "/js/ui/tooltipManager.js";
import { getCanvasPointFromMouseEvent } from "/js/util.js";
import { Grid } from "/js/grid.js";
import { DraggableManager } from "/js/ui/draggableManager.js";
import { MainCanvas } from "/js/ui/mainCanvas.js";
import { LinearProbe } from "/js/probe.js";
import { params, resetParams, updateParam } from "/js/params.js";
// import { renderXTicks, renderZTicks } from "/js/ui/ticks.js";
import { MainSimulationCanvas } from "/js/ui/simulation.js";


export class App {
    constructor(
        backgroundCanvas,
        simulationCanvas,
        foregroundCanvas,
        timelineCanvasElement
    ) {
        this.backgroundCanvas = backgroundCanvas;
        this.simulationCanvas = simulationCanvas;
        this.foregroundCanvas = foregroundCanvas;
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

        const maxTime = params.sectorDepthsMax / params.soundSpeed * 1.5;
        var sign = 1;
        const draw = () => {
            //this.mainCanvas.shouldRedraw = true;

            if (this.mainCanvas.shouldRedraw) {
                this.mainCanvas.draw();
                this.mainSimulationCanvas.draw(this.simulationCanvas, this.probe);
                this.mainCanvas.shouldRedraw = false;
            }
            //params.time += maxTime / 400 * sign;
            //if ((params.time > maxTime) || params.time < 0) params.time=0;//sign *= -1;
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