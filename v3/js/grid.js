import { invertScaleTranslationTransform, scalingFactor, transformVector } from "/v3/js/linalg.js";
import { params } from "/v3/js/params.js";

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

export function getCanvasPointFromMouseEvent(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY
    ];
}

export function getCanvasPointFromTouchEvent(canvasElement, touchEvent) {
    const rect = canvasElement.getBoundingClientRect();
    const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
    const scaleX = canvasElement.width / rect.width;
    const scaleY = canvasElement.height / rect.height;
    return [
        (touch.clientX - rect.left) * scaleX,
        (touch.clientY - rect.top) * scaleY,
    ]
}