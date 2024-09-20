varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_time;
uniform float u_soundSpeed;
uniform float u_attenuationFactor;
uniform vec4 u_beamProfileEndPoints;

#include <simulation>

void main() {
    vec2 pointPos = v_uv;
    // vec2 v = signalForPoint(pointPos, u_time);
    vec2 v = v_uv;
    gl_FragColor = packVec2ToVec4(v);
}