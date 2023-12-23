import { Colors } from "/js/ui/colors.js";


export function drawFocusedWave(ctx, grid, probe, virtualSource, time, soundSpeed) {
    const distance = Math.sqrt(
        Math.pow(virtualSource[0] - probe.center[0], 2) +
        Math.pow(virtualSource[1] - probe.center[1], 2),
    );
    const angle = Math.atan2(
        virtualSource[1] - probe.center[1],
        virtualSource[0] - probe.center[0],
    );
    const delayedDistance = (distance / soundSpeed - time) * soundSpeed;
    const sign = Math.sign(delayedDistance);
    const radius = Math.abs(delayedDistance);
    const radiusCanvasSpace = grid.toCanvasSize(radius);
    const [x, z] = grid.toCanvasCoords(...virtualSource);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = Colors.hexToRGB(Colors.insonifiedVirtualCircle, 0.5);
    ctx.lineWidth = 3;
    ctx.arc(x, z, radiusCanvasSpace, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = Colors.sonifiedVirtualCircle;
    ctx.lineCap = "round";

    let angleLeft = Math.atan2(
        virtualSource[1] - probe.zMin,
        virtualSource[0] - probe.xMin,
    ) - (sign > 0 ? Math.PI : 0);
    let angleRight = Math.atan2(
        virtualSource[1] - probe.zMax,
        virtualSource[0] - probe.xMax,
    ) - (sign > 0 ? Math.PI : 0);
    // Swap angles if the virtual source is behind the probe
    const side = Math.sign(
        (probe.xMax - probe.xMin) * (virtualSource[1] - probe.zMin) -
        (probe.zMax - probe.zMin) * (virtualSource[0] - probe.xMin),
    );
    if (side > 0) {
        [angleLeft, angleRight] = [angleRight, angleLeft];
    }
    ctx.arc(x, z, radiusCanvasSpace, angleRight, angleLeft);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = Colors.hexToRGB(Colors.insonifiedVirtualCircle, 0.5);
    ctx.lineWidth = 3;
    // dashed line
    ctx.setLineDash([8, 10]);
    const _length = 1;  // This should be enough length to extend past the canvas for very small grids.
    ctx.moveTo(...grid.toCanvasCoords(
        probe.center[0] - Math.cos(angle) * _length,
        probe.center[1] - Math.sin(angle) * _length,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.center[0] + Math.cos(angle) * _length,
        probe.center[1] + Math.sin(angle) * _length,
    ));
    ctx.stroke();

    ctx.restore();
}


export function drawInsonifiedAreaFocusedWave(ctx, grid, probe, virtualSource) {
    ctx.save();
    ctx.fillStyle = Colors.hexToRGB(Colors.sonifiedArea, 0.3);
    const angleLeft = Math.atan2(
        virtualSource[1] - probe.zMin,
        virtualSource[0] - probe.xMin,
    );
    const angleRight = Math.atan2(
        virtualSource[1] - probe.zMax,
        virtualSource[0] - probe.xMax,
    );
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(probe.xMax, probe.zMax));
    ctx.lineTo(...grid.toCanvasCoords(probe.xMin, probe.zMin));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angleLeft) * 1000,
        probe.zMin + Math.sin(angleLeft) * 1000,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angleRight) * 1000,
        probe.zMin + Math.sin(angleRight) * 1000,
    ));
    ctx.fill();

    ctx.restore();
}