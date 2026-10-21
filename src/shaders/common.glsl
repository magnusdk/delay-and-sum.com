float TAU = 6.28318;
float PI = 3.14159;
float SQRT2 = 1.41421;
float EPS = 1e-12;

vec3 WHITE = vec3(1, 1, 1);
vec3 PINK = vec3(1.0, 0.09803921568627451, 0.3686274509803922);
vec3 BLUE = vec3(0, 0.5215686274509804, 1.0);
vec3 DARK_BLUE = vec3(0.11372549019, 0.31764705882, 0.6);

// Log-polar packing: 16 bits of amplitude in dB (code 0 is exact zero) and 16 bits of phase
const float PACK_MIN_DB = -200.0;
const float PACK_MAX_DB = 56.0;
const float PACK_TWO_PI = 6.283185307179586;

vec4 packVec2ToVec4(vec2 v) {
    float amp = length(v);
    float a16 = 0.0;
    float p16 = 0.0;
    if(amp > 0.0) {
        float ampDb = 20.0 * log2(amp) / log2(10.0);
        float t = (ampDb - PACK_MIN_DB) / (PACK_MAX_DB - PACK_MIN_DB);
        // Values below PACK_MIN_DB become code 0 (zero)
        a16 = clamp(floor(t * 65534.0 + 0.5) + 1.0, 0.0, 65535.0);
        p16 = mod(floor(fract(atan(v.y, v.x) / PACK_TWO_PI) * 65536.0 + 0.5), 65536.0);
    }

    // Split into 8-bit components
    return vec4(mod(a16, 256.0), floor(a16 / 256.0), mod(p16, 256.0), floor(p16 / 256.0)) / 255.0;
}

vec2 unpackVec4ToVec2(vec4 packed) {
    // Round, since packed * 255.0 is not always exactly an integer
    float a16 = floor(packed.r * 255.0 + packed.g * 255.0 * 256.0 + 0.5);
    float p16 = floor(packed.b * 255.0 + packed.a * 255.0 * 256.0 + 0.5);
    if(a16 < 0.5) {
        return vec2(0.0, 0.0);
    }
    float ampDb = (a16 - 1.0) / 65534.0 * (PACK_MAX_DB - PACK_MIN_DB) + PACK_MIN_DB;
    float amp = exp2(ampDb / 20.0 * log2(10.0));
    float phase = p16 / 65536.0 * PACK_TWO_PI;
    return amp * vec2(cos(phase), sin(phase));
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