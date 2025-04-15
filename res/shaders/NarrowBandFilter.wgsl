@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<atomic<u32>>;


const wgsizeX : u32 = 256;


var<workgroup> sdata: array<f32, wgsizeX>;
var<workgroup> filtered: array<array<f32, 3>, wgsizeX>;


@compute
@workgroup_size(wgsizeX, 1, 1)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {

    // indexing
    var tx: u32 = local_id.x;

    let i = globalId.y;
    let j = globalId.z;
    var wl = globalId.x;

    let coord = vec2u(i, j);
    
    sdata[tx] = select(0.0, getFlux(vec3u(coord, wl), true), i < camera.width && j < camera.height && wl < BINS);
    workgroupBarrier();

    // compute continuum
    var continuum: f32 = 0;
    var kernelSum: f32 = 0;
    if camera.subtractContinuum > 0 {
        continuum = 1e-20;
        for (var k: i32 = -i32(camera.continuumKernelSize)/2; k <= i32(camera.continuumKernelSize)/2; k++) {
            let neighborIdx = i32(tx) + k;
            let weight = gaussian1D(k, camera.continuumSigma);
            let e = select(0.0, sdata[u32(neighborIdx)], i < camera.width && j < camera.height && neighborIdx < i32(wgsizeX) && neighborIdx >= 0);
            continuum += e * weight;
            kernelSum += weight;

        }
        continuum /= kernelSum;
    }
    
    // narrowband filter
    var x = mapIdxToWavelength(wl);
    var flux = sdata[tx];
    var y = vec3f(0);

    if(camera.subtractContinuum > 0) { 
        flux = max(0, flux - continuum); 
    }

    if camera.colormapStrategy == Integrate {
        filtered[tx][0] = flux;
    } 
    else if camera.colormapStrategy == HAlpha {
        filtered[tx][0] = flux * centralGaussian(x, 656, camera.narrowBandSigma);
    } 
    else if camera.colormapStrategy == HubblePaletteSHO {
        // SII
        filtered[tx][0] = flux * centralGaussian(x, 673, camera.narrowBandSigma);
        // HALPHA
        filtered[tx][1] = flux * centralGaussian(x, 656, camera.narrowBandSigma);
        // OIII
        filtered[tx][2] = flux * centralGaussian(x, 500.7, camera.narrowBandSigma);
    }

    else if camera.colormapStrategy == HubblePaletteHOO {
        // HALPHA
        filtered[tx][0] = flux * centralGaussian(x, 656, camera.narrowBandSigma);
        // OIII
        filtered[tx][1] = flux * centralGaussian(x, 500.7, camera.narrowBandSigma);
    }

    workgroupBarrier();

    // integrate
    for (var s: u32 = u32(wgsizeX / 2); s > 0; s >>= 1) {
        if tx < s {
            filtered[tx][0] += filtered[tx + s][0];
            if camera.colormapStrategy == HubblePaletteSHO {
                filtered[tx][1] += filtered[tx + s][1];
                filtered[tx][2] += filtered[tx + s][2];
            }
            if camera.colormapStrategy == HubblePaletteHOO {
                filtered[tx][1] += filtered[tx + s][1];
            }
        }
        workgroupBarrier();
    }
    
    // save results
    if tx == 0 {
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 0))], floatToPacked(filtered[tx][0]));
        if camera.colormapStrategy == HubblePaletteSHO {
            atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 1))], floatToPacked(filtered[tx][1]));
            atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 2))], floatToPacked(filtered[tx][2]));
        }
        if camera.colormapStrategy == HubblePaletteHOO {
            atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 1))], floatToPacked(filtered[tx][1]));
            atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 2))], floatToPacked(filtered[tx][1]));
        }
    }
}

// @fragment
// fn fs(fsInput: VertexShaderOutput) -> @location(0) vec4f {
//     var c = vec3f(0);
//     let texcoord = vec2u(fsInput.texcoord * vec2f(vec2u(camera.width, camera.height)));
    
//     let patchIndex = spectralImage[patchIdIndex(texcoord)];
//     let nodeCount = f32(outputSpectrum[patchIdCountIdx(patchIndex-1)]);

//     var x0 = mapIdxToWavelength(0);
//     var enegry = getFlux(vec3u(texcoord, 0), true);
//     var SII = gaussian(x0, 673, 5);
//     var HALPHA = gaussian(x0, 656, 5);
//     var OIII = gaussian(x0, 500.7, 5);
//     var y0 = enegry * vec3f(SII, HALPHA, OIII);
//     // integrate with the trapezoidal rule for better accuracy
//     for (var wl: u32 = 1; wl < BINS; wl++) {

//         var x1 = mapIdxToWavelength(wl);
//         enegry = getFlux(vec3u(texcoord, wl), true);
//         SII = gaussian(x1, 673, 5);
//         HALPHA = gaussian(x1, 656, 5);
//         OIII = gaussian(x1, 500.7, 5);
//         var y1 = enegry * vec3f(SII, HALPHA, OIII);
//         c.x += integrate(x0, x1, y0.x, y1.x);
//         c.y += integrate(x0, x1, y0.y, y1.y);
//         c.z += integrate(x0, x1, y0.z, y1.z);
//         x0 = x1;
//         y0 = y1;
//     }

//     return vec4f(c, 1);
// }