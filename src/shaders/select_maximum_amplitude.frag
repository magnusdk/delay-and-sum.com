varying vec2 v_uv;
uniform sampler2D t_data1;
uniform sampler2D t_data2;

#include <common>

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);
    vec2 v1 = unpackVec4ToVec2(texture2D(t_data1, coord));
    vec2 v2 = unpackVec4ToVec2(texture2D(t_data2, coord));
    if(length(v1) > length(v2)) {
        gl_FragColor = packVec2ToVec4(v1);
    } else {
        gl_FragColor = packVec2ToVec4(v2);
    }
}
