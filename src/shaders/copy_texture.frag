varying vec2 v_uv;
uniform sampler2D t_data;

out vec4 outColor;

#include <common>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    outColor = texture2D(t_data, coord);
}
