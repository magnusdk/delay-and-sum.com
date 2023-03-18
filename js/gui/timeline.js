

import { divergingDelayModel, focusedDelayModel, planeDelayModel } from "../wavePropagation.js";

function refocusDelaySamples(simulationParams, uiState) {
    const elementsPosX = simulationParams.get("elementsPosX");
    const elementsPosY = simulationParams.get("elementsPosY");
    const elementsWeight = simulationParams.get("elementsWeight");
    const arrayCenterX = simulationParams.get("arrayCenterX");
    const arrayCenterY = simulationParams.get("arrayCenterY");
    const focusPointX = simulationParams.get("focusPointX");
    const focusPointY = simulationParams.get("focusPointY");
    const waveType = simulationParams.get("waveType");

    const x = simulationParams.get("selectedPointX");
    const y = simulationParams.get("selectedPointY");

    const delays = [];
    for (let i = 0; i < elementsPosX.length; i++) {
        const elementX = elementsPosX[i];
        const elementY = elementsPosY[i];
        let t0 = 0;
        if (waveType === 0) {
            t0 = planeDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY);
        } else if (waveType === 1) {
            t0 = focusedDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY);
        } else if (waveType === 2) {
            t0 = divergingDelayModel(elementX, elementY, arrayCenterX, arrayCenterY, focusPointX, focusPointY);
        }
        const distance = Math.sqrt(Math.pow(x - elementX, 2) + Math.pow(y - elementY, 2));
        delays.push(distance - t0);
    }
    return [delays, elementsWeight];
}


export function drawTimeline(canvas, impulseResponse, simulationParams, uiState) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const [delays, elementsWeight] = refocusDelaySamples(simulationParams, uiState);
    for (let i = 0; i < delays.length; i++) {
        const delay = delays[i];
        const weight = elementsWeight[i];
        const t = delay * canvas.width;

        const lineHalfLength = weight * canvas.height / 10 * 4.5;
        ctx.beginPath();
        ctx.moveTo(t, canvas.height / 2 - lineHalfLength);
        ctx.lineTo(t, canvas.height / 2 + lineHalfLength);
        ctx.lineWidth = 3;
        ctx.strokeStyle = uiState.get("blue");
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // Draw a red line at the current time
    ctx.beginPath();
    ctx.moveTo(simulationParams.get("time") * canvas.width, canvas.height / 10);
    ctx.lineTo(simulationParams.get("time") * canvas.width, canvas.height / 10 * 9);
    ctx.lineWidth = 3;
    ctx.strokeStyle = uiState.get("pink");
    ctx.lineCap = "round";
    ctx.stroke();

    let _simulationParams = simulationParams;
    if (uiState.get("sampleImpulseResponse") == "line") {
        const lineStart = uiState.get("sampleImpulseResponseLineStart");
        const lineEnd = uiState.get("sampleImpulseResponseLineEnd");
        const numSamples = 100;
        const samplesX = [];
        const samplesY = [];
        for (let i = 0; i < numSamples; i++) {
            const t = i / (numSamples - 1);
            const x = lineStart[0] + (lineEnd[0] - lineStart[0]) * t;
            const y = lineStart[1] + (lineEnd[1] - lineStart[1]) * t;
            samplesX.push(x);
            samplesY.push(y);
        }
        _simulationParams = new Map(simulationParams);
        _simulationParams.set("selectedPointX", samplesX);
        _simulationParams.set("selectedPointY", samplesY);
    }
    const impulseResponseSamples = impulseResponse.call(_simulationParams);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    for (let t = 0; t < canvas.width; t++) {
        const value = impulseResponseSamples[t];
        ctx.lineTo(t, canvas.height / 2 - value * canvas.height / 2 * 2);
    }
    ctx.strokeStyle = uiState.get("darkBlue");
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
}