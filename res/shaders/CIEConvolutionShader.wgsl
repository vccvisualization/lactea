@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var<storage, read_write> spectralImage: array<u32>;
@group(0) @binding(2) var<storage> nodes: array<Node>;
@group(0) @binding(3) var<storage, read_write> outputSpectrum: array<atomic<u32>>;

@group(2) @binding(0) var<storage, read_write> hdrImage: array<atomic<u32>>;


// plank's law
const c1: f32 = 1.1910429723971884e-25;
const c2: f32 = 0.014387768775039337;
const clight: f32 = 299792458.;

// spectrum to color: cie


const dlambda: f32 = 10;
const tf_length: u32 = 41;
const CIE_Y_integral = 106.856895;
const scale = dlambda / CIE_Y_integral;

const cie = array(
    2.952420E-03, 4.076779E-04, 1.318752E-02,
    1.879338E-02, 2.589775E-03, 8.508254E-02,
    8.277331E-02, 1.041303E-02, 3.832822E-01,
    2.077647E-01, 2.576133E-02, 9.933444E-01,
    3.281798E-01, 4.698226E-02, 1.624940E+00,
    4.026189E-01, 7.468288E-02, 2.075946E+00,
    3.932139E-01, 1.039030E-01, 2.128264E+00,
    3.013112E-01, 1.414586E-01, 1.768440E+00,
    1.914176E-01, 1.999859E-01, 1.310576E+00,
    7.593120E-02, 2.682271E-01, 7.516389E-01,
    1.400745E-02, 3.554018E-01, 3.978114E-01,
    5.652072E-03, 4.780482E-01, 2.078158E-01,
    3.778185E-02, 6.248296E-01, 8.852389E-02,
    1.201511E-01, 7.788199E-01, 3.784916E-02,
    2.380254E-01, 8.829552E-01, 1.539505E-02,
    3.841856E-01, 9.665325E-01, 6.083223E-03,
    5.374170E-01, 9.907500E-01, 2.323578E-03,
    7.123849E-01, 9.944304E-01, 8.779264E-04,
    8.933408E-01, 9.640545E-01, 3.342429E-04,
    1.034327E+00, 8.775360E-01, 1.298230E-04,
    1.147304E+00, 7.869950E-01, 5.207245E-05,
    1.148163E+00, 6.629035E-01, 2.175998E-05,
    1.048485E+00, 5.282296E-01, 9.530130E-06,
    8.629581E-01, 3.950755E-01, 0.000000E+00,
    6.413984E-01, 2.751807E-01, 0.000000E+00,
    4.323126E-01, 1.776882E-01, 0.000000E+00,
    2.714900E-01, 1.083996E-01, 0.000000E+00,
    1.538163E-01, 6.033976E-02, 0.000000E+00,
    8.281010E-02, 3.211852E-02, 0.000000E+00,
    4.221473E-02, 1.628841E-02, 0.000000E+00,
    2.025590E-02, 7.797457E-03, 0.000000E+00,
    9.816228E-03, 3.776140E-03, 0.000000E+00,
    4.666298E-03, 1.795595E-03, 0.000000E+00,
    2.205568E-03, 8.499903E-04, 0.000000E+00,
    1.061495E-03, 4.098928E-04, 0.000000E+00,
    5.153113E-04, 1.994949E-04, 0.000000E+00,
    2.556624E-04, 9.931439E-05, 0.000000E+00,
    1.287394E-04, 5.018934E-05, 0.000000E+00,
    6.577532E-05, 2.573083E-05, 0.000000E+00,
    3.407653E-05, 1.337946E-05, 0.000000E+00,
    1.794555E-05, 7.074424E-06, 0.000000E+00
);


fn planck(t: f32, w: f32) -> f32 {
    return c1 * pow(w * 1e-9, -5.0) / (exp(c2 / (1e-9 * w * t)) - 1.);
}


const wgsizeX : u32 = 256;


var<workgroup> sdata: array<array<f32, 3>, wgsizeX>;
var<workgroup> temp: f32;

@compute
@workgroup_size(256, 1, 1)
fn computeMain(@builtin(global_invocation_id) globalId: vec3u, @builtin(workgroup_id) group_id: vec3u, @builtin(local_invocation_id) local_id: vec3u) {

    // indexing
    var tx: u32 = local_id.x;

    let i = globalId.y;
    let j = globalId.z;
    let wl = CIE_START + globalId.x;

    let cie_i = u32(f32(globalId.x) / f32(CIE_BINS) * f32(tf_length - 1)); 

    let coord = vec2u(i, j);
    
    if tx == 0 {
        if camera.colormapStrategy == Temperature_BP_RP {

            var bp = getPhotBP(coord);
            var rp = getPhotRP(coord);
            
            // approx temperature from BP-RP
            temp = getApproxTemp(bp, rp);
        } else if camera.colormapStrategy == Temperature {
            let density = getTemperatureCount(coord);
            temp = getTemperature(coord);
            temp /= density;
        }
    }
    workgroupBarrier();

    // load data
    var flux = 0.;
    if camera.colormapStrategy == CIE {
        flux = select(0.0, getFlux(vec3u(coord, wl), true), i < camera.width && j < camera.height && wl <= CIE_END);
    } else {
        flux = select(0.0, planck(temp, mapIdxToWavelength(wl)), i < camera.width && j < camera.height && wl <= CIE_END && temp > 0 && temp == temp); // nan check
    }

    sdata[tx][0] = flux * cie[3 * cie_i + 0];
    sdata[tx][1] = flux * cie[3 * cie_i + 1];
    sdata[tx][2] = flux * cie[3 * cie_i + 2];
    workgroupBarrier();


    for (var s: u32 = u32(wgsizeX / 2); s > 0; s >>= 1) {
        if tx < s {
            sdata[tx][0] += sdata[tx + s][0];
            sdata[tx][1] += sdata[tx + s][1];
            sdata[tx][2] += sdata[tx + s][2];
        }
        workgroupBarrier();
    }

    if tx == 0 {
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 0))], floatToPacked(sdata[tx][0]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 1))], floatToPacked(sdata[tx][1]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 2))], floatToPacked(sdata[tx][2]));
        atomicAddPacked(&hdrImage[hdrImageIndex(vec3u(i, j, 3))], floatToPacked(getFluxSum(coord)));
    }
}