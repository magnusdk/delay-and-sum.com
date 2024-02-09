export function matrixMatrixMultiply(m1, m2, ...rest) {
    if (rest.length > 0) {
        return matrixMatrixMultiply(matrixMatrixMultiply(m1, m2), ...rest);
    } else {
        return [
            m1[0] * m2[0] + m1[2] * m2[1],
            m1[1] * m2[0] + m1[3] * m2[1],
            m1[0] * m2[2] + m1[2] * m2[3],
            m1[1] * m2[2] + m1[3] * m2[3],
            m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
            m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
        ];
    }
}

export function invertScaleTranslationTransform(m) {
    return [
        1 / m[0], 0,
        0, 1 / m[3],
        -m[4] / m[0], -m[5] / m[3],
    ];
}

export function transformVector(x, z, ...transformations) {
    if (transformations.length === 0) return [x, z];  // Base case — return as-is
    const [t, ...rest] = transformations;
    const transformed = [
        t[0] * x + t[2] * z + t[4],
        t[1] * x + t[3] * z + t[5],
    ];
    return transformVector(...transformed, ...rest);
}

export function determinant(m) {
    return m[0] * m[3] - m[1] * m[2];
}

export function scalingFactor(m) {
    return determinant(m) ** 0.5;
}

export function getScaleMatrix(scale, anchorX, anchorZ) {
    return matrixMatrixMultiply(
        [1, 0, 0, 1, anchorX, anchorZ],
        [scale, 0, 0, scale, 0, 0],
        [1, 0, 0, 1, -anchorX, -anchorZ]
    );
}