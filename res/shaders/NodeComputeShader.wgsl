@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(1) var<storage> gpuOffsets: array<u32>;


fn getIndex(index: u32) -> u32 {
    return gpuOffsets[index] / (4 * NODE_STRIDE);
}

fn getBoundingBox(index: u32) -> vec4f {
    return vec4f(nodes[index].boundingBox[0] / 360., nodes[index].boundingBox[1] / 180. + 0.5, nodes[index].boundingBox[2] / 360., nodes[index].boundingBox[3] / 180. + 0.5);
}

fn getNodeId(index: u32) -> u32 {
    return nodes[index].id;
}

// fn getStarCount(index: u32) -> u32 {
//     return nodes[index].starCount;
// }

// fn getFlux(index: u32, i: u32) -> f32 {
//     return nodes[index].own[i];
// }

struct VertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
  @location(1) index: f32,
  @location(2) tempIndex: f32,
  @location(3) triArea: f32
};


fn triangle_area_screen_space(A: vec2<f32>, B: vec2<f32>, C: vec2<f32>) -> f32 {
    let a = vec2f(0.5 * (A.x + 1) * f32(camera.width), 0.5 * (1-A.y) * f32(camera.height));
    let b = vec2f(0.5 * (B.x + 1) * f32(camera.width), 0.5 * (1-B.y) * f32(camera.height));
    let c = vec2f(0.5 * (C.x + 1) * f32(camera.width), 0.5 * (1-C.y) * f32(camera.height));
    return abs((a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)) * 0.5);
}

@vertex 
fn vs(
    @builtin(vertex_index) vertexIndex: u32,
    // @builtin(instance_index) instanceId: u32
) -> VertexShaderOutput {
    var vsOutput: VertexShaderOutput;

    let nodeIdx = u32(vertexIndex / 6) + camera.nodeTask;
    let index = getIndex(nodeIdx);
    
    // // determine grid cell - instead of tesselation
    // let alphaXStart = f32(u32(instanceId % N)) / f32(N);
    // let alphaXEnd = f32(u32(instanceId % N + 1)) / f32(N);

    // let alphaYStart = f32(u32(instanceId / N)) / f32(N);
    // let alphaYEnd = f32(u32(instanceId / N) + 1) / f32(N);

    var boundingBox = getBoundingBox(index);

    // boundingBox.x = (1. - alphaXStart) * boundingBox.x + alphaXStart * boundingBox.z;
    // boundingBox.z = (1. - alphaXEnd) * boundingBox.x + alphaXEnd * boundingBox.z;
    // boundingBox.y = (1. - alphaYStart) * boundingBox.y + alphaYStart * boundingBox.w;
    // boundingBox.w = (1. - alphaYEnd) * boundingBox.y + alphaYEnd * boundingBox.w;

    var pos = array(
        transformPos(vec2f(boundingBox.x, boundingBox.y)).xy, // bottom left
        transformPos(vec2f(boundingBox.z, boundingBox.y)).xy, // bottom right 
        transformPos(vec2f(boundingBox.z, boundingBox.w)).xy, // top right
        transformPos(vec2f(boundingBox.x, boundingBox.w)).xy, // top left
    );
    let triIndex = array(0, 1, 2, 2, 3, 0);
    let vPos = pos[triIndex[vertexIndex % 6]];
    vsOutput.position = vec4f(vPos, 0.0, 1.0);
    vsOutput.texcoord = (0.5 * vPos + 0.5);
    vsOutput.index = f32(getNodeId(index));
    vsOutput.tempIndex = f32(nodeIdx);
    vsOutput.triArea = triangle_area_screen_space(pos[0], pos[1], pos[2]) + triangle_area_screen_space(pos[2], pos[3], pos[0]);
    return vsOutput;
}

@group(0) @binding(1) var<storage, read_write> spectralImage: array<atomic<u32>>;

@fragment
fn fs(fsInput: VertexShaderOutput, @builtin(sample_index) triangleID: u32
) -> @location(0) f32 {
    let coord = vec2u(fsInput.texcoord * vec2f(vec2u(camera.width, camera.height)));
    atomicStore(&outputSpectrum[patchIdCountIdx(u32(fsInput.index))], u32(fsInput.triArea));
    var oldValue: u32;
    var newValue: u32 = u32(ceil(fsInput.index + 1));
    // atomicStore(&spectralImage[patchIdIndex(coord, 0)], newValue);
    // return f32(0); 
    var level: u32 = 0;
    var i: u32 = 0;
    loop {
        if(level >= PATCH_ID_COUNT) { break; }
        if(i >= 10) { 
            atomicStore(&spectralImage[patchIdIndex(coord, level)], newValue);
            break; 
        }

        oldValue = atomicLoad(&spectralImage[patchIdIndex(coord, level)]);

        if(oldValue == 0) {
            let result = atomicCompareExchangeWeak(&spectralImage[patchIdIndex(coord, level)], oldValue, newValue);

            if (result.exchanged) {
                break;
            }
        } else {
            level++;
        }
        i++;
    }

    return f32(0);
}