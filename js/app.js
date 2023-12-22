import { TooltipManager } from "/js/ui/tooltipManager.js";
import { getCanvasPointFromMouseEvent } from "/js/util.js";
import { Grid } from "/js/grid.js";
import { DraggableManager } from "/js/ui/draggableManager.js";
import { MainCanvas } from "/js/ui/mainCanvas.js";
import { LinearProbe } from "/js/probe.js";
import { params, loadParamsFromURL, resetParams, defaultParams, updateParam } from "/js/params.js";
// import { renderXTicks, renderZTicks } from "/js/ui/ticks.js";



class Foo {
    constructor(grid) {
        this.grid = grid;
        this.canvas = document.createElement("canvas");
        this.canvas.width = 500;
        this.canvas.height = 500;
        this.gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.canvas, webGl: this.gl });
        this.kernel = this.gpu.createKernel(
            function (
                t,
                elementsX, elementsZ, numElements,
                waveOriginX, waveOriginZ,
                virtualSourcesX, virtualSourcesZ, numVirtualSources,
                f, pulseLength, c,
                gain, displayMode,
            ) {
                let {
                    thread: { x, y },
                    constants: {
                        canvasWidth, canvasHeight,
                        gridWidth, gridHeight,
                        gridXMin, gridXMax, gridZMin, gridZMax,
                        maxNumElements, maxNumVirtualSources
                    }
                } = this;
                x = x / canvasWidth * gridWidth + gridXMin;
                let z = (1 - y / canvasHeight) * gridHeight + gridZMin;

                let real = 0;
                let imag = 0;
                for (let i = 0; i < maxNumVirtualSources; i++) {
                    const virtualSourceX = virtualSourcesX[i];
                    const virtualSourceZ = virtualSourcesZ[i];
                    const originToVirtualSourceDist = Math.sqrt(
                        (virtualSourceX - waveOriginX) ** 2
                        + (virtualSourceZ - waveOriginZ) ** 2
                    );

                    for (let j = 0; j < maxNumElements; j++) {
                        if (j < numElements && i < numVirtualSources) {
                            const elX = elementsX[j];
                            const elZ = elementsZ[j];
                            const elToVirtualSourceDist = Math.sqrt(
                                (virtualSourceX - elX) ** 2
                                + (virtualSourceZ - elZ) ** 2
                            );
                            const t0 = (elToVirtualSourceDist - originToVirtualSourceDist) / c;

                            const dist = Math.sqrt((x - elX) ** 2 + (z - elZ) ** 2);
                            const phase = (dist / c - (t + t0)) * f;
                            const gauss = Math.exp(-Math.pow(phase / pulseLength * 2, 2));
                            real += Math.sin(phase * Math.PI * 2) * gauss
                            imag += Math.cos(phase * Math.PI * 2) * gauss
                        }
                    }
                }
                real = (real / (numElements * 0 + 1)) * 10 ** (gain / 20)
                imag = (imag / (numElements * 0 + 1)) * 10 ** (gain / 20)


                // Color selection. Correspond to pink for positive phase, blue for 
                // negative phase (following palette in /js/ui/colors.js).
                const pinkR = 1;
                const pinkG = 0.09803921568627451;
                const pinkB = 0.3686274509803922;
                const blueR = 0;
                const blueG = 0.5215686274509804;
                const blueB = 1;

                if (displayMode >= 1) {
                    // Amplitude or intensity post-processing mode
                    let env = Math.sqrt(Math.pow(real, 2) + Math.pow(imag, 2)) / Math.sqrt(2);
                    if (displayMode == 2) {
                        // Intensity post-processing mode
                        env = env ** 2;
                    }
                    this.color(0, 0, 0, env);
                } else {
                    this.color(
                        real > 0 ? pinkR : blueR,
                        real > 0 ? pinkG : blueG,
                        real > 0 ? pinkB : blueB,
                        Math.abs(real)
                    );
                }
            })
            .setOutput([this.gpu.canvas.width, this.gpu.canvas.height])
            .setGraphical(true)
            .setConstants({
                "canvasWidth": this.gpu.canvas.width,
                "canvasHeight": this.gpu.canvas.height,
                "gridWidth": params.width,
                "gridHeight": params.height,
                "gridXMin": params.xMin,
                "gridXMax": params.xMax,
                "gridZMin": params.zMin,
                "gridZMax": params.zMax,
                "maxNumElements": 200,
                "maxNumVirtualSources": 1,
            })
    }

    draw(canvas, probe) {
        const [elementsX, elementsZ] = [probe.x, probe.z];
        const virtualSourcesX = [params.virtualSource[0]];
        const virtualSourcesZ = [params.virtualSource[1]];

        // center of probe
        const [waveOriginX, waveOriginZ] = probe.center;
        // Ensure correct size of arrays
        while (elementsX.length < this.kernel.constants.maxNumElements) {
            elementsX.push(0);
            elementsZ.push(0);
        }
        while (virtualSourcesX.length < this.kernel.constants.maxNumVirtualSources) {
            virtualSourcesX.push(0);
            virtualSourcesZ.push(0);
        }
        this.kernel(
            params.time,
            elementsX, elementsZ, params.probeNumElements,
            waveOriginX, waveOriginZ,
            virtualSourcesX, virtualSourcesZ, virtualSourcesX.length,
            params.centerFrequency, params.pulseLength, params.soundSpeed,
            params.gain, params.displayMode,
        );
        const ctx = canvas.getContext("2d");
        ctx.drawImage(this.canvas, 0, 0);
    }
}


