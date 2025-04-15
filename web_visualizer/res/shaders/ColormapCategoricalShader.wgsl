@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(0) var colormapSampler: sampler;
@group(1) @binding(1) var colormap: texture_1d<f32>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<atomic<u32>>;

const STRIDE: u32 = BINS / 11;
const OFFSET: u32 = 1;


@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {

    // indexing
    var tx: u32 = local_id.x;

    let i = globalId.x;
    let j = globalId.y;

    if i >= camera.width || j >= camera.height { return; }
    
    let coord = vec2u(i, j);

    var nodeId: u32 = 0;


    if camera.colormapStrategy == StarListNodeId {
        nodeId = spectralImage[starListNodeIdIndex(coord)];
    }
    if camera.colormapStrategy == PatchNodeId {
        nodeId = spectralImage[patchIdIndex(coord, camera.patchLevel)];
    }


    let exists = f32(nodeId != 0);
    
    let alpha = (((nodeId + OFFSET)* STRIDE) % BINS); // / f32(BINS);
    let val = textureLoad(colormap, alpha, 0) * exists;

    atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 0))], floatToPacked(val.r));
    atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 1))], floatToPacked(val.g));
    atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 2))], floatToPacked(val.b));
    atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 3))], floatToPacked(val.a));
}