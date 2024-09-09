varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_soundSpeed;
uniform float u_minimumTime;
uniform float u_maximumTime;

#include <simulation>

void main() {
    int i = int((v_uv.y + 1.0) / 2.0 * float(u_nElements));
    Element element = getElement(i);
    float time = (v_uv.x + 1.0) / 2.0 * (u_maximumTime - u_minimumTime) + u_minimumTime;
    vec2 v = signalForPoint(element.pos, time);
    gl_FragColor = packVec2ToVec4(v);
}