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
uniform float u_beamProfileSampleLineLength;  // Meters
uniform float u_seed;
out vec4 outColor;

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
    pointPos += beamProfileDirection * v_uv.x * u_beamProfileSampleLineLength / 2.0;

    int elementIndex = int(rand(u_seed, v_uv + vec2(10, 10)) * float(u_nElements));
    Element element = getElement(elementIndex);

    float time = distance(pointPos, element.pos) / u_soundSpeed - element.delay;
    time += (rand(u_seed + 1.0, v_uv) * 2.0 - 1.0) * u_pulseLength / u_centerFrequency;

    vec2 v = signalForPointScatter0(pointPos, time);
    outColor = packVec2ToVec4(v);
}