import { params } from "/v3/js/params.js";
import { invertScaleTranslationTransform, transformVector, scalingFactor } from "/v3/js/util.js";

export class Grid {
    constructor(canvas) {
        this.canvas = canvas;
        this.pixelsPerMeter = 1000;

        // baseTransform transforms from grid coordinates to canvas coordinates.
        this.baseTransform = [
            this.pixelsPerMeter, 0,
            0, this.pixelsPerMeter,
            canvas.width / 2, 0
        ];
        // inverseBaseTransform transforms from canvas coordinates to grid coordinates.
        this.inverseBaseTransform = invertScaleTranslationTransform(this.baseTransform);
    }

    toCanvasCoords(x, z) {
        return transformVector(x, z, invertScaleTranslationTransform(params.cameraTransform), this.baseTransform);
    }

    fromCanvasCoords(x, z) {
        return transformVector(x, z, this.inverseBaseTransform, params.cameraTransform);
    }

    toCanvasSize(h) {
        return h / scalingFactor(params.cameraTransform) * this.pixelsPerMeter;
    }
}