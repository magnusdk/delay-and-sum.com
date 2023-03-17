function drawRangeVector(canvas, simulationParams, uiState) {
    // Draw a line from the array center through the focus point and off screen
    // Note: this is incorrect! It should be drawn from the center of the circle arc, originating from the virtual source
    const dy = simulationParams.get("focusPointY") - simulationParams.get("arrayCenterY");
    const dx = simulationParams.get("focusPointX") - simulationParams.get("arrayCenterX");
    const angle = Math.atan2(dy, dx);
    const lineLength = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
    // From the center of the array
    const lineStart = [
        simulationParams.get("arrayCenterX") * canvas.width,
        (1 - simulationParams.get("arrayCenterY")) * canvas.height
    ];
    // Through the focus point with a length such that it goes off screen
    const lineEnd = [
        simulationParams.get("focusPointX") * canvas.width + Math.cos(angle) * lineLength,
        (1 - simulationParams.get("focusPointY")) * canvas.height - Math.sin(angle) * lineLength
    ];

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...lineStart);
    ctx.lineTo(...lineEnd);
    ctx.setLineDash([5, 20]);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = uiState.get("pink");
    ctx.globalAlpha = 0.2;
    ctx.stroke();
    ctx.restore();
}

function drawSelectedPoint(canvas, simulationParams, uiState) {
    const center = [
        simulationParams.get("selectedPointX") * canvas.width,
        (1 - simulationParams.get("selectedPointY")) * canvas.height
    ];

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    ctx.arc(...center, 5, 0, 2 * Math.PI);
    ctx.fillStyle = uiState.get("blue");
    ctx.fill();
    ctx.restore();
}

function drawSelectedLine(canvas, simulationParams, uiState) {
    const lineStart = uiState.get("sampleImpulseResponseLineStart");
    const lineEnd = uiState.get("sampleImpulseResponseLineEnd");

    const ctx = canvas.getContext("2d");
    ctx.save();

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(lineStart[0] * canvas.width, (1 - lineStart[1]) * canvas.height);
    ctx.lineTo(lineEnd[0] * canvas.width, (1 - lineEnd[1]) * canvas.height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = uiState.get("blue");
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.stroke();

    // Draw a circle at each end of the line to indicate handles that can be dragged
    ctx.beginPath();
    ctx.arc(lineStart[0] * canvas.width, (1 - lineStart[1]) * canvas.height, 5, 0, 2 * Math.PI);
    ctx.arc(lineEnd[0] * canvas.width, (1 - lineEnd[1]) * canvas.height, 5, 0, 2 * Math.PI);
    ctx.fillStyle = uiState.get("blue");
    ctx.fill();
    ctx.restore();
}

function drawVirtualSource(canvas, simulationParams, uiState) {
    const center = [
        simulationParams.get("focusPointX") * canvas.width,
        (1 - simulationParams.get("focusPointY")) * canvas.height
    ];

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.arc(...center, 5, 0, 2 * Math.PI);
    ctx.fillStyle = uiState.get("pink");
    ctx.fill();
}

export function drawPressureField(canvas, simulationParams, uiState) {
    drawRangeVector(canvas, simulationParams, uiState);
    if (uiState.get("sampleImpulseResponse") == "point") {
        drawSelectedPoint(canvas, simulationParams, uiState);
    }
    else if (uiState.get("sampleImpulseResponse") == "line") {
        drawSelectedLine(canvas, simulationParams, uiState);
    }
    drawVirtualSource(canvas, simulationParams, uiState);
}