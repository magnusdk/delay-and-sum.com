import { Colors } from "/js/ui/colors.js";


export function renderXTicks(canvas, grid) {
    const ctx = canvas.getContext("2d");
    ctx.save();

    const numSegments = 5;
    const thickness = 2;
    const segmentWidth = (canvas.width - thickness) / (numSegments);

    // Draw the ticks
    for (let i = 0; i < numSegments; i++) {
        const x = i * segmentWidth + thickness / 2 + segmentWidth / 2;
        const trueX = grid.fromCanvasCoords(x, 0)[0] * 1000;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 5);
        ctx.strokeStyle = Colors.white;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // render some text under the tick
        ctx.font = "12px Arial";
        ctx.fillStyle = Colors.white;
        ctx.textAlign = "center";
        ctx.fillText(trueX.toFixed(2) + " mm", x, canvas.height / 2 + 7);

    }

    ctx.restore();
}


export function renderZTicks(canvas, grid) {
    const ctx = canvas.getContext("2d");
    ctx.save();

    const numSegments = 5;
    const thickness = 2;
    const segmentHeight = (canvas.height - thickness) / (numSegments);

    // Draw the ticks
    for (let i = 0; i < numSegments; i++) {
        const z = i * segmentHeight + thickness / 2 + segmentHeight / 2;
        const trueZ = grid.fromCanvasCoords(0, z)[1] * 1000;
        ctx.beginPath();
        ctx.moveTo(50, z);
        ctx.lineTo(45, z);
        ctx.strokeStyle = Colors.white;
        ctx.lineWidth = thickness;
        ctx.stroke();

        // render some text under the tick
        ctx.font = "12px Arial";
        ctx.fillStyle = Colors.white;
        ctx.textAlign = "center";
        ctx.fillText(trueZ.toFixed(2), 30, z);

    }

    ctx.restore();
}