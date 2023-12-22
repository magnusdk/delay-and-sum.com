export class Point {
    constructor(x, y, callback, active = true) {
        this.x = x;
        this.y = y;
        this.callback = callback;
        this.active = active
    }
}

export class PointManager {
    constructor(canvas, points) {
        this.canvas = canvas;
        this.points = points;
        this.selectedPoint = null;

        // Add event listeners for mouse and touch events
        canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
        canvas.addEventListener("touchstart", this.handleTouchStart.bind(this));
        canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
        canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
        canvas.addEventListener("mouseup", this.stopDragging.bind(this));
        canvas.addEventListener("touchend", this.stopDragging.bind(this));
        // We also want to stop dragging if mouse is released outside of canvas
        document.addEventListener("mouseup", this.stopDragging.bind(this));
        document.addEventListener("touchend", this.stopDragging.bind(this));
    }

    getMouseCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.offsetX / rect.width;
        const y = 1 - event.offsetY / rect.height;
        return [x, y];
    }

    getTouchCoords(event) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.touches[0];
        const x = (touch.clientX - rect.left) / rect.width;
        const y = (touch.clientY - rect.top) / rect.height;
        return [x, y];
    }

    closestPoint(x, y) {
        const distances = this.points.map(
            (point) => {
                if (!point.active) {
                    return Infinity;
                }
                return Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2))
            }
        );
        const closestPointIndex = distances.indexOf(Math.min(...distances));
        return this.points[closestPointIndex];
    }

    startDragging(x, y) {
        this.selectedPoint = this.closestPoint(x, y);
        this.selectedPoint.x = x;
        this.selectedPoint.y = y;
        this.selectedPoint.callback(this.selectedPoint);
    }

    drag(x, y) {
        this.selectedPoint.x = x;
        this.selectedPoint.y = y;
        this.selectedPoint.callback(this.selectedPoint);
    }

    stopDragging() {
        this.selectedPoint = null;
    }

    // Event handlers
    handleMouseDown(event) {
        const [x, y] = this.getMouseCoords(event);
        this.startDragging(x, y);
    }

    handleTouchStart(event) {
        event.preventDefault();
        const [x, y] = this.getMouseCoords(event);
        this.startDragging(x, y);
    }

    handleMouseMove(event) {
        const [x, y] = this.getMouseCoords(event);
        if (this.selectedPoint) {
            this.drag(x, y);
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        const [x, y] = this.getMouseCoords(event);
        if (this.selectedPoint) {
            this.drag(x, y);
        }
    }
}