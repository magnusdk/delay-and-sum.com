float PI = 3.14159;
float TAU = 6.28318;
float SQRT2 = 1.41421;
float EPS = 1e-12;

vec3 PINK = vec3(1.0, 0.09803921568627451, 0.3686274509803922);
vec3 BLUE = vec3(0, 0.5215686274509804, 1.0);

vec2 gaussianWeightedSine(float time, float centerFrequency, float pulseLength) {
  float gauss = exp(-pow(time * centerFrequency / pulseLength * 2.0, 2.0));
  float real = sin(time * centerFrequency * TAU) * gauss;
  float imag = cos(time * centerFrequency * TAU) * gauss;
  return vec2(real, imag) / SQRT2;
}

float dB(float v) {
  return 20.0 * log2(v) / log2(10.0);
}

vec4 displayPhaseKernel(vec2 v, float minDecibels, float maxDecibels) {
  float real = v.x;
  float amp = length(v);
  float ampDB = dB(amp + EPS);
  float alpha = (ampDB - minDecibels) / (maxDecibels - minDecibels);
  float positivePressure = real > 0.0 ? 1.0 : 0.0;
  vec3 color = PINK * positivePressure + BLUE * (1.0 - positivePressure);
  vec3 white = vec3(1.0, 1.0, 1.0);
  color = vec3(0, 0, 0);
  return vec4(color, alpha);
}

float attenuation(float distance, float attenuationCoefficient) {
  return exp(-distance * attenuationCoefficient);
}

varying vec2 v_uv;
uniform sampler2D u_elementsTexture;
uniform vec2 u_samplePoint;
uniform int u_nElements;
uniform mat3 u_cameraMatrix;
uniform float u_centerFrequency;
uniform float u_pulseLength;
uniform float u_time;
uniform float u_soundSpeed;

struct Element {
  vec2 pos;
  float weight;
  float delay;
  float normalAzimuthRad;
  float width;
};

Element getElement(int index) {
  float stride = float(index) / 256.0;
  vec4 chunk1 = texture2D(u_elementsTexture, vec2(stride, 0.0));
  vec4 chunk2 = texture2D(u_elementsTexture, vec2(stride + 1.0, 0.0));
  return Element(chunk1.xy, chunk1.z, chunk1.w, chunk2.x, chunk2.y);
}

void main() {
  gl_FragColor = vec4(float(u_nElements) / 400.0, 0.0, 0.0, 1.0);

  vec2 pixelPos = (vec3(v_uv, 1.0) * u_cameraMatrix).xy;

  float distScattererPixel = distance(u_samplePoint, pixelPos);
  float attenuationScattererPixel = attenuation(distance(u_samplePoint, pixelPos), 1.0);

  vec2 v = vec2(0.0, 0.0);
  for(int i = 0; i < u_nElements; i++) {
    Element element = getElement(i);
    float basePhase = u_time + element.delay;

    // Get the signal for the pixel without accounting for scatterers.
    float distElementPixel = distance(element.pos, pixelPos);
    float phaseScatter0 = basePhase - distElementPixel / u_soundSpeed;
    vec2 signalScatter0 = gaussianWeightedSine(phaseScatter0, u_centerFrequency, u_pulseLength);
    signalScatter0 *= attenuation(distElementPixel, 1.0);

    // Get the signal for the pixel after reflecting off of the scatterer.
    float distElementScatterer = distance(element.pos, u_samplePoint);
    // The phase is dependent on the distance travelled from the element to the 
    // scatterer, and from the scatterer to the pixel.
    float phaseScatter1 = basePhase - (distElementScatterer + distScattererPixel) / u_soundSpeed;
    vec2 signalScatter1 = gaussianWeightedSine(phaseScatter1, u_centerFrequency, u_pulseLength);
    // Likewise, we weight the signal by the amplitude of the signal when it hit the 
    // scatterer (dependent on the distance between the element and the scatterer), 
    // times the attenuation weighting from the scatterer to the pixel.
    signalScatter1 *= attenuation(distElementScatterer, 1.0) * attenuationScattererPixel;

    // Add both the scatter0 (signal without accounting for scatterers) and the scatter1
    // (signal reflected from the scatterer) to the final signal.
    v += signalScatter0 + signalScatter1;
  }

  // Normalize the summed signal so that the amplitude doesn't change too much when 
  // changing the number of elements in the probe.
  v /= float(u_nElements);

  // Render the value
  gl_FragColor = displayPhaseKernel(v, -60.0, 0.0);

  // Debugging grid
  // float r = cos(pos.y * TAU * 100.0);
  // float g = cos(pos.x * TAU * 100.0);
  // gl_FragColor = vec4(r, g, 0.0, 1.0);
}