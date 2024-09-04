#version 300 es

precision lowp float;

in vec4 a_position;
uniform mat4 u_cameraMatrix;
out vec2 v_pos;

void main() {
    gl_Position = a_position;
    v_pos = (u_cameraMatrix * a_position).xy;
}