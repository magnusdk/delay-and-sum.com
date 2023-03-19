import { apodization, tukey } from "./apodization.js";
import {
    divergingDelayModel,
    focusedDelayModel, gaussianTaperedSine,
    getPressure, planeDelayModel
} from "./wavePropagation.js";


function createPressureFieldKernel(gpu) {
    const kernel = gpu.createKernel(
        function (
            gridExtent,
            time,
            numElements,
            elementsX,
            elementsY,
            elementsWeight,
            arrayCenterX,
            arrayCenterY,
            focusPointX,
            focusPointY,
            waveType, // 0 = plane wave, 1 = focused wave, 2 = diverging wave
            centerFrequency,
            pulseLength,
            valueScale, // 0 = linear, 1 = decibels
            valueScaleFactor, // Scale factor for linear scale, dynamic range for decibels scale
        ) {
            let x = this.thread.x / this.constants.width;
            let y = this.thread.y / this.constants.height;

            // Map x and y to the grid extent
            x = gridExtent[0] + x * (gridExtent[1] - gridExtent[0]);
            y = gridExtent[2] + y * (gridExtent[3] - gridExtent[2]);

            let value = 0;
            for (let i = 0; i < this.constants.maxNumElements; i++) {
                if (i < numElements) {
                    const elementX = elementsX[i];
                    const elementY = elementsY[i];
                    const elementWeight = elementsWeight[i];
                    value += getPressure(
                        time,
                        x,
                        y,
                        elementX,
                        elementY,
                        elementWeight,
                        arrayCenterX,
                        arrayCenterY,
                        focusPointX,
                        focusPointY,
                        waveType,
                        centerFrequency,
                        pulseLength,
                    )
                }
            }
            value /= numElements;

            let negativeValue = -Math.min(value, 0)
            let positiveValue = Math.max(value, 0)
            if (valueScale === 1) {
                negativeValue = (20 * Math.log10(-Math.min(value, 0))) / valueScaleFactor + 1
                positiveValue = (20 * Math.log10(Math.max(value, 0))) / valueScaleFactor + 1
            } else {
                negativeValue *= valueScaleFactor
                positiveValue *= valueScaleFactor
            }

            const pink = [255 / 255, 25 / 255, 94 / 255];
            const blue = [0 / 255, 133 / 255, 255 / 255];
            // lerp such that the color is pink for positive values and blue for negative values
            const rgb = value < 0 ? blue : pink;
            this.color(rgb[0], rgb[1], rgb[2], Math.max(positiveValue, negativeValue))
        })
        .setFunctions([getPressure, focusedDelayModel, planeDelayModel, divergingDelayModel, apodization, tukey, gaussianTaperedSine])
        .setOutput([gpu.canvas.width, gpu.canvas.height])
        .setGraphical(true)
        .setConstants({
            "width": gpu.canvas.width,
            "height": gpu.canvas.height,
            "maxNumElements": 200,
        })
    return kernel
}

export class PressureField {
    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = 500;
        this.canvas.height = 500;
        // Ensure that we can use alpha values in color
        const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: false });
        this.gpu = new GPU({ canvas: this.canvas, webGl: gl });
        this.kernel = createPressureFieldKernel(this.gpu);
    }

    update(params) {
        const elementsPosX = params.get("elementsPosX")
        const elementsPosY = params.get("elementsPosY")
        const elementsWeight = params.get("elementsWeight")
        // Ensure correct size of arrays
        while (elementsPosX.length < this.kernel.constants.maxNumElements) {
            elementsPosX.push(0);
            elementsPosY.push(0);
            elementsWeight.push(0);
        }
        this.kernel(
            params.get("gridExtent"),
            params.get("time"),
            params.get("numElements"),
            elementsPosX,
            elementsPosY,
            elementsWeight,
            params.get("arrayCenterX"),
            params.get("arrayCenterY"),
            params.get("focusPointX"),
            params.get("focusPointY"),
            params.get("waveType"),
            params.get("centerFrequency"),
            params.get("pulseLength"),
            params.get("valueScale"),
            params.get("valueScaleFactor"),
        )
    }
}


