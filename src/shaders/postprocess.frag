#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D t_simulatedField;
uniform sampler2D t_maximumAmplitudeValues;
uniform sampler2D t_maximumAmplitudeTimes;
uniform float u_minimumDb;
uniform float u_maximumDb;
uniform bool u_useDb;
// 0=phase, 1=envelope, 2=intensity, 3=time-delays
uniform int u_displayMode;

out vec4 outColor;

#include "./common.glsl"

vec4 displayPhaseKernel(vec2 v) {
    float minDecibels = u_minimumDb;
    float maxDecibels = u_maximumDb;
    float amp = length(v);

    if(u_displayMode == 2) {
        amp = pow(amp, 2.0);
    }
    if(u_useDb) {
        amp = dB(amp);
    } else {
        minDecibels = invDB(minDecibels);
        maxDecibels = invDB(maxDecibels);
    }

    float alpha = (amp - minDecibels) / (maxDecibels - minDecibels);
    if(u_displayMode == 0) {
        float real = v.x;
        float positivePressure = real > 0.0 ? 1.0 : 0.0;
        vec3 color = PINK * positivePressure + BLUE * (1.0 - positivePressure);
        return vec4(color, alpha);
    }
    return vec4(0.0, 0.0, 0.0, alpha);
}

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);

    if (u_displayMode <= 2) {
        // Modes 0-2: read from t_simulatedField
        vec4 previousColor = texture(t_simulatedField, coord);
        outColor = displayPhaseKernel(unpackVec4ToVec2(previousColor));
    } else {
        // Mode 3: time-delays
        vec2 maximumAmplitudeValue = unpackVec4ToVec2(texture(t_maximumAmplitudeValues, coord));
        float maximumAmplitudeTime = unpackVec4ToFloat(texture(t_maximumAmplitudeTimes, coord));

        float minDecibels = u_minimumDb;
        float maxDecibels = u_maximumDb;
        float amp = length(maximumAmplitudeValue);

        if(u_useDb) {
            amp = dB(amp);
        } else {
            minDecibels = invDB(minDecibels);
            maxDecibels = invDB(maxDecibels);
        }
        float alpha = min((amp - minDecibels) / (maxDecibels - minDecibels), 1.0);
        float sinPhase = sin(maximumAmplitudeTime * TAU * 4.0) * 0.5 + 0.5;
        vec3 color = vec3(1, 1, 1) * sinPhase;
        outColor = vec4(color, alpha);
    }
}
