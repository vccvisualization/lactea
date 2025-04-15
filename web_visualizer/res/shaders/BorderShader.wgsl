@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(2) var<storage> nodes: array<Node>;

@group(1) @binding(2) var<storage> gpuBordersBuffer: array<u32>;


fn getIndex(index: u32) -> u32 {
    return gpuBordersBuffer[index] / (4 * NODE_STRIDE);
}

fn getBoundingBox(index: u32) -> vec4f {
    return 2 * vec4f(nodes[index].boundingBox[0] / 360., nodes[index].boundingBox[1] / 180. + 0.5, nodes[index].boundingBox[2] / 360., nodes[index].boundingBox[3] / 180. + 0.5) - 1;
}


struct Vertex {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};


@vertex fn vs(
  @builtin(vertex_index) vertexIndex : u32
) -> Vertex {
    let nodeIdx = u32(vertexIndex / 8);
    let index = getIndex(nodeIdx);
    
    // buffer access
    let boundingBox = getBoundingBox(index);

    let pos = array(
        vec2f(boundingBox.x, boundingBox.y), // bottom left
        vec2f(boundingBox.x, boundingBox.w), // top left
        vec2f(boundingBox.x, boundingBox.w), // top left
        vec2f(boundingBox.z, boundingBox.w), // top right
        vec2f(boundingBox.z, boundingBox.w), // top right
        vec2f(boundingBox.z, boundingBox.y), // bottom right
        vec2f(boundingBox.z, boundingBox.y), // bottom right
        vec2f(boundingBox.x, boundingBox.y), // bottom left
    );

    var vsOutput: Vertex;
    let vPos = pos[vertexIndex % 8];
    vsOutput.position = vec4f(vPos, 0.0, 1.0);
    vsOutput.color = vec4f(1);
    return vsOutput;
}


@fragment
fn fs(fsInput: Vertex) -> @location(0) vec4f {
    return fsInput.color;
}