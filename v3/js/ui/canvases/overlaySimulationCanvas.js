/* 
Render the maximum pressure plot. Work-in-progress!
You can enable it by setting calculateMaximumIntensity=true in the URL.


Optimizations:
[ ] Render at lower resolution first
[x] Render smaller chunks at a time to avoid freezing the UI for too long
[ ] Only take max over time steps where there is actual energy present
[x] Debounce updating so that the user can freely change parameters without the browser 
    starting to lag straight away.
[x] Copy canvas content when panning and zooming
[ ] Render using heuristics first: the maximum is likely near the delay-hyperbola vertex
    since that is where there is most overlap between incoherent energy. May need to 
    generalize this for array-shapes other than linear.
[ ] Try to render more interesting chunks first, for example along the scanline, if applicable.

Future work:
[ ] Can we extend the heuristics to a search-algorithm that progressively searches for 
    the maximum, creating really quick user experience?

*/

import { invertScaleTranslationTransform, matrixMatrixMultiply, transformVector } from "/v3/js/linalg.js";
import { isUpdatedParam, params } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { dist, divergingWaveDistance, focusedWaveDistance, getPosition, planeWaveDistance, postProcesspixel, pressureFieldAtPoint, pulse } from "/v3/js/simulation/common.js";
import { maximumIntensityKernel } from "/v3/js/simulation/maximumIntensity.js";
import { debounce } from "/v3/js/util.js";

function clearCanvas(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}


function updateCanvasToNewCameraView(
    currentCameraTransform,
    previousCameraTransform,
    grid,
    canvasCtx,
    offscreenCanvasCtx,
) {
    /* 
    When a user simply pans or zooms the canvas, we can re-use parts of the previous 
    frame in the next frame. This makes the app feel more snappy :) First, we draw the 
    current frame to the offscreen canvas, then we draw the offscreen back to the main 
    canvas, translated and scaled according to the change in camera position and scale.
    */

    // Get the change in camera position and scale
    const deltaTransform = matrixMatrixMultiply(
        invertScaleTranslationTransform(
            matrixMatrixMultiply(
                currentCameraTransform,
                grid.inverseBaseTransform,
            )),
        matrixMatrixMultiply(
            previousCameraTransform,
            grid.inverseBaseTransform,
        ));

    // Temporarily draw the current frame to the offscreen canvas
    clearCanvas(offscreenCanvasCtx);
    offscreenCanvasCtx.drawImage(canvasCtx.canvas, 0, 0);

    // Draw the offscreen canvas back to the main canvas, translated and 
    // scaled according to the deltaTransform.
    clearCanvas(canvasCtx);
    const dx = deltaTransform[4]
    const dy = deltaTransform[5]
    const dsx = deltaTransform[0] * offscreenCanvasCtx.canvas.width
    const dsy = deltaTransform[3] * offscreenCanvasCtx.canvas.height
    canvasCtx.drawImage(offscreenCanvasCtx.canvas, dx, dy, dsx, dsy);
}


export class OverlaySimulationCanvas {
    constructor(DOMCanvasElement, width, height, grid) {
        this.DOMCanvasElement = DOMCanvasElement;
        this.DOMCanvasElementCtx = DOMCanvasElement.getContext("2d");
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = this.DOMCanvasElement.width;
        this.offscreenCanvas.height = this.DOMCanvasElement.height;
        this.offscreenCanvasCtx = this.offscreenCanvas.getContext("2d");
        this.simulationCanvas = document.createElement("canvas");
        this.simulationCanvas.id = "overlaySimulationCanvas";
        this.simulationCanvas.width = width;
        this.simulationCanvas.height = height;
        this.grid = grid;
        this.gl = this.simulationCanvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPUX({ canvas: this.simulationCanvas, webGl: this.gl });
        this.simulationKernel = this.gpu.createKernel(maximumIntensityKernel)
            .setOutput([this.gpu.canvas.width, this.gpu.canvas.height])
            .setGraphical(true)
            .setFunctions([invertScaleTranslationTransform, transformVector, getPosition, pressureFieldAtPoint, dist, pulse, focusedWaveDistance, planeWaveDistance, divergingWaveDistance, postProcesspixel])
            .setConstants({
                "ibT0": grid.inverseBaseTransform[0],
                "ibT1": grid.inverseBaseTransform[1],
                "ibT2": grid.inverseBaseTransform[2],
                "ibT3": grid.inverseBaseTransform[3],
                "ibT4": grid.inverseBaseTransform[4],
                "ibT5": grid.inverseBaseTransform[5],
                "maxNumElements": 256,
                "maxNumVirtualSources": 1,
                "maxNumTimeSteps": 100,
                "canvasWidth": this.simulationCanvas.width,
                "canvasHeight": this.simulationCanvas.height,
            });

        this.chunkManager = new ChunkManager(
            this.grid,
            this.DOMCanvasElement,
            this.DOMCanvasElementCtx,
            this.simulationCanvas,
            this.simulationKernel,
        );
        this.previousCameraTransform = params.cameraTransform;
    }

