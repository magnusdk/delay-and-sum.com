varying vec2 v_uv;
uniform sampler2D t_data;

#include <common>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    gl_FragColor = texture2D(t_data, coord);
}
