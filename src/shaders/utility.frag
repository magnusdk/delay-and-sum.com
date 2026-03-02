#version 300 es
precision highp float;

in vec2 v_uv;

// Operation: 0=CLEAR, 1=COPY, 2=COPY_MRT, 3=SELECT_MAX
uniform int u_operation;

// Used by COPY (op 1)
uniform sampler2D t_data;

// Used by COPY_MRT (op 2)
uniform sampler2D t_values;
uniform sampler2D t_times;

// Used by SELECT_MAX (op 3)
uniform sampler2D t_data1;
uniform sampler2D t_data2;

layout(location = 0) out vec4 outValue;
layout(location = 1) out vec4 outTime;

#include "./common.glsl"

void main() {
    vec2 coord = v_uv / 2.0 + vec2(0.5, 0.5);

    if (u_operation == 0) {
        // CLEAR
        outValue = packVec2ToVec4(vec2(0.0, 0.0));
        outTime = packVec2ToVec4(vec2(0.0, 0.0));
    } else if (u_operation == 1) {
        // COPY (single texture)
        outValue = texture(t_data, coord);
        outTime = vec4(0.0);
    } else if (u_operation == 2) {
        // COPY_MRT (values + times)
        outValue = texture(t_values, coord);
        outTime = texture(t_times, coord);
    } else {
        // SELECT_MAX (element-wise maximum of two packed vec2 textures)
        vec2 v1 = unpackVec4ToVec2(texture(t_data1, coord));
        vec2 v2 = unpackVec4ToVec2(texture(t_data2, coord));
        if(length(v1) > length(v2)) {
            outValue = packVec2ToVec4(v1);
        } else {
            outValue = packVec2ToVec4(v2);
        }
        outTime = vec4(0.0);
    }
}
