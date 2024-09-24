varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform mat3 u_cameraMatrix;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_time;
uniform float u_soundSpeed;
uniform float u_attenuationFactor;

#include <simulation>

void main() {
  vec2 pointPos = (vec3(v_uv, 1.0) * u_cameraMatrix).xy;
  vec2 v = signalForPoint(pointPos, u_time);
  gl_FragColor = packVec2ToVec4(v);
}