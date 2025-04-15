@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<u32>;


@compute
@workgroup_size(8)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    // indexing
    let tx = globalId.x;

    var globalMin: f32;
    var globalMax: f32;
    var totalCount: u32;

    if tx >= 8 { return; }

    var k: u32;
    
    if tx == 0 {
        k = PERCENTILE_R_MAX_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[R_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[R_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[R_COUNT_OFFSET]);
    }
    if tx == 1 {
        k = PERCENTILE_G_MAX_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[G_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[G_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[G_COUNT_OFFSET]);
    }
    if tx == 2 {
        k = PERCENTILE_B_MAX_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[B_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[B_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[B_COUNT_OFFSET]);
    }
    if tx == 3 {
        k = PERCENTILE_A_MAX_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[A_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[A_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[A_COUNT_OFFSET]);
    }
    if tx == 4 {
        k = PERCENTILE_R_MIN_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[R_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[R_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[R_COUNT_OFFSET]);
}
    if tx == 5 {
        k = PERCENTILE_G_MIN_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[G_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[G_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[G_COUNT_OFFSET]);
    }
    if tx == 6 {
        k = PERCENTILE_B_MIN_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[B_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[B_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[B_COUNT_OFFSET]);
    }
    if tx == 7 {
        k = PERCENTILE_A_MIN_OFFSET;
        globalMax = packedToFloat(atomicLoad(&outputSpectrum[A_MAX_OFFSET]));
        globalMin = packedToFloat(atomicLoad(&outputSpectrum[A_MIN_OFFSET]));
        totalCount = atomicLoad(&outputSpectrum[A_COUNT_OFFSET]);
    }

    if tx < 4 && camera.maxPercentile == 1 {
        atomicStore(&outputSpectrum[k], floatToPacked(globalMax));
        return;
    }
    if tx >= 4 && camera.minPercentile == 0 {
        atomicStore(&outputSpectrum[k], floatToPacked(globalMin));
        return;
    }
    var targetCount: u32;
    
    if tx < 4 {
        targetCount = u32(f32(totalCount) * camera.maxPercentile);
    } else {
        targetCount = u32(f32(totalCount) * camera.minPercentile);
    }

    var count: u32 = 0;

    for (var bin: u32 = 0; bin < IMAGE_HIST_BIN_SIZE / 4; bin++) {
        count += atomicLoad(&outputSpectrum[imageHistIdx(bin, tx % 4)]);

        let val = exp(f32(bin) / f32(IMAGE_HIST_BIN_SIZE/4 - 1) * (log(globalMax) - log(globalMin)) + log(globalMin));


        if (count >= targetCount) {
            atomicStore(&outputSpectrum[k], floatToPacked(val));
            return;
        }
    }
}