    update() {
        if (!params.calculateMaximumIntensity) {
            // Check if the user disabled the maximum intensity plot on this update cycle.
            if (isUpdatedParam("calculateMaximumIntensity")) {
                clearCanvas(this.DOMCanvasElementCtx);
                // Re-render everything when the user re-enables the plot
                this.chunkManager.invalidateAll();
            }
        } else {
            // If any relevant simulation parameter was changed, we clear the canvas 
            // and re-render everything.
            if (isUpdatedParam(
                "tukeyApodizationRatio",
                "virtualSource",
                "transmittedWaveType",
                "centerFrequency",
                "pulseLength",
                "soundSpeed",
                "soundSpeedAssumedTx",
                "gain",
                "probeType",
                "probeNumElements",
                "probeLeft",
                "probeRight",
                "calculateMaximumIntensity",
            )) {
                clearCanvas(this.DOMCanvasElementCtx);
                // Debounced reset because parameters often change in bursts such as 
                // when sliding a slider across many different values.
                this.chunkManager.debouncedReset();
            }

            // If only the camera changed, we can re-use parts of the previous frame 
            // before re-rendering everything (we don't have to clear the canvas).
            else if (isUpdatedParam("cameraTransform")) {
                updateCanvasToNewCameraView(
                    params.cameraTransform,
                    this.previousCameraTransform,
                    this.grid,
                    this.DOMCanvasElementCtx,
                    this.offscreenCanvasCtx,
                );
                this.previousCameraTransform = params.cameraTransform;
                this.chunkManager.invalidateAll();  // Re-render everything
            }

            // Let the chunk manager update the canvas if there are more chunks to 
            // render.
            this.chunkManager.update();
        }
    }
}


const debug = false;
class ChunkManager {
    /*
    ChunkManager splits the canvas into smaller chunks and processes them one by one. 
    It is important to use chunks so that we can do a little bit of work at a time, and
    not block the main thread for too long. JavaScript is single-threaded.
    */

    constructor(
        grid,
        DOMCanvasElement,
        DOMCanvasElementCtx,
        simulationCanvas,
        simulationKernel,
        numChunkUpdatesPerFrame = 1,
    ) {
        this.grid = grid;
        this.DOMCanvasElement = DOMCanvasElement;
        this.DOMCanvasElementCtx = DOMCanvasElementCtx;
        this.simulationCanvas = simulationCanvas;
        this.simulationKernel = simulationKernel;
        this.numChunkUpdatesPerFrame = numChunkUpdatesPerFrame;

        // Track what chunks have been processed and what chunks are yet to be processed.
        this.processed = [];
        this.unprocessed = [];
        for (let y = 0; y < this.DOMCanvasElement.height; y += this.simulationCanvas.height) {
            for (let x = 0; x < this.DOMCanvasElement.width; x += this.simulationCanvas.width) {
                this.unprocessed.push({ x, y });
            }
        }
    }

