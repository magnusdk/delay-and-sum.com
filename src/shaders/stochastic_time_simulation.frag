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

#include <simulation>

void main() {
    vec2 pointPos = (vec3(v_uv, 1.0) * u_cameraMatrix).xy;
    int elementIndex = int(rand(u_seed, v_uv + vec2(10, 10)) * float(u_nElements));
    Element element = getElement(elementIndex);

    float time = distance(pointPos, element.pos) / u_soundSpeed - element.delay;
    time += (rand(u_seed + 1.0, v_uv) * 2.0 - 1.0) * u_pulseLength / u_centerFrequency;

    vec2 v = signalForPointScatter0(pointPos, time);
    gl_FragColor = packVec2ToVec4(v);
}