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