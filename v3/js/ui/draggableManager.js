import { params, updateParam } from "/v3/js/params.js";


export class Draggable {
    constructor(paramsName, opts) {
        this.paramsName = paramsName;
        this.opts = opts ? opts : {};
        this.isDragging = false;
        this.startPosition = null;  // Set when startDragging is called
    }

    distance(x, z) {
        const [x2, z2] = this.getPosition();
        return Math.sqrt((x - x2) ** 2 + (z - z2) ** 2);
    }

    startDragging(x, z) {
        this.startPosition = [x, z];
        this.isDragging = true;
    }

    update(x, z) {
        if (this.opts["relative"]) {
            const [dx, dz] = [x - this.startPosition[0], z - this.startPosition[1]];
            const [x1, z1] = this.getPosition();
            updateParam(this.paramsName, [x1 + dx, z1 + dz]);
            this.startPosition = [x, z];
        } else {
            updateParam(this.paramsName, [x, z]);
        }
    }

    stopDragging() {
        this.isDragging = false;
    }

    getPosition() {
        return params[this.paramsName];
    }
}

export class MidPointDraggable {
    constructor(paramsName1, paramsName2, opts) {
        this.paramsName1 = paramsName1;
        this.paramsName2 = paramsName2;
        this.opts = opts ? opts : {};
        this.isDragging = false;
        this.startPosition = null;  // Set when startDragging is called
    }

    distance(x, z) {
        const [xMid, zMid] = this.getPosition();
        return Math.sqrt((x - xMid) ** 2 + (z - zMid) ** 2);
    }

    startDragging(x, z) {
        this.startPosition = [x, z];
        this.isDragging = true;
    }

    update(x, z) {
        const [dx, dz] = [x - this.startPosition[0], z - this.startPosition[1]];
        const [x1, z1] = params[this.paramsName1];
        const [x2, z2] = params[this.paramsName2];
        updateParam(this.paramsName1, [x1 + dx, z1 + dz]);
        updateParam(this.paramsName2, [x2 + dx, z2 + dz]);
        this.startPosition = [x, z];
    }

    stopDragging() {
        this.isDragging = false;
    }

    getPosition() {
        const [x1, z1] = params[this.paramsName1];
        const [x2, z2] = params[this.paramsName2];
        const [xMid, zMid] = [(x1 + x2) / 2, (z1 + z2) / 2];
        return [xMid, zMid];
    }
}

export class DraggableManager {
    constructor() {
        this.draggablePoints = {};
        this.dragging = null;
        this.hovering = null;
    }

    addPoint(name, opts) {
        this.draggablePoints[name] = new Draggable(name, opts);
    }

    addMidPoint(name1, name2, opts) {
        this.draggablePoints[[name1, name2]] = new MidPointDraggable(name1, name2, opts);
    }

    closestPoint(x, z) {
        let closestPoint = null;
        let closestDistance = Infinity;
        for (const [_, draggablePoint] of Object.entries(this.draggablePoints)) {
            if (draggablePoint.opts["disabled"]) continue;

            let closestDraggableDistance = 0.002 * 2 ** -params.gridScale;
            if (draggablePoint.opts["closestDistanceMultiplier"]) {
                closestDraggableDistance *= draggablePoint.opts["closestDistanceMultiplier"];
            }
            const distance = draggablePoint.distance(x, z);
            if (distance < closestDraggableDistance && distance < closestDistance) {
                closestPoint = draggablePoint;
                closestDistance = distance;
            }
        }
        return closestPoint;
    }

    startDragging(x, z) {
        this.dragging = this.closestPoint(x, z);
        if (this.dragging) {
            this.dragging.startDragging(x, z);
        }
        this.hovering = null;
    }

    stopDragging(x, z) {
        if (this.dragging) {
            this.dragging.stopDragging();
        }
        this.dragging = null;
        this.hovering = this.closestPoint(x, z);
    }

    update(x, z) {
        if (this.dragging) {
            this.dragging.update(x, z);
            this.hovering = null;
        } else {
            this.hovering = this.closestPoint(x, z);
        }
    }
}