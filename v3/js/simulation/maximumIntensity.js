import { dist, divergingWaveDistance, focusedWaveDistance, getPosition, planeWaveDistance, pulse } from "/v3/js/simulation/common.js";

export function maximumIntensityKernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    startX, startZ,
    elementsX, elementsZ, elementWeights, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    gain,
) {
    const {
        constants: { maxNumElements, maxNumVirtualSources, maxNumTimeSteps } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5,
        this.thread.x + startX, this.thread.y - startZ);
    let maxIntensity = 0;
    let minDistance = Infinity;
    let maxDistance = -Infinity;
    for (let i = 0; i < maxNumVirtualSources; i++) {
        if (i >= numVirtualSources) break;
        const virtualSourceX = virtualSourcesX[i];
        const virtualSourceZ = virtualSourcesZ[i];
        const virtualSourceAzimuth = virtualSourcesAzimuths[i];
        for (let j = 0; j < maxNumElements; j++) {
            if (j >= numElements) break;
            const elX = elementsX[j];
            const elZ = elementsZ[j];

            let t0 = 0;
            if (transmittedWaveType == 0) {
                t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 1) {
                t0 = planeWaveDistance(virtualSourceAzimuth, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            } else if (transmittedWaveType == 2) {
                t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
            }

            const delay = dist(x - elX, z - elZ) / soundSpeed - t0;
            minDistance = Math.min(minDistance, delay);
            maxDistance = Math.max(maxDistance, delay);
        }
    }


    const startTime = minDistance - (pulseLength * 0.75) / f;
    const endTime = maxDistance + (pulseLength * 0.75) / f;

    for (let i = 0; i < maxNumTimeSteps; i++) {
        const t = startTime + (endTime - startTime) * i / maxNumTimeSteps;
        let real = 0;
        let imag = 0;
        for (let i = 0; i < maxNumVirtualSources; i++) {
            if (i >= numVirtualSources) break;
            const virtualSourceX = virtualSourcesX[i];
            const virtualSourceZ = virtualSourcesZ[i];
            const virtualSourceAzimuth = virtualSourcesAzimuths[i];
            for (let j = 0; j < maxNumElements; j++) {
                if (j >= numElements) break;
                const elX = elementsX[j];
                const elZ = elementsZ[j];
                const elWeight = elementWeights[j];

                let t0 = 0;
                if (transmittedWaveType == 0) {
                    t0 = focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                } else if (transmittedWaveType == 1) {
                    t0 = planeWaveDistance(virtualSourceAzimuth, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                } else if (transmittedWaveType == 2) {
                    t0 = divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) / soundSpeedAssumedTx;
                }

                const phase = (dist(x - elX, z - elZ) / soundSpeed - (t + t0)) * f;
                const [real1, imag1] = pulse(phase, pulseLength);
                real += real1 * elWeight;
                imag += imag1 * elWeight;
            }
        }
        // Normalize wrt number of elements. Multiplying by 50 is completely arbitrary.
        real = real / numElements * 50;
        imag = imag / numElements * 50;
        const intensity = real ** 2 + imag ** 2;
        maxIntensity = Math.max(maxIntensity, intensity);
        //maxIntensity += intensity;
    }
    this.color(1, 0.8, 0, maxIntensity / 10 * 10 ** (gain / 20));
}