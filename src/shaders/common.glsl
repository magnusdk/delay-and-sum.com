float TAU   = 6.28318;
float PI    = 3.14159;
float SQRT2 = 1.41421;
float EPS   = 1e-12;

vec3  PINK  = vec3(1.0, 0.09803921568627451, 0.3686274509803922);
vec3  BLUE  = vec3(0, 0.5215686274509804, 1.0);


vec4 packVec2ToVec4(vec2 v) {
    // Ensure input is in range [-1, 1]
    v = clamp(v, -1.0, 1.0);

    // Convert from [-1, 1] to [0, 1]
    v = (v + 1.0) / 2.0;

    // Convert to 16-bit representation
    vec2 v16 = v * 65535.0;

    // Split into 8-bit components
    vec4 packed;
    packed.r = floor(fract(v16.x / 256.0) * 256.0) / 255.0;
    packed.g = floor(v16.x / 256.0) / 255.0;
    packed.b = floor(fract(v16.y / 256.0) * 256.0) / 255.0;
    packed.a = floor(v16.y / 256.0) / 255.0;

    return packed;
}

vec2 unpackVec4ToVec2(vec4 packed) {
    vec2 v16;
    v16.x = (packed.r * 255.0) + (packed.g * 255.0) * 256.0;
    v16.y = (packed.b * 255.0) + (packed.a * 255.0) * 256.0;
    vec2 v = v16 / 65535.0;
    return v * 2.0 - 1.0;
}

float dB(float v) {
    return 20.0 * log2(v) / log2(10.0);
}

float invDB(float v) {
    return pow(10.0, v / 20.0);
}
