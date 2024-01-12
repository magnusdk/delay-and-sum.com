import { params } from "/v3/js/params.js";


export class Grid {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.update();
    }

    update() {
        this.xMin = params.xMin * 2**-params.gridScale;
        this.xMax = params.xMax * 2**-params.gridScale;
        this.zMin = params.zMin * 2**-params.gridScale;
        this.zMax = params.zMax * 2**-params.gridScale;
        this.width = this.xMax - this.xMin;
        this.height = this.zMax - this.zMin;
        if (Math.abs(this.width - this.height) > 1e-10)
            throw new Error("width must equal height");
    }

    toCanvasCoords(x, z) {
        const xNorm = (x - this.xMin) / this.width;
        const zNorm = (z - this.zMin) / this.height;
        return [
            xNorm * this.canvasWidth,
            zNorm * this.canvasHeight
        ];
    }

    fromCanvasCoords(x, z) {
        const xNorm = x / this.canvasWidth;
        const zNorm = z / this.canvasHeight;
        return [
            xNorm * this.width + this.xMin,
            zNorm * this.height + this.zMin
        ];

    }

    toCanvasSize(h) {
        if (Math.abs(this.width - this.height) > 1e-10)
            throw new Error("width must equal height");
        return h / this.height * this.canvasHeight;
    }
}