    reset() {
        /* 
        Reload all parameters and reset the chunk manager. All chunks need to be 
        processed again.
        */
        this.probe = ProbeInfo.fromParams(params);
        [this.elementsX, this.elementsZ] = [Array.from(this.probe.x), Array.from(this.probe.z)];
        this.elementWeights = tukey(this.probe.numElements, params.tukeyApodizationRatio);
        this.virtualSourcesX = [params.virtualSource[0]];
        this.virtualSourcesZ = [params.virtualSource[1]];
        // Math.atan2 is buggy in GPU.js, so we calculate it on the CPU instead.
        this.virtualSourcesAzimuths = [
            Math.atan2(
                this.virtualSourcesX[0] - this.probe.center[0],
                this.virtualSourcesZ[0] - this.probe.center[1]
            ) + Math.PI / 2
        ];

        [this.waveOriginX, this.waveOriginZ] = this.probe.center;
        // Ensure correct size of arrays
        while (this.elementsX.length < this.simulationKernel.constants.maxNumElements) {
            this.elementsX.push(0);
            this.elementsZ.push(0);
            this.elementWeights.push(0);
        }
        while (this.virtualSourcesX.length < this.simulationKernel.constants.maxNumVirtualSources) {
            this.virtualSourcesX.push(0);
            this.virtualSourcesZ.push(0);
            this.virtualSourcesAzimuths.push(0);
        }

        this.invalidateAll();
    }

    _debouncedReset = debounce(this.reset, 200);
    debouncedReset() {
        /*
        Same as reset, but debounced. This will only actually reset the chunk manager 
        when the user stops updating parameters for 200 milliseconds.
        */
        this.stopProcessing();
        this._debouncedReset();
    }

    update() {
        for (let i = 0; i < this.numChunkUpdatesPerFrame; i++) {
            const chunk = this.nextChunk()
            // Return early if there are no more chunks to process
            if (!chunk) return

            if (!debug) {
                // Simulate the values for each pixel in the chunk.
                this.simulationKernel(
                    ...params.cameraTransform, chunk.x, chunk.y,
                    this.elementsX, this.elementsZ, this.elementWeights, params.probeNumElements,
                    this.waveOriginX, this.waveOriginZ, params.transmittedWaveType,
                    this.virtualSourcesX, this.virtualSourcesZ, this.virtualSourcesAzimuths, this.virtualSourcesX.length,
                    params.centerFrequency, params.pulseLength,
                    params.soundSpeed, params.soundSpeedAssumedTx,
                    params.gain
                );
                // Render the chunk
                this.DOMCanvasElementCtx.clearRect(chunk.x, chunk.y, this.simulationCanvas.width, this.simulationCanvas.height);
                this.DOMCanvasElementCtx.drawImage(this.simulationCanvas, chunk.x, chunk.y);
            } else {
                this.DOMCanvasElementCtx.beginPath();
                this.DOMCanvasElementCtx.fillStyle = getRandomColor();
                this.DOMCanvasElementCtx.rect(chunk.x, chunk.y, this.simulationCanvas.width, this.simulationCanvas.height);
                this.DOMCanvasElementCtx.fill();
            }
        }
    }

    nextChunk() {
        /*
        Get the next unprocessed chunk, or null if all chunks have been processed.
        */
        if (this.unprocessed.length === 0) return null;
        const chunk = this.unprocessed.shift();
        this.processed.push(chunk);
        return chunk
    }

    invalidateAll() {
        /* 
        Make all chunks unprocessed
        */
        this.unprocessed = this.unprocessed.concat(this.processed);
        this.processed = [];
    }

    stopProcessing() {
        /* 
        Make all chunks "processed", meaning that they won't be processed in the future.
        Can be used to disable the chunk manager temporarily.
        */
        this.processed = this.processed.concat(this.unprocessed);
        this.unprocessed = [];
    }
}


function getRandomColor() {
    // Generate random values for red, green, and blue components
    const red = Math.floor(Math.random() * 256); // Random integer between 0 and 255
    const green = Math.floor(Math.random() * 256);
    const blue = Math.floor(Math.random() * 256);

    // Construct the color string in hexadecimal format
    const color = '#' + red.toString(16).padStart(2, '0') + green.toString(16).padStart(2, '0') + blue.toString(16).padStart(2, '0');

    return color;
}