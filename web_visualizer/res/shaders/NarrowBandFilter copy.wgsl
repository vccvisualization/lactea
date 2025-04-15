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

@group(1) @binding(0) var ourSampler: sampler;
@group(1) @binding(1) var ourTexture: texture_1d<f32>;


@fragment
fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
    var c = vec4f(0);
    let texcoord = vec2u(fsInput.texcoord * vec2f(vec2u(camera.width, camera.height)));
    
    var x0 = mapIdxToWavelength(0);
    var enegry = getFlux(vec3u(texcoord, 0), true);
    var transmision = gaussian(x0, 656.2, 5);
    var y0 = enegry * transmision;
    // integrate with the trapezoidal rule for better accuracy
    for (var wl: u32 = 1; wl < BINS; wl++) {

        var x1 = mapIdxToWavelength(wl);
        enegry = getFlux(vec3u(texcoord, wl), true);
        transmision = gaussian(x1, 656.2, 5);
        var y1 = enegry * transmision;
        c.r += integrate(x0, x1, y0, y1);
        x0 = x1;
        y0 = y1;
    }

    return vec4f(c);
}