#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_elementsTexture;
uniform int u_nElements;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_soundSpeed;
uniform float u_attenuationFactor;
uniform vec2 u_samplePoint;
uniform float u_samplePointStrength;
uniform float u_minimumTime;
uniform float u_maximumTime;

// 0=probe (sample at element positions), 1=scatterer (sample at sample point)
uniform int u_sampleMode;
// false=raw simulation, true=postprocess for display
uniform bool u_postprocess;

// Postprocess uniforms (used when u_postprocess is true)
uniform sampler2D t_simulatedField;
uniform int u_textureWidth;
uniform float u_timelineGain;
uniform float u_minimumDb;
uniform float u_maximumDb;
uniform bool u_useDb;
// 0=phase, 1=envelope, 2=intensity
uniform int u_displayMode;

out vec4 outColor;

#include "./common.glsl"
#include "./elements.glsl"

vec2 getSample(int offsetXPixels) {
    float offsetX = float(offsetXPixels) / float(u_textureWidth);
    vec2 coord = vec2(v_uv.x / 2.0 + 0.5 - offsetX, 0.0);
    vec2 value = unpackVec4ToVec2(texture(t_simulatedField, coord));
    return value * u_timelineGain;
}

void main() {
    if (!u_postprocess) {
        // Raw simulation pass
        if (u_sampleMode == 0) {
            // Probe mode: y -> element index, x -> time
            int i = int((v_uv.y + 1.0) / 2.0 * float(u_nElements));
            Element element = getElement(i);
            float time = (v_uv.x + 1.0) / 2.0 * (u_maximumTime - u_minimumTime) + u_minimumTime;
            vec2 v = signalForPointScatter1(element.pos, time);
            outColor = packVec2ToVec4(v);
        } else {
            // Scatterer mode: x -> time
            float time = (v_uv.x + 1.0) / 2.0 * (u_maximumTime - u_minimumTime) + u_minimumTime;
            vec2 v = signalForPointScatter0(u_samplePoint, time);
            outColor = packVec2ToVec4(v);
        }
    } else {
        // Postprocess pass
        if (u_sampleMode == 0) {
            // Probe mode: postprocess with displayPhaseKernel
            vec4 previousColor = texture(t_simulatedField, v_uv / 2.0 + vec2(0.5, 0.5));
            outColor = displayPhaseKernel(unpackVec4ToVec2(previousColor), u_displayMode, u_minimumDb, u_maximumDb, u_useDb);
        } else {
            // Scatterer mode: line plot SDF
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
            outColor = vec4(mix(DARK_BLUE, WHITE, smoothstep(0.0, lineThickness, d)), 1);
        }
    }
}
