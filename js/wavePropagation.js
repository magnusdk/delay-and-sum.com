import {planeDelayModel, focusedDelayModel, divergingDelayModel} from "./delayModels.js"
import {apodization} from "./apodization.js"

export function gaussianTaperedSine(t, f0, sigma) {
    // TODO: Rename to gaussianTaperedSine
    return Math.sin(t * Math.PI * 2 * f0) * Math.exp(-Math.pow(t, 2) / sigma)
}

export function getPressure(
    time,
    x,
    y,
    elementX,
    elementY,
    elementWeight,
    arrayCenterX,
    arrayCenterY,
    focusPointX,
    focusPointY,
    waveType,
    centerFrequency,
    pulseLength,
) {
    let t0 = 0;
    if (waveType === 0) {
        t0 = planeDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY)
    } else if (waveType === 1) {
        t0 = focusedDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY)
    } else if (waveType === 2) {
        t0 = divergingDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY)
    }
    const distance = Math.sqrt(Math.pow(x - elementX, 2) + Math.pow(y - elementY, 2));
    const delay = distance - time - t0;
    const weight = apodization(x, y, elementX, elementY) * elementWeight
    const pressure = gaussianTaperedSine(delay, centerFrequency, pulseLength)
    return pressure * weight
}