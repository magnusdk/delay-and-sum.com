import { params } from "/js/params.js";
// import { renderXTicks, renderZTicks } from "/js/ui/ticks.js";


export class LinearProbe {
    loadParams() {
        // Assert that the probe type is linear
        if (params.probeType !== "linear") throw new Error("params.probeType must be 'linear'");

        this.numElements = params.probeNumElements;
        this.probeLeft = params.probeLeft;
        this.probeRight = params.probeRight;
        this.xMin = this.probeLeft[0];
        this.xMax = this.probeRight[0];
        this.zMin = this.probeLeft[1];
        this.zMax = this.probeRight[1];
        this.length = Math.sqrt((this.xMax - this.xMin) ** 2 + (this.zMax - this.zMin) ** 2);
        this.center = [(this.xMin + this.xMax) / 2, (this.zMin + this.zMax) / 2];

        // Calculate the positions of the probe elements
        this.z = [];
        this.x = [];
        if (this.numElements === 1) {
            this.x.push((this.xMin + this.xMax) / 2);
            this.z.push((this.zMin + this.zMax) / 2);
        } else {
            const dx = (this.xMax - this.xMin) / (this.numElements - 1);
            const dz = (this.zMax - this.zMin) / (this.numElements - 1);
            for (let i = 0; i < this.numElements; i++) {
                this.x.push(this.xMin + i * dx);
                this.z.push(this.zMin + i * dz);
            }
        }
    }
}
