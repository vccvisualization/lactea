@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(2) var<storage> nodes: array<Node>;

@group(1) @binding(2) var<storage> gpuBordersBuffer: array<u32>;


fn getIndex(index: u32) -> u32 {
    return gpuBordersBuffer[index] / (4 * NODE_STRIDE);
}

fn getBoundingBox(index: u32) -> vec4f {
    return vec4f(nodes[index].boundingBox[0] / 360., nodes[index].boundingBox[1] / 180. + 0.5, nodes[index].boundingBox[2] / 360., nodes[index].boundingBox[3] / 180. + 0.5);
}


struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

const DOTS_BETWEEN_TWO_LINES = N * 2;
const VERTICIES: u32 = 4 * DOTS_BETWEEN_TWO_LINES;


fn calcPosition(instanceId: u32, start: vec2f, end: vec2f) -> vec4f {
    var alphaIndex: f32 = ceil(f32(instanceId % DOTS_BETWEEN_TWO_LINES) / 2);
    var alpha: f32 = (alphaIndex) / f32(N);
    var interpolation = (1. - alpha) * start + alpha * end;
    return vec4f(transformPos(interpolation), alpha);
}
@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32
) -> Vertex {
    let nodeIdx = u32(vertexIndex / (VERTICIES));
    let index = getIndex(nodeIdx);
    
    // buffer access
    let boundingBox = getBoundingBox(index);

    let pos = array(
        // left: bottom to top
        vec2f(boundingBox.x, boundingBox.y),
        vec2f(boundingBox.x, boundingBox.w),
        // top: left to right
        vec2f(boundingBox.x, boundingBox.w),
        vec2f(boundingBox.z, boundingBox.w),
        // right: top to bottom
        vec2f(boundingBox.z, boundingBox.w),
        vec2f(boundingBox.z, boundingBox.y),
        // bottom: right to left
        vec2f(boundingBox.z, boundingBox.y),
        vec2f(boundingBox.x, boundingBox.y),
    );

    let instanceId = vertexIndex % (VERTICIES);

    let faceId = instanceId / (DOTS_BETWEEN_TWO_LINES);
    let start = pos[2 * faceId];
    let end = pos[2 * faceId + 1];

    let vPos = calcPosition(instanceId, start, end);

    var color = vPos.w;
    if(instanceId < VERTICIES) {
        let nextInstanceId = select(instanceId - 1, instanceId + 1, instanceId % 2 == 0);
        // next point
        let vPosNext = calcPosition(nextInstanceId, start, end);

        let l = length(vPosNext.xy - vPos.xy);
        if l > 0.5 {
            color = 0;
        }
    }
    var vsOutput: Vertex;
    vsOutput.position = vec4f(vPos.xyz, 1.0);
    vsOutput.color = vec4f(color);

    return vsOutput;
}


@fragment
fn fs(fsInput: Vertex) -> @location(0) vec4f {
    return fsInput.color;
}