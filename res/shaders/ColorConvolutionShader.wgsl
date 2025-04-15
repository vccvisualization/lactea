@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(0) var colormapSampler: sampler;
@group(1) @binding(1) var colormap: texture_1d<f32>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<atomic<u32>>;


const wgsizeX : u32 = 256;


var<workgroup> sdata: array<array<f32, 4>, wgsizeX>;

@compute
@workgroup_size(256, 1, 1)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {

    // indexing
    var tx: u32 = local_id.x;

    let i = globalId.y;
    let j = globalId.z;
    let wl = globalId.x;

    let coord = vec2u(i, j);
    
    // load data
    var flux = select(0.0, getFlux(vec3u(coord, wl), true), i < camera.width && j < camera.height && wl < BINS);

    let l = textureLoad(colormap, wl, 0);
    sdata[tx][0] = flux * l.r;
    sdata[tx][1] = flux * l.g;
    sdata[tx][2] = flux * l.b;
    sdata[tx][3] = flux;
    workgroupBarrier();


    for (var s: u32 = u32(wgsizeX / 2); s > 0; s >>= 1) {
        if tx < s {
            sdata[tx][0] += sdata[tx + s][0];
            sdata[tx][1] += sdata[tx + s][1];
            sdata[tx][2] += sdata[tx + s][2];
            sdata[tx][3] += sdata[tx + s][3];
        }
        workgroupBarrier();
    }

    if tx == 0 {
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 0))], floatToPacked(sdata[tx][0]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 1))], floatToPacked(sdata[tx][1]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 2))], floatToPacked(sdata[tx][2]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 3))], floatToPacked(sdata[tx][3]));
    }
}