layout(location = 0) out vec4 outValue;
layout(location = 1) out vec4 outTime;

#include <common>

void main() {
    outValue = packVec2ToVec4(vec2(0.0, 0.0));
    outTime = packVec2ToVec4(vec2(0.0, 0.0));
}
