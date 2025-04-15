@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;


@compute
@workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u) {
    var start_x = camera.cursor_x;
    var start_y = camera.cursor_y;

    let i = u32(start_x);
    let j = u32(start_y);
    let k = globalId.x;

    if(k >= DEPTH) { return; }

    let index = vec3u(i, j, k);

    if (k < BINS_TOTAL) { // combined spectra: stars + patches
        atomicStore(&outputSpectrum[k], floatToPacked(getFlux(index, false)));
    }
    else if(k == DENSITY_OFFSET) { // density
        atomicStore(&outputSpectrum[k], floatToPacked(getCount(index.xy)));
    }
    else {
        atomicStore(&outputSpectrum[k], spectralImage[spectrumIndex(index)]);
    }
}