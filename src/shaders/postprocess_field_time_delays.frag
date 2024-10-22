varying vec2 v_uv;
uniform float u_minimumDb;
uniform float u_maximumDb;
uniform bool u_useDb;
uniform sampler2D t_maximumAmplitudeValues;
uniform sampler2D t_maximumAmplitudeTimes;
out vec4 outColor;

#include <common>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    vec2 maximumAmplitudeValue = unpackVec4ToVec2(texture2D(t_maximumAmplitudeValues, coord));
    float maximumAmplitudeTime = unpackVec4ToFloat(texture2D(t_maximumAmplitudeTimes, coord));

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