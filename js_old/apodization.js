export function tukey(x, N, alpha) {
    // https://github.com/scijs/window-function/blob/master/tukey.js
    const anm12 = 0.5 * alpha * (N - 1)

    if (x <= anm12) {
        return 0.5 * (1 + Math.cos(Math.PI * (x / anm12 - 1)))
    } else if (x < (N - 1) * (1 - 0.5 * alpha)) {
        return 1
    } else {
        return 0.5 * (1 + Math.cos(Math.PI * (x / anm12 - 2 / alpha + 1)))
    }
}

export function apodization(x, y, elementX, elementY) {
    /* TODO:
    - Rename to directivityApodization
    - Take direction of the element as an argument
    - Use proper units when calculating frac_el_pitch
    */
    const angle = Math.atan2(y - elementY, x - elementX)
    const fracElPitch = 0.002
    const sinAngle = Math.sin(angle)
    let directivityWeight = 1 - Math.abs(
        Math.cos(angle) *
        Math.sin(Math.PI * fracElPitch * sinAngle) /
        (Math.PI * fracElPitch * sinAngle)
    )
    if (Math.abs(sinAngle) < 0.0001) {
        directivityWeight = 1
    }
    return directivityWeight
}