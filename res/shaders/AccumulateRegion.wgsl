@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

const wgsizeX : u32 = 4;
const wgsizeY : u32 = 8;

const wgsize : u32 = wgsizeY * wgsizeY;

var<workgroup> sdata: array<array<u32, wgsize>, wgsizeX>;

@compute
@workgroup_size(wgsizeX, wgsizeY, wgsizeY)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // handling region boundaries
    var start_x = camera.cursor_x;
    var start_y = camera.cursor_y;

    var end_x = camera.cursor_x2;
    var end_y = camera.cursor_y2;

    if camera.area_selector > 0 {
        if camera.cursor_x > camera.cursor_x2 {
            start_x = camera.cursor_x2;
            end_x = camera.cursor_x;
        }

        if camera.cursor_y > camera.cursor_y2 {
            start_y = camera.cursor_y2;
            end_y = camera.cursor_y;
        }
    }

    // indexing
    var tx: u32 = local_id.x;
    var ty: u32 = local_id.y + local_id.z * wgsizeY;

    let i = local_id.y + group_id.y * wgsizeY + u32(start_x);
    let j = local_id.z + group_id.z * wgsizeY + u32(start_y);
    let k = globalId.x;

    let index = vec3u(i, j, k);


    if (k < BINS_TOTAL) { // combined spectra: stars + patches
        sdata[tx][ty] = select(0, floatToPacked(getFlux(index, false)), i <= u32(end_x) && j <= u32(end_y) && k < DEPTH);
    }
    else if(k == DENSITY_OFFSET) { // density
        sdata[tx][ty] = select(0, floatToPacked(getCount(index.xy)), i <= u32(end_x) && j <= u32(end_y) && k < DEPTH);
    }
    else {
        sdata[tx][ty] = select(0, spectralImage[spectrumIndex(index)], i <= u32(end_x) && j <= u32(end_y) && k < DEPTH);
    }
    
    let isInt = k == ID_OFFSET[0] || k == ID_OFFSET[1] || k == STAR_LIST_NODE_ID_OFFSET || (k >= PATCH_ID_0_OFFSET && k < PATCH_ID_0_OFFSET + PATCH_ID_COUNT);
    
    // sync all the threads:
    workgroupBarrier();
    for (var s: u32 = u32(wgsize / 2); s > 0; s >>= 1) {
        if ty < s {
            if(isInt) {
               // normal add
                sdata[tx][ty] += sdata[tx][ty + s];
            } else {
                // soft float float addition
                sdata[tx][ty] = packedSoftAdd(sdata[tx][ty], sdata[tx][ty + s]);
            }
        }
        workgroupBarrier();
    }

    // Add result from the workgroup to the output storage:
    if ty == 0 && k < DEPTH {
        if(isInt) {
            atomicAdd(&outputSpectrum[k], sdata[tx][0]);
        }
        else {
            atomicAddPacked(&outputSpectrum[k], sdata[tx][0]);
        }
    }
}