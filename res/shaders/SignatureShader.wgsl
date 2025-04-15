struct VertexShaderOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
};

@vertex
fn vs(
    @builtin(vertex_index) vertexIndex: u32
) -> VertexShaderOutput {
    let pos = array(
    // 1st triangle
        vec2f(0.0, 0.0),  // center
        vec2f(1.0, 0.0),  // right, center
        vec2f(0.0, 1.0),  // center, top

    // 2st triangle
        vec2f(0.0, 1.0),  // center, top
        vec2f(1.0, 0.0),  // right, center
        vec2f(1.0, 1.0),  // right, top
    );

    var vsOutput: VertexShaderOutput;
    let xy = pos[vertexIndex];
    vsOutput.position = vec4f(xy * 2 - 1, 0.0, 1.0);

    vsOutput.texcoord = xy;
    return vsOutput;
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(0) var ourSampler: sampler;
@group(1) @binding(1) var ourTexture: texture_1d<f32>;

// @group(3) @binding(0) var<storage, read_write> signatures: array<f32>;
// @group(3) @binding(1) var<storage, read_write> signatureDescriptor: array<SignatureDescriptor>;


fn getSignature(signature: u32, line: u32) -> u32 {
    let offset = signatureDescriptor[signature].offset + 1 + line;
    return u32(signatures[offset]);
}

fn isEmission(signature: u32, line: u32) -> u32 {
    let offset = signatureDescriptor[signature].offset;
    return u32(signatures[offset]);
}


fn getFlux(texcoord: vec2u, k: u32) -> f32 {
    let indices: vec2u = spectrumIndex(vec3u(texcoord, k));
    return fixedToFlux(vec2u(spectralImage[indices.x], spectralImage[indices.y]));   
}

fn centralDiff(texcoord: vec2u, k: i32) -> f32 {
    let x_j = getFlux(texcoord, u32(k+1));
    let x_i = getFlux(texcoord, u32(k-1));
    return (x_j - x_i) / (2 * H);
}


@fragment
fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
    let texcoord = vec2u(fsInput.texcoord * vec2f(vec2u(camera.width, camera.height)));

    var val: f32 = 0;
    var isMatch = true;

    for(var i: u32 = 0; i < camera.signatureCount; i++) {
        var flux: f32 = 0;
        for (var j: u32 = 0; j < signatureDescriptor[i].length; j++) {
            let wl: u32 = getSignature(i, j);
            
            // ignore edges
            // TODO: forward/backward difference
            let min_wl = clamp(i32(wl) - i32(camera.errorRange), i32(1), i32(BINS)-3);
            let max_wl = clamp(i32(wl) + i32(camera.errorRange), i32(1), i32(BINS)-3);
            var isFound = false;
            for(var k = min_wl; k <= max_wl; k++) {
                let dflux = centralDiff(texcoord, k);
                let dflux_after = centralDiff(texcoord, k+1);

                if(isEmission(i, j) == 1) { // maxima/emission
                    let local_maxima = (dflux > 0) && (dflux_after < 0);
                    if(local_maxima) {isFound = true;}
                    // isFound = select(true, false, local_maxima);
                } else {
                    let local_minima = (dflux < 0) && (dflux_after > 0);
                    // isFound = select(true, false, local_minima);
                    if(local_minima) {isFound = true;}
                }
            }

            if(isFound) {
                flux += getFlux(texcoord, wl);
            }
            else {
                isMatch = false;
            }
        }
        val += flux;
    }


    // intensity-based shading
    let indicies: vec2u = fluxSumIndex(texcoord);
    val = fixedToFlux(vec2u(spectralImage[indicies.x], spectralImage[indicies.y]));

    let exists = f32(val != 0 && isMatch == true);
    var maxVal: f32 = 0;
    var minVal: f32 = 0;

    // flux sum
    maxVal = f32(outputSpectrum[FLUX_MAX_OFFSET]) * 1e-20;
    minVal = f32(outputSpectrum[FLUX_MIN_OFFSET]) * 1e-20;


    var alpha: f32 = 0;
    if camera.normalizationStrategy == normalizationLog10 {
        alpha = log10(maxVal - minVal) / log10(val - minVal);
    } else if camera.normalizationStrategy == normalizationMag {
        alpha = (log10(val) - log10(minVal)) / (log10(maxVal) - log10(minVal));
    } else if camera.normalizationStrategy == normalizationLinear {
        alpha = (val - minVal) / (maxVal - minVal);
    }
    return textureSample(ourTexture, ourSampler, alpha) * exists;
}