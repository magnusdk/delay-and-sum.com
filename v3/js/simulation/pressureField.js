import { getPosition, postProcesspixel, pressureFieldAtPoint } from "/v3/js/simulation/common.js";

export function mainSimulationkernel(
    cT0, cT1, cT2, cT3, cT4, cT5,
    t,
    elementsX, elementsZ, elementWeights, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
    gain, displayMode,
) {
    const { constants: { maxNumElements, maxNumVirtualSources } } = this;
    const [x, z] = getPosition(cT0, cT1, cT2, cT3, cT4, cT5, this.thread.x, this.thread.y);
    const [real, imag] = pressureFieldAtPoint(
        x, z, t,
        elementsX, elementsZ, elementWeights, numElements,
        waveOriginX, waveOriginZ, transmittedWaveType,
        virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
        f, pulseLength, soundSpeed, soundSpeedAssumedTx, depthDispersionStrength,
        maxNumElements, maxNumVirtualSources,
    );
    postProcesspixel(real, imag, gain, displayMode);
}