export class App {
    constructor(
        mainCanvasElement,
        timelineCanvasElement
    ) {
        this.foo = new Foo();
        this.mainCanvasElement = mainCanvasElement;
        this.timelineCanvasElement = timelineCanvasElement;

        this.probe = new LinearProbe();
        this.draggableManager = new DraggableManager();
        this.draggableManager.addPoint("virtualSource");
        this.draggableManager.addPoint("samplePoint");
        this.draggableManager.addPoint("probeLeft", { hidden: true, "relative": true });
        this.draggableManager.addPoint("probeRight", { hidden: true, "relative": true });
        this.draggableManager.addMidPoint("probeLeft", "probeRight", { hidden: true });

        this.grid = new Grid(mainCanvasElement);
        this.mainCanvas = new MainCanvas(
            mainCanvasElement,
            this.grid,
            this.probe,
            this.draggableManager,
            {
                fancyProbe: true,
                drawInsonifiedArea: false,
                drawVirtualSourceCircle: true,
            },
        );
        this.tooltipManager = new TooltipManager();

        this.connectEventListeners();
    }

    start() {
        loadParamsFromURL();
        this.probe.loadParams();
        params.time = 0;

        const maxTime = params.sectorDepthsMax / params.soundSpeed * 1.5;
        var sign = 1;
        const draw = () => {
            //this.mainCanvas.shouldRedraw = true;

            if (this.mainCanvas.shouldRedraw) {
                this.mainCanvas.draw();
                this.foo.draw(this.mainCanvasElement, this.probe);
                this.mainCanvas.shouldRedraw = false;
            }
            //params.time += maxTime / 400 * sign;
            //if ((params.time > maxTime) || params.time < 0) params.time=0;//sign *= -1;
            requestAnimationFrame(draw);
        }
        draw();
    }


    connectEventListeners() {
        this.mainCanvasElement.addEventListener("mousemove", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.mainCanvasElement, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.tooltipManager.update(e.clientX, e.clientY, x, z);
            this.tooltipManager.show();

            this.draggableManager.update(x, z);
            this.probe.loadParams();
            this.mainCanvas.shouldRedraw = true;
        });
        this.mainCanvasElement.addEventListener("mousedown", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.mainCanvasElement, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.draggableManager.startDragging(x, z);
            this.mainCanvas.shouldRedraw = true;
        });
        this.mainCanvasElement.addEventListener("mouseup", (e) => {
            let [x, z] = getCanvasPointFromMouseEvent(this.mainCanvasElement, e);
            [x, z] = this.grid.fromCanvasCoords(x, z);
            this.draggableManager.stopDragging(x, z);
            this.mainCanvas.shouldRedraw = true;
        });
        this.mainCanvasElement.addEventListener("mouseleave", (e) => {
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