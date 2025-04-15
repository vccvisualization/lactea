@group(0) @binding(0) var<storage> starsL1: array<Star>;
@group(0) @binding(1) var<storage> starsL2: array<Star>;
@group(0) @binding(2) var<storage> gpuOffsets: array<u32>;
@group(0) @binding(3) var<storage> gpuLengths: array<u32>;
@group(0) @binding(4) var<storage> gpuLevels: array<u32>;

@group(1) @binding(0) var<uniform> camera: Camera;
@group(1) @binding(1) var<storage, read_write> spectralImage: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> signatures: array<f32>;
@group(2) @binding(1) var<storage, read_write> signatureDescriptor: array<SignatureDescriptor>;



fn getIndex(index: u32) -> vec2u {
    let chunkSize = (camera.starCount / camera.starGpuOffsetLength);
    let indexInsideChunk = index % chunkSize;
    let gpuOffsetIndex = u32(f32(index + camera.starTask * camera.starTaskSize) / f32(chunkSize));
    let gpuOffset = gpuOffsets[gpuOffsetIndex] / (4 * STAR_STRIDE); // bytes to element
    return vec2u(gpuOffset + indexInsideChunk, gpuLevels[gpuOffsetIndex]);
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

fn getU64(index: vec2u, i: u32) -> vec2u {
    return vec2u(getStar(index).data[2 * i], getStar(index).data[2 * i + 1]);
}


fn getSignature(signature: u32, line: u32) -> u32 {
    let offset = signatureDescriptor[signature].offset + 1 + line;
    return u32(signatures[offset]);
}

fn isEmission(signature: u32, line: u32) -> u32 {
    let offset = signatureDescriptor[signature].offset;
    return u32(signatures[offset]);
}


fn getFluxHist(index: vec2u, i: u32) -> f32 {
    return fixedToFlux(getU64(index, i));
}

fn centralDiff(index: vec2u, k: i32) -> f32 {
    let x_j = getFluxHist(index, u32(k+1));
    let x_i = getFluxHist(index, u32(k-1));
    return (x_j - x_i) / (2 * H);
}

@compute
@workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u) {
    let gindex = globalId.x;
    if gindex >= camera.starCount || gindex >= camera.starTaskSize { return; }
    let chunkSize = (camera.starCount / camera.starGpuOffsetLength);
    let indexInsideChunk = gindex % chunkSize;
    let gpuOffsetIndex = u32(f32(gindex + camera.starTask * camera.starTaskSize) / f32(chunkSize));
    if indexInsideChunk >= gpuLengths[gpuOffsetIndex] { return; }

    let index = getIndex(gindex);
    
    // buffer access
    let position = getPosition(index);
    let coordinate = vec2f(position.x / 360.0, position.y / 180.0 + 0.5);

    // filter (if any)  
    var foundMatch = false;  
    for(var i: u32 = 0; i < camera.signatureCount; i++) {
        for (var j: u32 = 0; j < signatureDescriptor[i].length; j++) {
            let wl: u32 = getSignature(i, j);
            
            // ignore edges
            // TODO: forward/backward difference
            let min_wl = clamp(i32(wl) - i32(camera.errorRange), i32(1), i32(BINS)-3);
            let max_wl = clamp(i32(wl) + i32(camera.errorRange), i32(1), i32(BINS)-3);
            var isFound = false;
            for(var k = min_wl; k <= max_wl; k++) {
                let dflux = centralDiff(index, k);
                let dflux_after = centralDiff(index, k+1);

                if(isEmission(i, j) == 1) { // maxima/emission
                    let local_maxima = (dflux > 0) && (dflux_after < 0);
                    if(local_maxima) {isFound = true;}
                    // isFound = select(true, false, local_maxima);
                } else {
                    let local_minima = (dflux < 0) && (dflux_after > 0);
                    // isFound = select(true, false, local_minima);
                    if(local_minima) {isFound = true;}
                }
                // let extrima = local_minima || local_maxima;
                // isFound = select(true, false, extrima);
            }
            if(isFound) {
                foundMatch = true;
            }
        }
    }

    if(!foundMatch) { return; }
    // where to draw in screen
    var vPos = transformPos(coordinate).xy;
    vPos = 0.5 * vPos + 0.5;// [-1, 1] to [0, 1]
    if vPos.x > 1.0 || vPos.y > 1.0 || vPos.x < 0. || vPos.y < 0. { return; };
    var coords = vec3u(vec3f(vPos * vec2f(vec2u(camera.width, camera.height)), 0.0));// 0-1 to screen res
    
    var tempAvailable: u32 = 0;
    // accumulate spectra
    for (var wlIndex: u32 = 0; wlIndex < BINS_TOTAL; wlIndex++) {
        let floatE = getFluxHist(index, wlIndex);
        coords.z = wlIndex;
        // update histogram
        var b: vec2u = getU64(index, wlIndex);
        var fluxIndices: vec2u = spectrumIndex(coords);
        let oldValue = atomicAdd(&spectralImage[fluxIndices.y], b.y);
        atomicAdd(&spectralImage[fluxIndices.x], b.x + u32((oldValue + b.y) < b.y));

        // star temperature count
        if (wlIndex == TEMPERATURE_INDEX) && (b.x > 0 || b.y > 0) {
            tempAvailable = 1;
        }
    }

    // add star density
    atomicAdd(&spectralImage[densityIndex(coords.xy)], countToFixed(1));
    
    // star temperature count
    if tempAvailable == 1 {
        atomicAdd(&spectralImage[tempDensityIndex(coords.xy)], countToFixed(1));
    }

    // add id
    let id = getId(index);
    var indices: vec2u = idIndex(coords.xy);
    atomicStore(&spectralImage[indices.x], id.x);
    atomicStore(&spectralImage[indices.y], id.y);
}