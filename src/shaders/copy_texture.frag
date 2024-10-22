varying vec2 v_uv;
uniform sampler2D t_values;
uniform sampler2D t_times;

layout(location = 0) out vec4 outValue;
layout(location = 1) out vec4 outTime;

#include <common>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    outValue = texture2D(t_values, coord);
    outTime = texture2D(t_times, coord);
}
