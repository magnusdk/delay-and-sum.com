/* 
Render the maximum pressure plot. Work-in-progress!
You can enable it by setting calculateMaximumIntensity=true in the URL.


Optimizations:
[ ] Render at lower resolution first
[x] Render smaller chunks at a time to avoid freezing the UI for too long
[ ] Only take max over time steps where there is actual energy present
[ ] Debounce updating so that the user can freely change parameters without the browser 
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

import { debounce } from "/v3/js/util.js"
import { invertScaleTranslationTransform, transformVector, matrixMatrixMultiply } from "/v3/js/linalg.js";
import { isUpdatedParam, params } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { tukey } from "/v3/js/simulation/apodization.js";
import { dist, divergingWaveDistance, focusedWaveDistance, getPosition, planeWaveDistance, postProcesspixel, pressureFieldAtPoint, pulse } from "/v3/js/simulation/common.js";

function maximumIntensityKernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    startX, startZ,
    elementsX, elementsZ, elementWeights, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain, displayMode,
) {
    const t = 0;
    const {
        constants: { maxNumElements, maxNumVirtualSources, numTimeSteps } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5,
        this.thread.x + startX, this.thread.y - startZ);
    let maxIntensity = 0;
    let minDistance = Infinity;
    let maxDistance = -Infinity;
    for (let i = 0; i < maxNumVirtualSources; i++) {
        if (i >= numVirtualSources) break;
        const virtualSourceX = virtualSourcesX[i];
        const virtualSourceZ = virtualSourcesZ[i];
        const virtualSourceAzimuth = virtualSourcesAzimuths[i];
        for (let j = 0; j < maxNumElements; j++) {
            if (j >= numElements) break;
            const elX = elementsX[j];
            const elZ = elementsZ[j];

            let t0 = 0;
            if (transmittedWaveType == 0) {
                t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 1) {
                t0 = planeWaveDistance(virtualSourceAzimuth, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 2) {
                t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            }

            const delay = dist(x - elX, z - elZ) / soundSpeed - t0;
            minDistance = Math.min(minDistance, delay);
            maxDistance = Math.max(maxDistance, delay);
        }
    }


    const startTime = minDistance - (pulseLength * 0.75) / f;
    const endTime = maxDistance + (pulseLength * 0.75) / f;

    for (let i = 0; i < numTimeSteps; i++) {
        const t = startTime + (endTime - startTime) * i / numTimeSteps;
        let real = 0;
        let imag = 0;
        for (let i = 0; i < maxNumVirtualSources; i++) {
            if (i >= numVirtualSources) break;
            const virtualSourceX = virtualSourcesX[i];
            const virtualSourceZ = virtualSourcesZ[i];
            const virtualSourceAzimuth = virtualSourcesAzimuths[i];
            for (let j = 0; j < maxNumElements; j++) {
                if (j >= numElements) break;
                const elX = elementsX[j];
                const elZ = elementsZ[j];
                const elWeight = elementWeights[j];

                let t0 = 0;
                if (transmittedWaveType == 0) {
                    t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                } else if (transmittedWaveType == 1) {
                    t0 = planeWaveDistance(virtualSourceAzimuth, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                } else if (transmittedWaveType == 2) {
                    t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                }

                const phase = (dist(x - elX, z - elZ) / soundSpeed - (t + t0)) * f;
                const [real1, imag1] = pulse(phase, pulseLength);
                real += real1 * elWeight;
                imag += imag1 * elWeight;
            }
        }
        // Normalize wrt number of elements. Multiplying by 50 is completely arbitrary.
        real = real / numElements * 50;
        imag = imag / numElements * 50;
        const intensity = real ** 2 + imag ** 2;
        maxIntensity = Math.max(maxIntensity, intensity);
        //maxIntensity += intensity;
    }
    this.color(1, 0.8, 0, maxIntensity / 10 * 10 ** (gain / 20));
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
                "numTimeSteps": 100,
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
        this.oldCameraTransform = params.cameraTransform;
    }

    update() {
        if (!params.calculateMaximumIntensity) {
            this.DOMCanvasElementCtx.clearRect(
                0, 0, this.DOMCanvasElement.width, this.DOMCanvasElement.height
            );
            this.chunkManager.invalidateAll();
        } else {
            if (isUpdatedParam("cameraTransform")) {
                // Get the change in camera position and scale
                const deltaTransform = matrixMatrixMultiply(
                    invertScaleTranslationTransform(
                        matrixMatrixMultiply(
                            params.cameraTransform,
                            this.grid.inverseBaseTransform,
                        )),
                    matrixMatrixMultiply(
                        this.oldCameraTransform,
                        this.grid.inverseBaseTransform,
                    ));

                // Temporarily draw the current frame to the offscreen canvas
                this.offscreenCanvasCtx.clearRect(
                    0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height
                );
                this.offscreenCanvasCtx.drawImage(this.DOMCanvasElement, 0, 0);

                // Draw the offscreen canvas back to the main canvas, translated and 
                // scaled according to the deltaTransform.
                this.DOMCanvasElementCtx.clearRect(
                    0, 0, this.DOMCanvasElement.width, this.DOMCanvasElement.height
                );
                const dx = deltaTransform[4]
                const dy = deltaTransform[5]
                const dsx = deltaTransform[0] * this.offscreenCanvas.width
                const dsy = deltaTransform[3] * this.offscreenCanvas.height
                this.DOMCanvasElementCtx.drawImage(this.offscreenCanvas, dx, dy, dsx, dsy);

                // Update oldCameraTransform
                this.oldCameraTransform = params.cameraTransform;
                this.chunkManager.invalidateAll();
            }
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
            )) {
                this.chunkManager.reset();
            }
            this.chunkManager.update();
        }
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
}

class ChunkGrid {
    constructor(grid, width, height, chunkWidth, chunkHeight) {
        this.grid = grid;
        this.width = width;
        this.height = height;
        this.chunkWidth = chunkWidth;
        this.chunkHeight = chunkHeight;

        this.processed = [];
        this.unprocessed = [];
        for (let y = 0; y < height; y += chunkHeight) {
            for (let x = 0; x < width; x += chunkWidth) {
                this.unprocessed.push({ x, y });
            }
        }
    }

    nextChunk() {
        if (this.unprocessed.length !== 0) {
            const chunk = this.unprocessed.shift();
            this.processed.push(chunk);
            return [chunk.x, chunk.y];
        }
    }

    invalidateAll() {
        this.unprocessed = this.unprocessed.concat(this.processed);
        this.processed = [];
    }
}

const debug = false;
class ChunkManager {
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

        this.chunks = new ChunkGrid(
            this.grid,
            this.DOMCanvasElement.width,
            this.DOMCanvasElement.height,
            this.simulationCanvas.width,
            this.simulationCanvas.height,
        );
        this.reset();
    }

    reset() {
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

        this.chunks.invalidateAll();
        this.DOMCanvasElementCtx.clearRect(0, 0, this.DOMCanvasElement.width, this.DOMCanvasElement.height);
    }

    update() {
        //console.log(this.chunks.unprocessed.length);
        for (let i = 0; i < this.numChunkUpdatesPerFrame; i++) {
            const chunk = this.chunks.nextChunk();
            if (!chunk) return
            if (chunk) {
                if (!debug) {
                    this.simulationKernel(
                        ...params.cameraTransform, ...chunk,
                        this.elementsX, this.elementsZ, this.elementWeights, params.probeNumElements,
                        this.waveOriginX, this.waveOriginZ, params.transmittedWaveType,
                        this.virtualSourcesX, this.virtualSourcesZ, this.virtualSourcesAzimuths, this.virtualSourcesX.length,
                        params.centerFrequency, params.pulseLength,
                        params.soundSpeed, params.soundSpeedAssumedTx,
                        params.gain, params.displayMode,
                    );
                    this.DOMCanvasElementCtx.clearRect(...chunk, this.simulationCanvas.width, this.simulationCanvas.height);
                    this.DOMCanvasElementCtx.drawImage(this.simulationCanvas, ...chunk);
                } else {
                    this.DOMCanvasElementCtx.beginPath();
                    this.DOMCanvasElementCtx.fillStyle = getRandomColor();
                    this.DOMCanvasElementCtx.rect(...chunk, this.simulationCanvas.width, this.simulationCanvas.height);
                    this.DOMCanvasElementCtx.fill();
                }
            }
        }
    }

    invalidateAll() {
        this.chunks.invalidateAll();
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