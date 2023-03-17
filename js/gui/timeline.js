export function drawTimeline(canvas, impulseResponse, simulationParams, uiState) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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