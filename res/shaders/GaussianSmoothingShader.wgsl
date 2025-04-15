@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(1) @binding(0) var ldrTex: texture_2d<f32>;
@group(1) @binding(1) var postprocessTex: texture_storage_2d<rgba8unorm, write>;


@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {
    let x = globalId.x;
    let y = globalId.y;

    if (x >= camera.width || y >= camera.height) { return; }


    var c = vec4f(0.0);
    var sum = 0.0;
    
    for(var i : i32 = -i32(camera.gaussianKernelSize)/2; i <= i32(camera.gaussianKernelSize)/2; i++) {
        let k: f32 = gaussian1D(i, camera.gaussianSigma);
        
        var index = vec2u(0);
        if HORIZONTAL {
            index = vec2u(u32(i32(x) + i), y);
        } else {
            index = vec2u(x, u32(i32(y) + i));
        }
        let color = textureLoad(ldrTex, index, 0);
        
        c += color * k;
        sum += k;
    }

    c /= sum;

    textureStore(postprocessTex, vec2u(x, y), c);
}