@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;


const wgsizeX : u32 = 1;
const wgsizeY = 4;
const wgsize : u32 = wgsizeY * wgsizeY;


@compute
@workgroup_size(wgsizeX, wgsizeY, wgsizeY)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // indexing
    var tx: u32 = local_id.x;
    var ty: u32 = local_id.y + local_id.z * wgsizeY;

    let i = local_id.y + group_id.y * wgsizeY;
    let j = local_id.z + group_id.z * wgsizeY;

    if (i >= camera.width || j >= camera.height) { return;}

    var level: u32 = 0;
    while(level < PATCH_ID_COUNT) {
        let nodeId = spectralImage[patchIdIndex(vec2u(i, j), level)];

        if(nodeId > 0) {
            atomicAdd(&outputSpectrum[patchIdCountIdx(nodeId-1)], 1);
            level++;
        } else {
            break;
        }
    }
}