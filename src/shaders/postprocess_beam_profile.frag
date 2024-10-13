varying vec2 v_uv;
uniform sampler2D t_previousRender;
uniform float u_plotMinimumDb;
uniform float u_plotMaximumDb;

#include <common>

void main() {
    vec2 v = unpackVec4ToVec2(texture2D(t_previousRender, v_uv / 2.0 + vec2(0.5, 0.5)));
    vec4 c = vec4(0.0, 0.0, 0.0, 1.0);

    // y is the y-coordinate of the beam profile plot
    float y = (v_uv.y - 1.0) / 2.0;
    float amp = (dB(length(v)) + u_plotMaximumDb) / (u_plotMaximumDb - u_plotMinimumDb);

    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    if(y <= amp) {
        gl_FragColor = vec4(BLUE, 1.0);
    }
}