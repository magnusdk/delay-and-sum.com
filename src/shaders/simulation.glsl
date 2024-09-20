#include <common>
#include <packedElements>

vec2 gaussianWeightedSine(float time, float centerFrequency, float pulseLength) {
  float gauss = exp(-pow(time * centerFrequency / pulseLength * 2.0, 2.0));
  float real = sin(time * centerFrequency * TAU) * gauss;
  float imag = cos(time * centerFrequency * TAU) * gauss;
  return vec2(real, imag) / SQRT2;
}

float attenuation(float distance, float attenuationCoefficient) {
  return exp(-distance * attenuationCoefficient);
}

vec2 signalForPoint(vec2 pointPos, float time) {
  float distScattererPixel = distance(u_samplePoint, pointPos);
  float attenuationScattererPixel = attenuation(distance(u_samplePoint, pointPos), 1.0);

  vec2 v = vec2(0.0, 0.0);
  for(int i = 0; i < u_nElements; i++) {
    Element element = getElement(i);
    float basePhase = time + element.delay;

    // Get the signal for the pixel without accounting for scatterers.
    float distElementPixel = distance(element.pos, pointPos);
    float phaseScatter0 = basePhase - distElementPixel / u_soundSpeed;
    vec2 signalScatter0 = gaussianWeightedSine(phaseScatter0, u_centerFrequency, u_pulseLength);
    signalScatter0 *= attenuation(distElementPixel, u_attenuationFactor);
    signalScatter0 *= element.weight;

    // Get the signal for the pixel after reflecting off of the scatterer.
    float distElementScatterer = distance(element.pos, u_samplePoint);
    // The phase is dependent on the distance travelled from the element to the 
    // scatterer, and from the scatterer to the pixel.
    float phaseScatter1 = basePhase - (distElementScatterer + distScattererPixel) / u_soundSpeed;
    vec2 signalScatter1 = gaussianWeightedSine(phaseScatter1, u_centerFrequency, u_pulseLength);
    // Likewise, we weight the signal by the amplitude of the signal when it hit the 
    // scatterer (dependent on the distance between the element and the scatterer), 
    // times the attenuation weighting from the scatterer to the pixel.
    signalScatter1 *= attenuation(distElementScatterer, u_attenuationFactor) * attenuationScattererPixel;
    signalScatter1 *= element.weight;

    // Add both the scatter0 (signal without accounting for scatterers) and the scatter1
    // (signal reflected from the scatterer) to the final signal.
    v += signalScatter0 + signalScatter1;
  }

  // Normalize the summed signal so that the amplitude doesn't change too much when 
  // changing the number of elements in the probe.
  v /= float(u_nElements);
  return v;
}