function createSinglePointImpulseResponseKernel(gpu, numTimeSamples) {
    const kernel = gpu.createKernel(
        function (x,
            y,
            numElements,
            elementsX,
            elementsY,
            elementsWeight,
            arrayCenterX,
            arrayCenterY,
            focusPointX,
            focusPointY,
            waveType,
            centerFrequency,
            pulseLength,
            valueScale, // 0 = linear, 1 = decibels
            valueScaleFactor, // Scale factor for linear scale, dynamic range for decibels scale
        ) {
            const t = this.thread.x / this.constants.numTimeSamples;
            let value = 0;
            for (let i = 0; i < this.constants.maxNumElements; i++) {
                if (i < numElements) {
                    const elementX = elementsX[i];
                    const elementY = elementsY[i];
                    const elementWeight = elementsWeight[i];
                    value += getPressure(
                        t,
                        x,
                        y,
                        elementX,
                        elementY,
                        elementWeight,
                        arrayCenterX,
                        arrayCenterY,
                        focusPointX,
                        focusPointY,
                        waveType,
                        centerFrequency,
                        pulseLength,
                    )
                }
            }
            value /= numElements;
            // TODO: Does it make sense to have decibels scale of something that can be negative?
            return value;
        })
        .setFunctions([getPressure, focusedDelayModel, planeDelayModel, divergingDelayModel, apodization, tukey, gaussianTaperedSine])
        .setOutput([numTimeSamples])
        .setConstants({
            "maxNumElements": 200,
            "numTimeSamples": numTimeSamples,
        })
    return kernel
}

function createMultiplePointsImpulseResponseKernel(gpu, numTimeSamples) {
    const kernel = gpu.createKernel(
        function (
            xs,
            ys,
            numElements,
            elementsX,
            elementsY,
            elementsWeight,
            arrayCenterX,
            arrayCenterY,
            focusPointX,
            focusPointY,
            waveType,
            centerFrequency,
            pulseLength,
            valueScale, // 0 = linear, 1 = decibels
            valueScaleFactor, // Scale factor for linear scale, dynamic range for decibels scale
        ) {
            const t = this.thread.x / this.constants.numTimeSamples;
            let value = 0;
            for (let i = 0; i < this.constants.maxNumElements; i++) {
                if (i < numElements) {
                    const elementX = elementsX[i];
                    const elementY = elementsY[i];
                    const elementWeight = elementsWeight[i];
                    for (let pointIndex = 0; pointIndex < this.constants.numPoints; pointIndex++) {
                        const x = xs[pointIndex];
                        const y = ys[pointIndex];
                        value += getPressure(
                            t,
                            x,
                            y,
                            elementX,
                            elementY,
                            elementWeight,
                            arrayCenterX,
                            arrayCenterY,
                            focusPointX,
                            focusPointY,
                            waveType,
                            centerFrequency,
                            pulseLength,
                        )
                    }
                }
            }
            value /= (numElements * this.constants.numPoints);
            // TODO: Does it make sense to have decibels scale of something that can be negative?
            return value;
        })
        .setFunctions([getPressure, focusedDelayModel, planeDelayModel, divergingDelayModel, apodization, tukey, gaussianTaperedSine])
        .setOutput([numTimeSamples])
        .setConstants({
            "maxNumElements": 200,
            "numPoints": 100,
            "numTimeSamples": numTimeSamples,
        })
    return kernel
}


export class ImpulseResponse {
    constructor(numTimeSamples) {
        this.numTimeSamples = numTimeSamples;
        this.kernels = new Map();
        this.gpu = new GPU();
        this.pointKernel = createSinglePointImpulseResponseKernel(this.gpu, this.numTimeSamples);
        this.multiplePointsKernel = createMultiplePointsImpulseResponseKernel(this.gpu, this.numTimeSamples);
    }

    call(params) {
        const elementsPosX = params.get("elementsPosX")
        const elementsPosY = params.get("elementsPosY")
        const elementsWeight = params.get("elementsWeight")
        // Ensure correct size of arrays
        while (elementsPosX.length < this.pointKernel.constants.maxNumElements) {
            elementsPosX.push(0);
            elementsPosY.push(0);
            elementsWeight.push(0);
        }
        const selectedPointX = params.get("selectedPointX");
        const selectedPointY = params.get("selectedPointY");
        let kernel;
        if (Array.isArray(selectedPointX)) {
            kernel = this.multiplePointsKernel;
        } else {
            kernel = this.pointKernel;
        }
        return kernel(
            selectedPointX,
            selectedPointY,
            params.get("numElements"),
            elementsPosX,
            elementsPosY,
            elementsWeight,
            params.get("arrayCenterX"),
            params.get("arrayCenterY"),
            params.get("focusPointX"),
            params.get("focusPointY"),
            params.get("waveType"),
            params.get("centerFrequency"),
            params.get("pulseLength"),
            params.get("valueScale"),
            params.get("valueScaleFactor"),
        )
    }
} 