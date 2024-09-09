varying vec2 v_uv;
uniform sampler2D t_previousRender;
uniform float u_minimumDb;
uniform float u_maximumDb;

#include <common>

vec4 displayPhaseKernel(vec2 v, float minDecibels, float maxDecibels, bool use_db, int mode) {
    // Mode is either 0: phase, 1: envelope, or 2: intensity
    float amp = length(v);

    if(mode == 2) {
        amp = pow(amp, 2.0);
    }
    if(use_db) {
        amp = dB(amp);
    } else {
        minDecibels = invDB(minDecibels);
        maxDecibels = invDB(maxDecibels);
    }

    float alpha = (amp - minDecibels) / (maxDecibels - minDecibels);
    if(mode == 0) {
        float real = v.x;
        float positivePressure = real > 0.0 ? 1.0 : 0.0;
        vec3 color = PINK * positivePressure + BLUE * (1.0 - positivePressure);
        return vec4(color, alpha);
    }
    return vec4(0.0, 0.0, 0.0, alpha);
}

void main() {
    vec4 previousColor = texture2D(t_previousRender, v_uv / 2.0 + vec2(0.5, 0.5));
    gl_FragColor = displayPhaseKernel(unpackVec4ToVec2(previousColor), -60.0, 0.0, true, 0);
}