varying vec2 v_uv;
uniform sampler2D t_simulatedField;
uniform int u_textureWidth;
uniform float u_timelineGain;

#include <common>

vec2 getSample(int offsetXPixels) {
    float offsetX = float(offsetXPixels) / float(u_textureWidth);
    vec2 coord = vec2(v_uv.x / 2.0 + 0.5 - offsetX, 0.0);
    vec2 value = unpackVec4ToVec2(texture2D(t_simulatedField, coord));
    return value * u_timelineGain;
}

void main() {
    float lineThickness = 0.05;
    int nAdjacentSamples = 100;
    float d = 1e12;  // Initialized as a really large number

    // Calculate SDF for adjacent samples as well to get a smooth curve that is not 
    // thinner at regions where it changes a lot. It should have constant width
    vec2 a = vec2(-float(nAdjacentSamples) / float(nAdjacentSamples), getSample(-nAdjacentSamples).x);
    for(int k = -nAdjacentSamples + 1; k <= nAdjacentSamples; k++) {
        vec2 b = vec2(float(k) / float(nAdjacentSamples), getSample(k).x);
        vec2 p = vec2(0, v_uv.y);
        d = min(d, lineSDF(p, a, b));
        a = b;
    }
    gl_FragColor = vec4(mix(DARK_BLUE, WHITE, smoothstep(0.0, lineThickness, d)), 1);
}