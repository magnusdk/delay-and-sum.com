import { Colors } from "/js/ui/colors.js";


export function drawPlaneWave(ctx, grid, probe, virtualSource, time, soundSpeed) {
    const angle = Math.atan2(
        virtualSource[1] - probe.center[1],
        virtualSource[0] - probe.center[0],
    );
    const angle90 = angle + Math.PI / 2;
    const _offscreenLength = 1;  // This should be enough length to extend past the canvas for very small grids.
    // Length of probe projected onto the plane wave:
    const projectedLength = Math.abs(
        (probe.xMax - probe.xMin) / 2 * Math.cos(angle90) +
        (probe.zMax - probe.zMin) / 2 * Math.sin(angle90)
    );

    const distance = time * soundSpeed;
    const lineStartPoint = [
        probe.center[0] + Math.cos(angle) * distance,
        probe.center[1] + Math.sin(angle) * distance,
    ];
    ctx.save();
    ctx.lineWidth = grid.toCanvasSize(2e-4);
    ctx.strokeStyle = Colors.insonifiedVirtualCircle;
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(
        lineStartPoint[0] - Math.cos(angle90) * _offscreenLength,
        lineStartPoint[1] - Math.sin(angle90) * _offscreenLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        lineStartPoint[0] + Math.cos(angle90) * _offscreenLength,
        lineStartPoint[1] + Math.sin(angle90) * _offscreenLength,
    ));
    ctx.stroke();

    ctx.strokeStyle = Colors.sonifiedVirtualCircle;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(
        lineStartPoint[0] - Math.cos(angle90) * projectedLength,
        lineStartPoint[1] - Math.sin(angle90) * projectedLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        lineStartPoint[0] + Math.cos(angle90) * projectedLength,
        lineStartPoint[1] + Math.sin(angle90) * projectedLength,
    ));
    ctx.stroke();

    // Line going through center of probe and extending past canvas in both directions
    ctx.save();
    ctx.strokeStyle = Colors.insonifiedVirtualCircle;
    ctx.lineWidth = grid.toCanvasSize(2e-4);
    ctx.setLineDash([grid.toCanvasSize(3e-4), grid.toCanvasSize(5e-4)]);
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(
        probe.center[0] - Math.cos(angle) * _offscreenLength,
        probe.center[1] - Math.sin(angle) * _offscreenLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.center[0] + Math.cos(angle) * _offscreenLength,
        probe.center[1] + Math.sin(angle) * _offscreenLength,
    ));
    ctx.stroke();
    ctx.restore();
}


export function drawSonifiedAreaPlaneWave(ctx, grid, probe, virtualSource) {
    const angle = Math.atan2(
        virtualSource[1] - probe.center[1],
        virtualSource[0] - probe.center[0],
    );
    const _offscreenLength = 1;  // This should be enough length to extend past the canvas for very small grids.

    // Draw area from probe corners with angle
    ctx.save();
    ctx.fillStyle = Colors.sonifiedArea;
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(probe.xMin, probe.zMin));
    ctx.lineTo(...grid.toCanvasCoords(probe.xMax, probe.zMax));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMax + Math.cos(angle) * _offscreenLength,
        probe.zMax + Math.sin(angle) * _offscreenLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angle) * _offscreenLength,
        probe.zMin + Math.sin(angle) * _offscreenLength,
    ));
    ctx.fill();
    ctx.restore();
}