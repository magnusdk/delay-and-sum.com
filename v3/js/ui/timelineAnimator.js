import { params, updateParam } from "/v3/js/params.js";
import { getMaxTime, getMinTime } from "/v3/js/util.js";


export class TimelineAnimator {
    constructor(grid) {
        this.grid = grid
        this.animateTimelineSign = 1;
    }

    update() {
        const minTime = getMinTime();
        const maxTime = getMaxTime(this.grid);
        if (params.time <= minTime || params.time >= maxTime) {
            params.time = Math.min(Math.max(params.time, minTime), maxTime);
            this.animateTimelineSign *= -1;
        }
        updateParam("time", params.time + this.animateTimelineSign * params.animateTimelineSpeed, true);
    }
}