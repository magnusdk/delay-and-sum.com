export const uiState = {
    // Our color palette :)
    salmon: "#FFC2D5",
    pink: "#FF195E",
    cyan: "#00F0FF",
    blue: "#0085FF",
    darkBlue: "#1D5199",

    // Should we redraw the canvases?
    shouldRedraw: true,
    // Are we sampling on a point or across a line?
    sampleImpulseResponse: "point",  // "point" or "line"
    sampleImpulseResponseLineStart: [0.55, 0.2],
    sampleImpulseResponseLineEnd: [0.65, 0.2],
}


export const simulationParams = new Map(
    [
        ["time", 0.81],
        ["arrayCenterX", 0.5],
        ["arrayCenterY", 1.0],
        ["focusPointX", 0.6],
        ["focusPointY", 0.5],
        ["selectedPointX", 0.6],
        ["selectedPointY", 0.2],
        ["waveType", 1],
        ["centerFrequency", 100],
        ["pulseLength", 0.0001],
        ["valueScale", 1],
        ["valueScaleFactor", 60],
        ["apertureWindow", 1], // 0 = no weighting, 1 = Tukey weighting
    ]
);