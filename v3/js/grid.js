import { params } from "/v3/js/params.js";


export class Grid {
    constructor(canvasWidth, canvasHeight) {
        if (params.width != params.height) throw new Error("params.width must equal params.height");
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    toCanvasCoords(x, z) {
        const xNorm = (x - params.xMin) / params.width;
        const zNorm = (z - params.zMin) / params.height;
        return [
            xNorm * this.canvasWidth,
            zNorm * this.canvasHeight
        ];
    }

    fromCanvasCoords(x, z) {
        const xNorm = x / this.canvasWidth;
        const zNorm = z / this.canvasHeight;
        return [
            xNorm * params.width + params.xMin,
            zNorm * params.height + params.zMin
        ];

    }

    toCanvasSize(h) {
        if (params.width != params.height) throw new Error("params.width must equal params.height");
        return h / params.height * this.canvasHeight;
    }
}