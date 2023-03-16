import {apodization} from "./apodization.js"

// TODO: Make these actual delay models without REFoCUS STAI stuff

export function focusedDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY) {
    const distanceFromArrayCenter = Math.sqrt(Math.pow(focusPointX - arrayCenterX, 2) + Math.pow(focusPointY - arrayCenterY, 2))
    const distanceFromElement = Math.sqrt(Math.pow(focusPointX - elementX, 2) + Math.pow(focusPointY - elementY, 2))
    return distanceFromElement - distanceFromArrayCenter
}

export function planeDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY) {
    const azimuth = Math.atan2(focusPointY - arrayCenterY, focusPointX - arrayCenterX)
    const [dX, dY] = [elementX - arrayCenterX, elementY - arrayCenterY]
    return (
        dX * Math.sin(azimuth + Math.PI / 2 * Math.sign(azimuth)) +
        dY * Math.cos(azimuth + Math.PI / 2 * Math.sign(azimuth))
    )
}

export function divergingDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY) {
    // Rotate focus point 180 degrees around array center
    const [mirroredFocusPointX, mirroredFocusPointY2] = [
        arrayCenterX - (focusPointX - arrayCenterX),
        arrayCenterY - (focusPointY - arrayCenterY)
    ]
    const distanceFromArrayCenter = Math.sqrt(Math.pow(mirroredFocusPointX - arrayCenterX, 2) + Math.pow(mirroredFocusPointY2 - arrayCenterY, 2))
    const distanceFromElement = Math.sqrt(Math.pow(mirroredFocusPointX - elementX, 2) + Math.pow(mirroredFocusPointY2 - elementY, 2))
    return distanceFromArrayCenter - distanceFromElement
}

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