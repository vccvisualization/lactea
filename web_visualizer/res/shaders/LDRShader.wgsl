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
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(0) var colormapSampler: sampler;
@group(1) @binding(1) var colormap: texture_1d<f32>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<u32>;


fn sigmoidv(val: vec4f) -> vec4f {
    return 1. / (1. + exp(-10 * (val - 0.5)));
}

fn sigmoidf(val: f32) -> f32 {
    return 1. / (1. + exp(-10 * (val - 0.5)));
}

fn logCompressf(val: f32) -> f32 {
    return log(1. + val) / log(2);
}

fn logCompressv(val: vec4f) -> vec4f {
    return log(1. + val) / log(2);
}

@fragment
fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
    let texcoord = vec2u(fsInput.texcoord * vec2f(vec2u(camera.width, camera.height)));
    
    let tex = loadTexPacked(&hdrImage, vec2u(texcoord.x, texcoord.y));
    if camera.colormapStrategy == StarListNodeId || camera.colormapStrategy == PatchNodeId {
        return tex;
    }
    var val = tex.rgb;

    var maxVal = vec3f(0);
    var minVal = vec3f(0);

    // maxVal.g = packedToFloat(outputSpectrum[G_MAX_OFFSET]);
    // minVal.g = packedToFloat(outputSpectrum[G_MIN_OFFSET]);
    
    // maxVal.r = packedToFloat(outputSpectrum[R_MAX_OFFSET]);
    // minVal.r = packedToFloat(outputSpectrum[R_MIN_OFFSET]);

    // maxVal.b = packedToFloat(outputSpectrum[B_MAX_OFFSET]);
    // minVal.b = packedToFloat(outputSpectrum[B_MIN_OFFSET]);

    maxVal.g = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_G_MAX_OFFSET]));
    minVal.g = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_G_MIN_OFFSET]));
    
    maxVal.r = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_R_MAX_OFFSET]));
    minVal.r = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_R_MIN_OFFSET]));

    maxVal.b = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_B_MAX_OFFSET]));
    minVal.b = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_B_MIN_OFFSET]));

    var maxVal_a = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_A_MAX_OFFSET]));
    var minVal_a = packedToFloat(atomicLoad(&outputSpectrum[PERCENTILE_A_MIN_OFFSET]));


    var ldr = vec4f(0);

    if camera.colormapStrategy == CIE ||
        camera.colormapStrategy == Temperature_BP_RP ||
        camera.colormapStrategy == Temperature 
    {
        val = transpose(M) * val;
        val = val / max(max(val.x, val.y), val.z);

        var alpha: f32 = tex.a;
        if camera.normalizationStrategy == normalizationLog10 {
            alpha = log10(maxVal_a - minVal_a) / log10(alpha - minVal_a);
        } else if camera.normalizationStrategy == normalizationLoglinear {
            alpha = (log10(alpha) - log10(minVal_a)) / (log10(maxVal_a) - log10(minVal_a));
            
        } else if camera.normalizationStrategy == normalizationLinear || camera.normalizationStrategy == normalizationGammaCorrection {
            alpha = (alpha - minVal_a) / (maxVal_a - minVal_a);
            if camera.normalizationStrategy == normalizationGammaCorrection {
                alpha = pow(alpha, 1/camera.gammaCorrection);
            }
        } else {
            alpha = 1;
        }

        alpha = clipf(alpha, 0., 1.);

        if camera.tonemappingStrategy == tonemappingSigmoid {
            alpha = sigmoidf(alpha);
        }
        if camera.tonemappingStrategy == tonemappingLogCompression {
            alpha = logCompressf(alpha);
        }

        ldr = vec4f(val, 1) * alpha;
    }

    if camera.colormapStrategy == Wavelength {
        val = val / tex.a;

        var alpha: f32 = tex.a;
        if camera.normalizationStrategy == normalizationLog10 {
            alpha = log10(maxVal_a - minVal_a) / log10(alpha - minVal_a);
        } else if camera.normalizationStrategy == normalizationLoglinear {
            alpha = (log10(alpha) - log10(minVal_a)) / (log10(maxVal_a) - log10(minVal_a));
            
        } else if camera.normalizationStrategy == normalizationLinear || camera.normalizationStrategy == normalizationGammaCorrection {
            alpha = (alpha - minVal_a) / (maxVal_a - minVal_a);
            if camera.normalizationStrategy == normalizationGammaCorrection {
                alpha = pow(alpha, 1/camera.gammaCorrection);
            }
        } else {
            alpha = 1;
        }

        alpha = clipf(alpha, 0., 1.);

        if camera.tonemappingStrategy == tonemappingSigmoid {
            alpha = sigmoidf(alpha);
        }
        if camera.tonemappingStrategy == tonemappingLogCompression {
            alpha = logCompressf(alpha);
        }
        ldr = vec4f(val, 1) * alpha;
    }

    if camera.colormapStrategy == Photometry || camera.colormapStrategy == HubblePaletteSHO || camera.colormapStrategy == HubblePaletteHOO {
        let exists = f32(val.r != 0 || val.g != 0 || val.b != 0);
        var c = vec3f(0);

        if camera.normalizationStrategy == normalizationLog10 {
            if camera.colormapStrategy == Photometry {
                c =  log10v(val - minVal) / log10v(maxVal - minVal);
            } else {
                c =  log10v(maxVal - minVal) / log10v(val - minVal);
            }
        } 
        else if camera.normalizationStrategy == normalizationLoglinear {
            if camera.colormapStrategy == Photometry {
                val = fluxToMagv(val);
                maxVal = fluxToMagv(maxVal);
                minVal = fluxToMagv(minVal);
            }
            else {
                val = log10v(val);
                maxVal = log10v(maxVal);
                minVal = log10v(minVal);
            }
            c = (val - minVal) / (maxVal - minVal);
        } 
        else if camera.normalizationStrategy == normalizationLinear || camera.normalizationStrategy == normalizationGammaCorrection {
            c = (val - minVal) / (maxVal - minVal);
            if camera.normalizationStrategy == normalizationGammaCorrection {
                c.x = pow(c.x, 1/camera.gammaCorrection);
                c.y = pow(c.y, 1/camera.gammaCorrection);
                c.z = pow(c.z, 1/camera.gammaCorrection);
            }
        } 
        
        c = clipv(c, 0., 1.);

        ldr = vec4f(c * exists, 1);

        if camera.tonemappingStrategy == tonemappingSigmoid {
            ldr = sigmoidv(ldr);
        }
        if camera.tonemappingStrategy == tonemappingLogCompression {
            ldr = logCompressv(ldr);
        }
        ldr = ldr * exists;
    }

    if camera.colormapStrategy == Density ||
        camera.colormapStrategy == PhotometryBp ||
        camera.colormapStrategy == PhotometryRp ||
        camera.colormapStrategy == PhotometryG ||
        camera.colormapStrategy == Intensity ||
        camera.colormapStrategy == HAlpha  ||
        camera.colormapStrategy == Integrate
    {
        let exists = f32(val.r != 0);
        let zero = val.g;
        var alpha: f32 = 0;
        if camera.normalizationStrategy == normalizationLog10 {
            if(camera.colormapStrategy == Intensity || 
                camera.colormapStrategy == HAlpha ||
                camera.colormapStrategy == Integrate
            ) {
                alpha = log10(maxVal.r - minVal.r) / log10(val.r - minVal.r);
            } else {
                alpha = log10(val.r - minVal.r) / log10(maxVal.r - minVal.r);
            }
        } else if camera.normalizationStrategy == normalizationLoglinear {
            if camera.colormapStrategy == Density 
            || camera.colormapStrategy == Intensity 
            || camera.colormapStrategy == HAlpha 
            || camera.colormapStrategy == Integrate
            {
                alpha = (log10(val.r) - log10(minVal.r)) / (log10(maxVal.r) - log10(minVal.r));
            } else {
                let a = fluxToMag(val.r, zero);
                let minAlpha = fluxToMag(minVal.r, zero);
                let maxAlpha = fluxToMag(minVal.r, zero);
                alpha = (a - minAlpha) / (maxAlpha - minAlpha);
            }
        } else if camera.normalizationStrategy == normalizationLinear || camera.normalizationStrategy == normalizationGammaCorrection {
            alpha = (val.r - minVal.r) / (maxVal.r - minVal.r);
            if camera.normalizationStrategy == normalizationGammaCorrection {
                alpha = pow(alpha, 1/camera.gammaCorrection);
            }
        }

        alpha = clipf(alpha, 0., 1.);

        if camera.tonemappingStrategy == tonemappingSigmoid {
            alpha = sigmoidf(alpha);
        }
        if camera.tonemappingStrategy == tonemappingLogCompression {
            alpha = logCompressf(alpha);
        }
        alpha = alpha * exists;
        ldr = vec4f(textureSample(colormap, colormapSampler, alpha));
    }

    return ldr;
}