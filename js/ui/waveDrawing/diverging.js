import { Colors } from "/js/ui/colors.js";


export function drawDivergingWave(ctx, grid, probe, virtualSource, time, soundSpeed) {
    const distance = Math.sqrt(
        (virtualSource[0] - probe.center[0]) ** 2 +
        (virtualSource[1] - probe.center[1]) ** 2
    );
    const angle = Math.atan2(
        virtualSource[1] - probe.center[1],
        virtualSource[0] - probe.center[0],
    );
    const angle180 = angle + Math.PI;
    virtualSource = [
        probe.center[0] + Math.cos(angle180) * distance,
        probe.center[1] + Math.sin(angle180) * distance
    ];


    const delayedDistance = (- Math.sqrt(
        Math.pow(virtualSource[0] - probe.center[0], 2) +
        Math.pow(virtualSource[1] - probe.center[1], 2),
    ) / soundSpeed - time) * soundSpeed;
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
    ctx.beginPath();
    ctx.strokeStyle = Colors.sonifiedVirtualCircle;
    ctx.lineCap = "round";

    let angleLeft = Math.atan2(
        virtualSource[1] - probe.zMin,
        virtualSource[0] - probe.xMin,
    ) - (sign < 0 ? Math.PI : 0);
    let angleRight = Math.atan2(
        virtualSource[1] - probe.zMax,
        virtualSource[0] - probe.xMax,
    ) - (sign < 0 ? Math.PI : 0);
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
    ctx.restore();



    const _offscreenLength = 1;  // This should be enough length to extend past the canvas for very small grids.
    // Line going through center of probe and extending past canvas in both directions
    ctx.save();
    ctx.strokeStyle = Colors.hexToRGB(Colors.insonifiedVirtualCircle, 0.5);
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 10]);
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

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = Colors.virtualSource;
    ctx.lineWidth = 3;
    ctx.arc(...grid.toCanvasCoords(virtualSource[0], virtualSource[1]), 6, 0, 2 * Math.PI);
    ctx.setLineDash([4, 5]);
    ctx.stroke();
    ctx.restore();
}


export function drawInsonifiedAreaDivergingWave(ctx, grid, probe, virtualSource) {
    const distance = Math.sqrt(
        (virtualSource[0] - probe.center[0]) ** 2 +
        (virtualSource[1] - probe.center[1]) ** 2
    );
    const angle = Math.atan2(
        virtualSource[1] - probe.center[1],
        virtualSource[0] - probe.center[0],
    );
    const angle180 = angle + Math.PI;
    virtualSource = [
        probe.center[0] + Math.cos(angle180) * distance,
        probe.center[1] + Math.sin(angle180) * distance
    ];
    const angleLeft = Math.atan2(
        probe.zMin - virtualSource[1],
        probe.xMin - virtualSource[0],
    );
    const angleRight = Math.atan2(
        probe.zMax - virtualSource[1],
        probe.xMax - virtualSource[0],
    );
    const _offscreenLength = 1;  // This should be enough length to extend past the canvas for very small grids.
    ctx.save();
    ctx.fillStyle = Colors.hexToRGB(Colors.sonifiedArea, 0.3);
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(probe.xMin, probe.zMin));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMin + Math.cos(angleLeft) * _offscreenLength,
        probe.zMin + Math.sin(angleLeft) * _offscreenLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(
        probe.xMax + Math.cos(angleRight) * _offscreenLength,
        probe.zMax + Math.sin(angleRight) * _offscreenLength,
    ));
    ctx.lineTo(...grid.toCanvasCoords(probe.xMax, probe.zMax));
    ctx.closePath();
    ctx.fill();

    // Draw line from each corner to virtual source
    ctx.lineWidth = 3;
    ctx.strokeStyle = Colors.hexToRGB(Colors.sonifiedArea, 0.3);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(...grid.toCanvasCoords(probe.xMin, probe.zMin));
    ctx.lineTo(...grid.toCanvasCoords(...virtualSource));
    ctx.moveTo(...grid.toCanvasCoords(probe.xMax, probe.zMax));
    ctx.lineTo(...grid.toCanvasCoords(...virtualSource));
    ctx.stroke();
    ctx.restore();
}