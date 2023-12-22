import { params } from "/js/params.js";


export class Grid {
    constructor(canvas) {
        if (params.width != params.height) throw new Error("params.width must equal params.height");
        this.canvas = canvas;
    }

    toCanvasCoords(x, z) {
        const xNorm = (x - params.xMin) / params.width;
        const zNorm = (z - params.zMin) / params.height;
        return [
            xNorm * this.canvas.width,
            zNorm * this.canvas.height
        ];
    }

    fromCanvasCoords(x, z) {
        const xNorm = x / this.canvas.width;
        const zNorm = z / this.canvas.height;
        return [
            xNorm * params.width + params.xMin,
            zNorm * params.height + params.zMin
        ];

    }

    toCanvasSize(h) {
        if (params.width != params.height) throw new Error("params.width must equal params.height");
        return h / params.height * this.canvas.height;
    }
}