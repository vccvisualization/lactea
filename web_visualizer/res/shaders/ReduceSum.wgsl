@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<atomic<u32>>;

const wgsizeX : u32 = 256;

var<workgroup> high: array<u32, wgsizeX>;
var<workgroup> low: array<u32, wgsizeX>;

@compute
@workgroup_size(wgsizeX, 1, 1)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // indexing
    var tx: u32 = local_id.x;

    let i = globalId.y;
    let j = globalId.z;
    let k = globalId.x;
    let indices = spectrumIndex(vec3u(i, j, k));
    let sumIndicies = fluxSumIndex(vec2u(i, j));

    if globalId.x == 0 {
        atomicStore(&spectralImage[sumIndicies.y], 0);
    }
    if globalId.x == 1 {
        atomicStore(&spectralImage[sumIndicies.x], 0);
    }
    workgroupBarrier();

    high[tx] = select(0, atomicLoad(&spectralImage[indices.x]), i < camera.width && j < camera.height && k < BINS);
    low[tx] = select(0, atomicLoad(&spectralImage[indices.y]), i < camera.width && j < camera.height && k < BINS);

    // sync all the threads:
    workgroupBarrier();
    for (var s: u32 = u32(wgsizeX / 2); s > 0; s >>= 1) {
        if tx < s {
            low[tx] += low[tx + s];
            high[tx] += high[tx + s] + u32(low[tx] < low[tx + s]);
        }
        workgroupBarrier();
    }

    // Add result from the workgroup to the output storage:
    if tx == 0 {
        let value = atomicAdd(&spectralImage[sumIndicies.y], low[0]);
        atomicAdd(&spectralImage[sumIndicies.x], high[0] + u32((value + low[0]) < low[0]));
    }
}