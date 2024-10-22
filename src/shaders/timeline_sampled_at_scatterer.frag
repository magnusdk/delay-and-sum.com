varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_soundSpeed;
uniform float u_minimumTime;
uniform float u_maximumTime;
uniform float u_attenuationFactor;
out vec4 outColor;

#include <simulation>

void main() {
    float time = (v_uv.x + 1.0) / 2.0 * (u_maximumTime - u_minimumTime) + u_minimumTime;
    vec2 v = signalForPointScatter0(u_samplePoint, time);
    outColor = packVec2ToVec4(v);
}