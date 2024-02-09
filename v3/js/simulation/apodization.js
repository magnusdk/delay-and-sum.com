export function tukey(n, r) {
    let window = [];
    for (let i = 1; i < n + 1; i++) {
        const x = i / (n + 1);
        if (x < r / 2) {
            window.push(0.5 * (1 + Math.cos(
                2 * Math.PI / r * (x - r / 2)
            )));
        } else if (x < 1 - r / 2) {
            window.push(1);
        } else {
            window.push(0.5 * (1 + Math.cos(
                2 * Math.PI / r * (x - 1 + r / 2)
            )));
        }
    }
    const mean = window.reduce((a, b) => a + b, 0) / n;
    window = window.map(v => v / mean);  // Normalize such that the mean is n
    return window;
}
