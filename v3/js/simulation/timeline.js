import { dist, pressureFieldAtPoint } from "/v3/js/simulation/common.js";


export function timelinekernel(
    minTime, maxTime,
    samplePointX, samplePointZ,
    elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, elementDirectivityModel, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
    gain, displayMode,
) {
    const {
        thread: { x },
        constants: { canvasWidth, maxNumElements, maxNumVirtualSources }
    } = this;
    const t = x / canvasWidth * (maxTime - minTime) + minTime;
    const [real, imag] = pressureFieldAtPoint(
        samplePointX, samplePointZ, t,
        elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, elementDirectivityModel, numElements,
        waveOriginX, waveOriginZ, transmittedWaveType,
        virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
        f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
        maxNumElements, maxNumVirtualSources,
    );
    const env = dist(real, imag);
    if (displayMode >= 1) {
        // Amplitude or intensity post-processing mode
        if (displayMode == 2) {
            // Intensity post-processing mode
            return env ** 2 * 10 ** (gain / 20);
        } else {
            return env * 10 ** (gain / 20)
        }
    } else {
        return real * 10 ** (gain / 20)
    }
}