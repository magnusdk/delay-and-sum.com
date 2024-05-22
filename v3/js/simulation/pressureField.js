import { getPosition, postProcesspixel, pressureFieldAtPoint } from "/v3/js/simulation/common.js";

export function mainSimulationkernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    t,
    elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, elementDirectivityModel, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5, this.thread.x, this.thread.y);
    const [real, imag] = pressureFieldAtPoint(
        x, z, t,
        elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, elementDirectivityModel, numElements,
        waveOriginX, waveOriginZ, transmittedWaveType,
        virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
        f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
        maxNumElements, maxNumVirtualSources,
    );
    postProcesspixel(real, imag, gain, displayMode);
}

export function pressureFieldAtPoints(
    xs, zs, t,
    elementsX, elementsZ, elementWeights, elementNormalAzimuths, elementWidths, elementDirectivityModel, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources } } = this;
    const [x, z] = [xs[this.thread.x], zs[this.thread.x]];
    const [real, imag] = pressureFieldAtPoint(
        x, z, t,
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