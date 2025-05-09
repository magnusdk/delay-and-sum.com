float TAU = 6.28318;
float PI = 3.14159;
float SQRT2 = 1.41421;
float EPS = 1e-12;

vec3 WHITE = vec3(1, 1, 1);
vec3 PINK = vec3(1.0, 0.09803921568627451, 0.3686274509803922);
vec3 BLUE = vec3(0, 0.5215686274509804, 1.0);
vec3 DARK_BLUE = vec3(0.11372549019, 0.31764705882, 0.6);

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

vec4 packFloatToVec4(float v) {
    // Ensure input is in range [-1, 1]
    v = clamp(v, -1.0, 1.0);

    // Convert from [-1, 1] to [0, 1]
    v = (v + 1.0) / 2.0;

    // Convert to 32-bit representation
    float v32 = v * 4294967295.0; // 2^32 - 1

    // Split into 8-bit components
    vec4 packed;
    packed.r = floor(fract(v32 / 16777216.0) * 256.0) / 255.0; // 16777216 = 256^3
    packed.g = floor(fract(v32 / 65536.0) * 256.0) / 255.0;    // 65536 = 256^2
    packed.b = floor(fract(v32 / 256.0) * 256.0) / 255.0;
    packed.a = floor(v32 / 256.0) / 255.0;

    return packed;
}

float unpackVec4ToFloat(vec4 packed) {
    float v32 = (packed.r * 255.0) * 16777216.0 +
        (packed.g * 255.0) * 65536.0 +
        (packed.b * 255.0) * 256.0 +
        (packed.a * 255.0);

    float v = v32 / 4294967295.0;
    return v * 2.0 - 1.0;
}

float dB(float v) {
    return 20.0 * log2(v) / log2(10.0);
}

float invDB(float v) {
    return pow(10.0, v / 20.0);
}

float rand(float seed, vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233) + seed)) * 43758.5453);
}

float lineSDF(vec2 p, vec2 a, vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float h = dot(pa, ba) / dot(ba, ba);
    h = clamp(h, 0.0, 1.0);
    return length(pa - h * ba);
}