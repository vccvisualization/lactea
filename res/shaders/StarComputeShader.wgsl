@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<atomic<u32>>;

@group(1) @binding(0) var<storage> starsL1: array<Star>;
@group(1) @binding(1) var<storage> starsL2: array<Star>;
@group(1) @binding(2) var<storage> cacheInfo: array<StarListInfo>;

const TO_WRITE_FIRST: u32 = 7;
fn getIndex(index: u32) -> vec2u {
    let starTaskId = camera.starTask / camera.taskDepthStages;

    let chunkSize = (camera.starCount / camera.starGpuOffsetLength);
    let indexInsideChunk = index % chunkSize;
    let gpuOffsetIndex = u32(f32(index + starTaskId * camera.starTaskSize) / f32(chunkSize));
    let gpuOffset = cacheInfo[gpuOffsetIndex].offset / (4 * STAR_STRIDE); // bytes to element
    return vec2u(gpuOffset + indexInsideChunk, cacheInfo[gpuOffsetIndex].cacheLevel);
}

fn getStar(index: vec2u) -> Star {
    if(index.y == 1) {
        return starsL1[index.x];
    }
    return starsL2[index.x];
}

fn getPosition(index: vec2u) -> vec2f {
    return vec2f(getStar(index).ra, getStar(index).dec);
}

fn getId(index: vec2u) -> vec2u {
    return vec2u(getStar(index).idHigh, getStar(index).idLow);
}

fn getStarFlux(index: vec2u, i: u32) -> f32 {
    return getStar(index).data[i];
}



@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u) {
    // get task 2d indexing
    let starTaskId = camera.starTask / camera.taskDepthStages;
    let wlTaskId = camera.starTask % camera.taskDepthStages;

    // wl indexing
    let wlChunkSize = u32(ceil(f32(BINS_TOTAL) / f32(camera.taskDepthStages)));
    let wlChunkOffset = (wlTaskId) * wlChunkSize;
    if globalId.y >= wlChunkSize { return; }
    var wlIndex: u32;
    if(wlTaskId == 0) {
        if(globalId.y < TO_WRITE_FIRST) {
            // flux total, corrected flux total, phot, and temperature
            wlIndex = globalId.y + TOTAL_ENERGY_INDEX;
        } else {
            // spectra with stride
            wlIndex = (globalId.y - TO_WRITE_FIRST) * camera.taskDepthStages;
            // wlIndex = (globalId.y - TO_WRITE_FIRST);
            // if wlIndex >= BINS * 2 { return; }
        }
    } else {
        wlIndex = wlTaskId + (globalId.y) * camera.taskDepthStages;
        // if wlIndex >= BINS * 2 { return; }
        // wlIndex = wlTaskId * (wlChunkSize) - TO_WRITE_FIRST + (globalId.y);
    }

    while wlIndex >= BINS * 2 && wlIndex < BINS_TOTAL && (wlTaskId > 0 || (wlTaskId == 0 && globalId.y >= TO_WRITE_FIRST)) { 
        let offset = wlIndex - BINS * 2;
        wlIndex = ((wlChunkSize - TO_WRITE_FIRST) + offset) * camera.taskDepthStages;
        // if wlIndex >= BINS * 2 { return; }
    }
    // wlIndex = wlChunkOffset + globalId.y;
    if wlIndex >= BINS_TOTAL { return; }
    
    // star indexing
    let gindex = globalId.x;
    if gindex >= camera.starCount || gindex >= camera.starTaskSize { return; }


    let chunkSize = (camera.starCount / camera.starGpuOffsetLength);
    let indexInsideChunk = gindex % chunkSize;
    let gpuOffsetIndex = u32(f32(gindex + starTaskId * camera.starTaskSize) / f32(chunkSize));
    if indexInsideChunk >= cacheInfo[gpuOffsetIndex].length { return; }

    let index = getIndex(gindex);
    
    // buffer access
    let position = getPosition(index);
    let coordinate = vec2f(position.x / 360.0, position.y / 180.0 + 0.5);

    // where to draw in screen
    var vPos = transformPos(coordinate).xy;
    vPos = 0.5 * vPos + 0.5;// [-1, 1] to [0, 1]
    if vPos.x > 1.0 || vPos.y > 1.0 || vPos.x < 0. || vPos.y < 0. { return; };
    var coords = vec3u(vec3f(vPos * vec2f(vec2u(camera.width, camera.height)), 0.0));// 0-1 to screen res
    coords.z = wlIndex;
    // update histogram
    let value: f32 = getStarFlux(index, wlIndex);
    if value > 1e-18 {
        atomicAddFloat(&spectralImage[spectrumIndex(coords)], value);
    }
    // ADD ONCE PER STAR
    if(wlTaskId == 0) {
        if globalId.y == 0 {
            // add star density
            atomicAddFloat(&spectralImage[densityIndex(coords.xy)], 1);
        }
        if wlIndex == TEMPERATURE_INDEX {
            // star temperature count
            if value > 0 {
                atomicAddFloat(&spectralImage[tempDensityIndex(coords.xy)], 1);
            }
        }
        if globalId.y == 1 {
            // id
            var temp = getId(index);
            var indices: vec2u = idIndex(coords.xy);
            atomicStore(&spectralImage[indices.x], temp.x);
            // atomicStore(&spectralImage[indices.y], temp.y);
        }
        if globalId.y == 2 {
            // id
            var temp = getId(index);
            var indices: vec2u = idIndex(coords.xy);
            atomicStore(&spectralImage[indices.x], temp.x);
            atomicStore(&spectralImage[indices.y], temp.y);
        }

        if globalId.y == 3 {
            // node id
            atomicStore(&spectralImage[starListNodeIdIndex(coords.xy)], cacheInfo[gpuOffsetIndex].nodeId + 1);
        }
    }
}