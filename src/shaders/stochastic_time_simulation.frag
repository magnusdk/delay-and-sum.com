varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform mat3 u_cameraMatrix;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_soundSpeed;
uniform float u_attenuationFactor;
uniform float u_seed;
uniform sampler2D t_maximumAmplitudeValues;
uniform sampler2D t_maximumAmplitudeTimes;

layout(location = 0) out vec4 outValue;
layout(location = 1) out vec4 outTime;

#include <simulation>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    vec2 maximumAmplitudeValue = unpackVec4ToVec2(texture2D(t_maximumAmplitudeValues, coord));
    vec4 maximumAmplitudeTime = texture2D(t_maximumAmplitudeTimes, coord);

    vec2 pointPos = (vec3(v_uv, 1.0) * u_cameraMatrix).xy;
    int elementIndex = int(rand(u_seed, v_uv + vec2(10, 10)) * float(u_nElements));
    Element element = getElement(elementIndex);

    float time = distance(pointPos, element.pos) / u_soundSpeed - element.delay;
    time += (rand(u_seed + 1.0, v_uv) * 2.0 - 1.0) * u_pulseLength / u_centerFrequency;
    vec2 v = signalForPointScatter0(pointPos, time);

    if(length(v) > length(maximumAmplitudeValue)) {
        outValue = packVec2ToVec4(v);
        outTime = packFloatToVec4(time * 1000.0);
    } else {
        outValue = packVec2ToVec4(maximumAmplitudeValue);
        outTime = maximumAmplitudeTime;
    }
}