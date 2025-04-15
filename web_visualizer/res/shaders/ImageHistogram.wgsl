@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<u32>;


var<workgroup> globalMax: array<f32, 4>;
var<workgroup> globalMin: array<f32, 4>;

@compute
@workgroup_size(4, 4, 4)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // indexing

    let i = globalId.y;
    let j = globalId.z;
    let channel = globalId.x;

    let coord = vec2u(i, j);



    if channel == 0 { 
        globalMax[0] = packedToFloat(atomicLoad(&outputSpectrum[R_MAX_OFFSET]));
        globalMin[0] = packedToFloat(atomicLoad(&outputSpectrum[R_MIN_OFFSET]));
    }
    if channel == 1 { 
        globalMax[1] = packedToFloat(atomicLoad(&outputSpectrum[G_MAX_OFFSET]));
        globalMin[1] = packedToFloat(atomicLoad(&outputSpectrum[G_MIN_OFFSET]));
    }
    if channel == 2 {
        globalMax[2] = packedToFloat(atomicLoad(&outputSpectrum[B_MAX_OFFSET]));
        globalMin[2] = packedToFloat(atomicLoad(&outputSpectrum[B_MIN_OFFSET]));
    }
    if channel == 3 {
        globalMax[3] = packedToFloat(atomicLoad(&outputSpectrum[A_MAX_OFFSET]));
        globalMin[3] = packedToFloat(atomicLoad(&outputSpectrum[A_MIN_OFFSET]));
    }
    workgroupBarrier();


    let data = packedToFloat(hdrImage[hdrImageIndex(vec3u(coord, channel))]);
    
    if data != 0 {
        let binId = f32(IMAGE_HIST_BIN_SIZE/4 - 1) * ((log(data) - log(globalMin[channel])) / (log(globalMax[channel]) - log(globalMin[channel])));

        atomicAdd(&outputSpectrum[imageHistIdx(u32(binId), channel)], 1);
    }
}