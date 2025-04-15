@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<u32>;

const wgsizeX : u32 = 13;
const wgsizeY = 4;
const wgsize : u32 = wgsizeY * wgsizeY;

var<workgroup> sdata: array<array<u32, wgsize>, wgsizeX>; // density + RGBA (min, max, count)


@compute
@workgroup_size(wgsizeX, wgsizeY, wgsizeY)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // indexing
    var tx: u32 = local_id.x;
    var ty: u32 = local_id.y + local_id.z * wgsizeY;

    let i = local_id.y + group_id.y * wgsizeY;
    let j = local_id.z + group_id.z * wgsizeY;


    var k: u32 = 0;
    var data: u32 = 0;
    let coord = vec2u(i, j);

    if tx == 0 { // density
        data = floatToPacked(getCount(coord));
        k = DENSITY_MAX_OFFSET;
    }
    if tx == 1 { // g
        data = (hdrImage[hdrImageIndex(vec3u(coord, 1))]);
        k = G_MAX_OFFSET;
    }
    if tx == 2 { // b
        data = (hdrImage[hdrImageIndex(vec3u(coord, 2))]);
        k = B_MAX_OFFSET;
    }
    if tx == 3 { // r
        data = (hdrImage[hdrImageIndex(vec3u(coord, 0))]);
        k = R_MAX_OFFSET;
    }
    if tx == 4 { // a
        data = (hdrImage[hdrImageIndex(vec3u(coord, 3))]);
        k = A_MAX_OFFSET;
    }
    if tx == 5 { // g
        data = (hdrImage[hdrImageIndex(vec3u(coord, 1))]);
        k = G_MIN_OFFSET;
    }
    if tx == 6 { // b
        data = (hdrImage[hdrImageIndex(vec3u(coord, 2))]);
        k = B_MIN_OFFSET;
    }
    if tx == 7 { // r
        data = (hdrImage[hdrImageIndex(vec3u(coord, 0))]);
        k = R_MIN_OFFSET;
    }
    if tx == 8 { // a
        data = (hdrImage[hdrImageIndex(vec3u(coord, 3))]);
        k = A_MIN_OFFSET;
    }
    if tx == 9 { // g
        data = (hdrImage[hdrImageIndex(vec3u(coord, 1))]);
        k = G_COUNT_OFFSET;
    }
    if tx == 10 { // b
        data = (hdrImage[hdrImageIndex(vec3u(coord, 2))]);
        k = B_COUNT_OFFSET;
    }
    if tx == 11 { // r
        data = (hdrImage[hdrImageIndex(vec3u(coord, 0))]);
        k = R_COUNT_OFFSET;
    }
    if tx == 12 { // a
        data = (hdrImage[hdrImageIndex(vec3u(coord, 3))]);
        k = A_COUNT_OFFSET;
    }
    // Each thread should read its data:
    if tx < 9 {
        sdata[tx][ty] = select(0, data, i < camera.width && j < camera.height);
    }
    else {
        sdata[tx][ty] = select(0, u32(packedToFloat(data) != 0), i < camera.width && j < camera.height);
    }
    // sync all the threads:
    workgroupBarrier();

    // Do the reduction in shared memory:
    // https://developer.download.nvidia.com/assets/cuda/files/reduction.pdf
    // Kernel 3
    for (var s: u32 = u32(wgsize / 2); s > 0; s >>= 1) {
        if ty < s {
            if tx < 5 { // max
                sdata[tx][ty] = packedSoftMax(sdata[tx][ty + s], sdata[tx][ty]);
            }
            else if tx < 9 { // min
                if !isPackedZero(sdata[tx][ty + s]) && !isPackedZero(sdata[tx][ty]) {
                    sdata[tx][ty] = packedSoftMin(sdata[tx][ty + s], sdata[tx][ty]);
                } else {
                    sdata[tx][ty] = packedSoftMax(sdata[tx][ty + s], sdata[tx][ty]);
                }
            } else { // count
                sdata[tx][ty] += sdata[tx][ty + s];
            }
        }
        workgroupBarrier();
    }

    // Add result from the workgroup to the output storage:
    if ty == 0 {
        if tx < 5 {
            atomicMaxPacked(&outputSpectrum[k], sdata[tx][0]);
        } else if tx < 9 {
            if !isPackedZero(sdata[tx][0]) {
                atomicMinPacked(&outputSpectrum[k], sdata[tx][0]);
            }
        } else {
            atomicAdd(&outputSpectrum[k], sdata[tx][0]);
        }
    }
}