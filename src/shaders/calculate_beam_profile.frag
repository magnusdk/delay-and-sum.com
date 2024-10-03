varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform int u_nElements;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_time;
uniform float u_soundSpeed;
uniform float u_attenuationFactor;
uniform vec2 u_waveOrigin;
uniform float u_t0;
uniform vec2 u_waveDirection;
uniform vec2 u_samplePoint;
uniform bool u_lateralBeamProfile;  // Sample laterally if true, else axially

#include <simulation>

void main() {
    vec2 beamProfileDirection = u_waveDirection;
    if(u_lateralBeamProfile) {
        beamProfileDirection = vec2(u_waveDirection.y, -u_waveDirection.x);
    }
    float dist = (u_time - u_t0) * u_soundSpeed;
    // Width of the sampled lateral beam profile line is 20 wavelengths.
    float w = u_soundSpeed / u_centerFrequency * 20.0;
    // Start at the origin
    vec2 pointPos = u_waveOrigin;
    // Move by dist in the direction of the wave.
    pointPos += u_waveDirection * dist;
    // As a function of the plot's x-axis (v_uv.x), sample a point across the orthogonal wave direction.
    pointPos += beamProfileDirection * v_uv.x * w;
    vec2 v = signalForPoint(pointPos, u_time);
    gl_FragColor = packVec2ToVec4(v);
}