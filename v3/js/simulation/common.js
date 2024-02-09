import { matrixMatrixMultiply, invertScaleTranslationTransform, transformVector, determinant, scalingFactor, getScaleMatrix } from "/v3/js/linalg.js";

export function dist(x, z) {
    return Math.sqrt(x ** 2 + z ** 2);
}

export function focusedWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    const originToVirtualSourceDist = dist(virtualSourceX - waveOriginX, virtualSourceZ - waveOriginZ);
    const elToVirtualSourceDist = dist(virtualSourceX - elX, virtualSourceZ - elZ);
    return elToVirtualSourceDist - originToVirtualSourceDist
}

export function planeWaveDistance(azimuth, waveOriginX, waveOriginZ, elX, elZ) {
    const [dX, dY] = [elX - waveOriginX, elZ - waveOriginZ]
    return (
        dX * Math.sin(azimuth + Math.PI / 2) +
        dY * Math.cos(azimuth + Math.PI / 2)
    )
}

export function divergingWaveDistance(virtualSourceX, virtualSourceZ, waveOriginX, waveOriginZ, elX, elZ) {
    // Reflect the virtual source across the wave origin
    const dx = waveOriginX - (virtualSourceX - waveOriginX)
    const dz = waveOriginZ - (virtualSourceZ - waveOriginZ)
    // Flip the sign of the distance to make it be behind the probe
    return -focusedWaveDistance(dx, dz, waveOriginX, waveOriginZ, elX, elZ)
}

export function getPosition(cT0, cT1, cT2, cT3, cT4, cT5, xIndex, zIndex) {
    const {
        constants: { canvasHeight, ibT0, ibT1, ibT2, ibT3, ibT4, ibT5 }
    } = this;
    let y = canvasHeight - zIndex;  // Invert y-axis
    let x = ibT0 * xIndex + ibT2 * y + ibT4;
    y = ibT1 * x + ibT3 * y + ibT5;
    x = x * cT0 + y * cT2 + cT4;
    y = x * cT1 + y * cT3 + cT5;
    return [x, y];
}

export function postProcesspixel(real, imag, gain, displayMode) {
    // Color selection. Correspond to pink for positive phase, blue for 
    // negative phase (following palette in /v3/js/ui/colors.js).
    const pinkR = 1;
    const pinkG = 0.09803921568627451;
    const pinkB = 0.3686274509803922;
    const blueR = 0;
    const blueG = 0.5215686274509804;
    const blueB = 1;

    const env = dist(real, imag);
    if (displayMode >= 1) {
        // Amplitude or intensity post-processing mode
        if (displayMode == 2) {
            // Intensity post-processing mode
            env = env ** 2;
        }
        // TODO: Use defined color palette
        this.color(0, 0, 0, env * 10 ** (gain / 20));
    } else if (displayMode == -1) {
        // Hide post-processing mode
        this.color(0, 0, 0, 0);
    } else {
        this.color(
            real > 0 ? pinkR : blueR,
            real > 0 ? pinkG : blueG,
            real > 0 ? pinkB : blueB,
            env * 10 ** (gain / 20),
        );
    }
}


export function pulse(phase, pulseLength) {
    const gauss = Math.exp(-Math.pow(phase / pulseLength * 2, 2));
    const real = Math.sin(phase * Math.PI * 2) * gauss;
    const imag = Math.cos(phase * Math.PI * 2) * gauss;
    return [real, imag];
}


export function pressureFieldAtPoint(
    x, z, t,
    elementsX, elementsZ, elementWeights, numElements,
    waveOriginX, waveOriginZ, transmittedWaveType,
    virtualSourcesX, virtualSourcesZ, virtualSourcesAzimuths, numVirtualSources,
    f, pulseLength, soundSpeed, soundSpeedAssumedTx,
    maxNumElements, maxNumVirtualSources,
) {
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
    return [real, imag];
}



export const allFunctions = [
    dist,
    focusedWaveDistance,
    planeWaveDistance,
    divergingWaveDistance,
    getPosition,
    postProcesspixel,
    pulse,
    pressureFieldAtPoint,
    matrixMatrixMultiply,
    invertScaleTranslationTransform,
    transformVector,
    determinant,
    scalingFactor,
    getScaleMatrix,
];