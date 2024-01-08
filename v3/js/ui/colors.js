export const Colors = {
    // Theme colors
    lightPink: "#FFC2D5",
    pink: "#FF195E",
    cyan: "#00F0FF",
    blue: "#0085FF",
    darkBlue: "#1D5199",

    // Other colors
    black: "#000000",
    white: "#FFFFFF",


    hexToRGB: (hex, alpha) => {
        var r = parseInt(hex.slice(1, 3), 16),
            g = parseInt(hex.slice(3, 5), 16),
            b = parseInt(hex.slice(5, 7), 16);

        if (alpha) {
            return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
        } else {
            return "rgb(" + r + ", " + g + ", " + b + ")";
        }
    }
}

Colors.probe = Colors.cyan;
Colors.probeElements = Colors.darkBlue;
Colors.probeElementsOutline = Colors.cyan;
Colors.background = Colors.darkBlue;
Colors.scanArea = Colors.white;
Colors.virtualSource = Colors.pink;
Colors.samplePoint = Colors.blue;
Colors.defaultPoint = Colors.black;
Colors.sonifiedArea = Colors.hexToRGB(Colors.cyan, 0.3);
Colors.sonifiedVirtualCircle = Colors.pink;
Colors.insonifiedVirtualCircle = Colors.hexToRGB(Colors.lightPink, 0.5);
Colors.grid = Colors.hexToRGB(Colors.black, 0.1);
Colors.timelineSamples = Colors.darkBlue;
Colors.timelineTimeMarker = Colors.pink;
