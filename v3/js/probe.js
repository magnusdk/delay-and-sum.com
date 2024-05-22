export class ProbeInfo {
    constructor(probeType, probeNumElements, probeLeft, probeRight) {
        // Only linear probes are supported for now
        if (probeType !== "linear") throw new Error("probeType must be 'linear'");

        this.numElements = probeNumElements;
        this.probeLeft = probeLeft;
        this.probeRight = probeRight;
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

        // Assuming linear probe
        const probeNormalAzimuth = Math.atan2(probeLeft[0] - probeRight[0], probeLeft[1] - probeRight[1]);
        this.elementNormalAzimuths = [];
        for (let i = 0; i < this.numElements; i++) {
            this.elementNormalAzimuths.push(probeNormalAzimuth);
        }

        const elementWidth = this.length / (this.numElements - (this.numElements > 1));
        this.elementWidths = [];
        for (let i = 0; i < this.numElements; i++) {
            this.elementWidths.push(elementWidth);
        }
    }
    }

    // statismethod for creating it from params
    static fromParams(params) {
        return new ProbeInfo(
            params.probeType,
            params.probeNumElements,
            params.probeLeft,
            params.probeRight,
        );
    }
}

