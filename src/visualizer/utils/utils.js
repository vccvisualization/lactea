
import { LightSpectrum } from "../../lactea/LightSpectrum.js";
import { MinStar } from "../../lactea/MinStar.js";
import { Node } from "../../lactea/Node.js";
import { packedToFloat, SoftFloat } from "../../lactea/utils.js";

function toggleClass(id, c) {
    d3.selectAll(id).classed(c, d3.select(id).classed(c) ? false : true);
}
function applyClass(id, c) {
    d3.selectAll(id).classed(c, true);
}
function removeClass(id, c) {
    d3.selectAll(id).classed(c, false);
}

const downloadCanvas = (filename, canvas) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL()
    link.click();
}

const saveTemplateAsFile = (filename, dataObjToWrite) => {
    const blob = new Blob([JSON.stringify(dataObjToWrite)], { type: "text/json" });
    const link = document.createElement("a");

    link.download = filename;
    link.href = window.URL.createObjectURL(blob);
    link.dataset.downloadurl = ["text/json", link.download, link.href].join(":");

    const evt = new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
    });

    link.dispatchEvent(evt);
    link.remove();
};


const getJsonUpload = () =>
    new Promise(resolve => {
        const inputFileElement = document.createElement('input')
        inputFileElement.setAttribute('type', 'file')
        inputFileElement.setAttribute('accept', '.json')

        inputFileElement.addEventListener(
            'change',
            async (event) => {
                const { files } = event.target
                if (!files) {
                    return
                }

                const filePromises = [...files].map(file => file.text().then(text => JSON.parse(text)));

                resolve(await Promise.all(filePromises))
            },
            false,
        )
        inputFileElement.click()
    })

// spectrum (spectrax2, total energyx2, photometry, temperature, temp count), density, id x 2, node id, patch id x 10
const PATCH_ID_COUNT = 10;
const DEPTH = (LightSpectrum.NUM_BINS_TOTAL) + 1 + 2 * 1 + 1 + 1 * PATCH_ID_COUNT;
const H = (LightSpectrum.MAX_WAVELENGTH - LightSpectrum.MIN_WAVELENGTH) / LightSpectrum.NUM_BINS_BASE;
const IMAGE_HIST_BIN_SIZE = 100*4;
const EXTRA_LAYERS = 3*4 + 1 + 8 + IMAGE_HIST_BIN_SIZE; // min-max-count x (RGBA) + max density + approx min-max (RGBA)
const OUTPUT_DEPTH = DEPTH + EXTRA_LAYERS; // depth + image histogram 256 bins

const FLUX_SUM_OFFSET = LightSpectrum.TOTAL_ENERGY_INDEX; // [LightSpectrum.TOTAL_ENERGY_INDEX * 2, LightSpectrum.TOTAL_ENERGY_INDEX * 2 + 1];
const CORRECTED_FLUX_SUM_OFFSET = LightSpectrum.CORRECTED_TOTAL_ENERGY_INDEX; // [LightSpectrum.TOTAL_ENERGY_INDEX * 2, LightSpectrum.TOTAL_ENERGY_INDEX * 2 + 1];
const RP_OFFSET = LightSpectrum.RP_INDEX; // [LightSpectrum.RP_INDEX * 2, LightSpectrum.RP_INDEX * 2 + 1];
const G_OFFSET = LightSpectrum.G_INDEX; // [LightSpectrum.G_INDEX * 2, LightSpectrum.G_INDEX * 2 + 1];
const BP_OFFSET = LightSpectrum.BP_INDEX; // [LightSpectrum.BP_INDEX * 2, LightSpectrum.BP_INDEX * 2 + 1];
const TEMP_OFFSET = LightSpectrum.TEMPERATURE_INDEX; // [LightSpectrum.TEMPERATURE_INDEX * 2, LightSpectrum.TEMPERATURE_INDEX * 2 + 1];
const DENSITY_TEMP_OFFSET = LightSpectrum.TEMPERATURE_COUNT_INDEX; 

const DENSITY_OFFSET = DENSITY_TEMP_OFFSET + 1;
const ID_OFFSET = [DENSITY_OFFSET + 1, DENSITY_OFFSET + 2];

const STAR_LIST_NODE_ID_OFFSET = ID_OFFSET[1] + 1;
const PATCH_ID_0_OFFSET = STAR_LIST_NODE_ID_OFFSET + 1;


// extra layers
const DENSITY_MAX_OFFSET = PATCH_ID_0_OFFSET + PATCH_ID_COUNT;
const R_MAX_OFFSET = DENSITY_MAX_OFFSET + 1;
const G_MAX_OFFSET = R_MAX_OFFSET + 1;
const B_MAX_OFFSET = G_MAX_OFFSET + 1;
const A_MAX_OFFSET = B_MAX_OFFSET + 1;

const R_MIN_OFFSET = A_MAX_OFFSET + 1;
const G_MIN_OFFSET = R_MIN_OFFSET + 1;
const B_MIN_OFFSET = G_MIN_OFFSET + 1;
const A_MIN_OFFSET = B_MIN_OFFSET + 1;

const R_COUNT_OFFSET = A_MIN_OFFSET + 1;
const G_COUNT_OFFSET = R_COUNT_OFFSET + 1;
const B_COUNT_OFFSET = G_COUNT_OFFSET + 1;
const A_COUNT_OFFSET = B_COUNT_OFFSET + 1;

const PERCENTILE_R_MAX_OFFSET = A_COUNT_OFFSET + 1;
const PERCENTILE_G_MAX_OFFSET = PERCENTILE_R_MAX_OFFSET + 1;
const PERCENTILE_B_MAX_OFFSET = PERCENTILE_G_MAX_OFFSET + 1;
const PERCENTILE_A_MAX_OFFSET = PERCENTILE_B_MAX_OFFSET + 1;

const PERCENTILE_R_MIN_OFFSET = PERCENTILE_A_MAX_OFFSET + 1;
const PERCENTILE_G_MIN_OFFSET = PERCENTILE_R_MIN_OFFSET + 1;
const PERCENTILE_B_MIN_OFFSET = PERCENTILE_G_MIN_OFFSET + 1;
const PERCENTILE_A_MIN_OFFSET = PERCENTILE_B_MIN_OFFSET + 1;

const IMAGE_HIST_OFFSET = PERCENTILE_A_MIN_OFFSET + 1;


const G_ZERO = 25.6874;
const BP_ZERO = 25.3385;
const RP_ZERO = 24.7479;

const CIE_START = LightSpectrum.mapWavelengthToIdx(390.);
const CIE_END = LightSpectrum.mapWavelengthToIdx(790.);
const CIE_BINS = CIE_END - CIE_START + 1;

const A_G = [-0.0548755604162154, 0.4941094278755837, -0.8676661490190047,
-0.8734370902348850, -0.4448296299600112, -0.1980763734312015,
-0.4838350155487132, 0.7469822444972189, 0.4559837761750669];

const initMinMax = new Uint32Array([
    0xFF800000, 0xFF800000, 0xFF800000, 0xFF800000, 0xFF800000, 
    0x7F800000, 0x7F800000, 0x7F800000, 0x7F800000,
    0, 0, 0, 0
]).buffer;

const projections = {
    icrs: 0,
    gal: 1,
    sphere: 2,
    projection360: 3,
}

const include_shader = /* wgsl*/`
    struct Camera {
        width: u32,
        height: u32,

        colormapStrategy: u32,
        normalizationStrategy: u32,

        zoom: f32,
        offset_x: f32,
        offset_y: f32,

        cursor_x: u32,
        cursor_y: u32,
        cursor_x2: u32,
        cursor_y2: u32,

        proj: u32,
        area_selector: u32,

        r: f32,
        g: f32,
        b: f32,

        starCount: u32,
        starGpuOffsetLength: u32,

        nodeCount: u32,
        nodeBorderCount: u32,

        minPercentile: f32,
        maxPercentile: f32,

        tonemappingStrategy: u32,
        starTask: u32,
        starTaskSize: u32,
        nodeTask: u32,
        nodeTaskSize: u32,
        taskDepthStages: u32,
        
        extinction: u32,
        gaussianKernelSize: u32,
        gaussianSigma: f32,
        narrowBandSigma: f32,

        gammaCorrection: f32,
        isClip: u32,
        showPatches: u32,
        showStars: u32,

        subtractContinuum: u32,
        continuumKernelSize: u32,
        continuumSigma: f32,
        patchLevel: u32,

        // temp variables for alignment

        temp9: u32,
        temp10: u32,
        temp11: u32,
        temp12: u32,

        temp13: u32,
        temp14: u32,
        temp15: u32,
        temp16: u32,

        vpMat: mat4x4<f32>,
    };
    
    struct Star {
        idHigh: u32,
        idLow: u32,
        ra: f32,
        dec: f32,
        data: array<f32, ${LightSpectrum.NUM_BINS_TOTAL}>,
    }

    struct StarListInfo {
        nodeId: u32,
        offset: u32,
        length: u32,
        cacheLevel: u32,
    }
    
    struct Node {
        id: u32,
        starCount: u32,
        subStarCount: u32,
        boundingBox: array<f32, 4>,
        own: array<f32, ${LightSpectrum.NUM_BINS_TOTAL}>,
        sub: array<f32, ${LightSpectrum.NUM_BINS_TOTAL}>,
    }
    
    // struct SignatureDescriptor {
    //     offset: u32,
    //     length: u32
    // }

    struct SoftFloat {
        sign: i32,
        exponent: i32,
        mantissa: u32,
    };

    // for soft float
    const BIAS: i32 = ${SoftFloat.BIAS};
    const IMPLICIT_LEADING_ONE: u32 = ${SoftFloat.IMPLICIT_LEADING_ONE};
    
    const DEPTH: u32 = ${DEPTH};
    const OUTPUT_DEPTH: u32 = ${OUTPUT_DEPTH};
    const IMAGE_HIST_BIN_SIZE: u32 = ${IMAGE_HIST_BIN_SIZE};
    const BINS: u32 = ${LightSpectrum.NUM_BINS_BASE};
    const BINS_TOTAL: u32 = ${LightSpectrum.NUM_BINS_TOTAL};
    const CORRECTED_FLUX_OFFSET: u32 = ${LightSpectrum.CORRECTED_FLUX_INDEX};
    const H: f32 = ${H};
    const G_ZERO: f32 = ${G_ZERO};
    const BP_ZERO: f32 = ${BP_ZERO};
    const RP_ZERO: f32 = ${RP_ZERO};
    
    const DENSITY_OFFSET: u32 = ${DENSITY_OFFSET};
    const DENSITY_TEMP_OFFSET: u32 = ${DENSITY_TEMP_OFFSET};
    
    const FLUX_SUM_OFFSET: u32 = ${FLUX_SUM_OFFSET};
    const CORRECTED_FLUX_SUM_OFFSET: u32 = ${CORRECTED_FLUX_SUM_OFFSET};
    const ID_OFFSET: vec2u = vec2u(${ID_OFFSET[0]}, ${ID_OFFSET[1]});
    const RP_OFFSET: u32 = ${RP_OFFSET};
    const G_OFFSET: u32 = ${G_OFFSET};
    const BP_OFFSET: u32 = ${BP_OFFSET};
    const IMAGE_HIST_OFFSET: u32 = ${IMAGE_HIST_OFFSET};
    
    const TEMP_OFFSET: u32 = ${TEMP_OFFSET};
    
    const STAR_LIST_NODE_ID_OFFSET: u32 = ${STAR_LIST_NODE_ID_OFFSET};
    const PATCH_ID_0_OFFSET: u32 = ${PATCH_ID_0_OFFSET};
    const PATCH_ID_COUNT: u32 = ${PATCH_ID_COUNT};

    const DENSITY_MAX_OFFSET: u32 = ${DENSITY_MAX_OFFSET};
    const R_MAX_OFFSET : u32 = ${R_MAX_OFFSET};
    const G_MAX_OFFSET : u32 = ${G_MAX_OFFSET};
    const B_MAX_OFFSET : u32 = ${B_MAX_OFFSET};
    const A_MAX_OFFSET : u32 = ${A_MAX_OFFSET};

    const R_MIN_OFFSET : u32 = ${R_MIN_OFFSET};
    const G_MIN_OFFSET : u32 = ${G_MIN_OFFSET};
    const B_MIN_OFFSET : u32 = ${B_MIN_OFFSET};
    const A_MIN_OFFSET : u32 = ${A_MIN_OFFSET};

    const R_COUNT_OFFSET : u32 = ${R_COUNT_OFFSET};
    const G_COUNT_OFFSET : u32 = ${G_COUNT_OFFSET};
    const B_COUNT_OFFSET : u32 = ${B_COUNT_OFFSET};
    const A_COUNT_OFFSET : u32 = ${A_COUNT_OFFSET};

    const PERCENTILE_R_MAX_OFFSET : u32 = ${PERCENTILE_R_MAX_OFFSET};
    const PERCENTILE_G_MAX_OFFSET : u32 = ${PERCENTILE_G_MAX_OFFSET};
    const PERCENTILE_B_MAX_OFFSET : u32 = ${PERCENTILE_B_MAX_OFFSET};
    const PERCENTILE_A_MAX_OFFSET : u32 = ${PERCENTILE_A_MAX_OFFSET};

    const PERCENTILE_R_MIN_OFFSET : u32 = ${PERCENTILE_R_MIN_OFFSET};
    const PERCENTILE_G_MIN_OFFSET : u32 = ${PERCENTILE_G_MIN_OFFSET};
    const PERCENTILE_B_MIN_OFFSET : u32 = ${PERCENTILE_B_MIN_OFFSET};
    const PERCENTILE_A_MIN_OFFSET : u32 = ${PERCENTILE_A_MIN_OFFSET};

    const TOTAL_ENERGY_INDEX: u32 = ${LightSpectrum.TOTAL_ENERGY_INDEX};
    const CORRECTED_TOTAL_ENERGY_INDEX: u32 = ${LightSpectrum.CORRECTED_TOTAL_ENERGY_INDEX};
    const RP_INDEX: u32 = ${LightSpectrum.RP_INDEX};
    const G_INDEX: u32 = ${LightSpectrum.G_INDEX};
    const BP_INDEX: u32 = ${LightSpectrum.BP_INDEX};
    const TEMPERATURE_INDEX: u32 = ${LightSpectrum.TEMPERATURE_INDEX};
    const TEMPERATURE_COUNT_INDEX: u32 = ${LightSpectrum.TEMPERATURE_COUNT_INDEX};

    const STAR_STRIDE: u32 = ${MinStar.NUM_ATTR};
    const NODE_STRIDE: u32 = ${Node.NUM_ATTR};

    const A_G = mat3x3<f32>(${A_G});

    const M = mat3x3<f32>(3.240479, - 1.537150, - 0.498535,
        -0.969256, 1.875991, 0.041556,
        0.055648, - 0.204043, 1.057311);

    const PI = 3.14159265359;

    const CIE_START: u32 = ${CIE_START};
    const CIE_END: u32 = ${CIE_END};
    const CIE_BINS: u32 = ${CIE_BINS};

    fn imageIndex(cell: vec3u) -> u32 {
        return cell.x * DEPTH + cell.y * (camera.width) * DEPTH + cell.z;
    }

    fn hdrImageIndex(cell: vec3u) -> u32 {
        return cell.x * 4 + cell.y * (camera.width) * 4 + cell.z;
    }

    fn loadTexPacked(buffer: ptr<storage, array<u32>, read_write>, cell: vec2u) -> vec4f {
        return vec4f(
            packedToFloat(buffer[hdrImageIndex(vec3u(cell, 0))]),
            packedToFloat(buffer[hdrImageIndex(vec3u(cell, 1))]),
            packedToFloat(buffer[hdrImageIndex(vec3u(cell, 2))]),
            packedToFloat(buffer[hdrImageIndex(vec3u(cell, 3))]),
        );
    }

    fn spectrumIndex(cell: vec3u) -> u32 {
        return imageIndex(cell);
    }

    fn fluxSumIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, FLUX_SUM_OFFSET));
    }
    
    fn correctedFluxSumIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, CORRECTED_FLUX_SUM_OFFSET));
    }
    
    fn densityIndex(cell: vec2u) -> u32 {
        let cell3 = vec3u(cell,  DENSITY_OFFSET);
        return imageIndex(cell3);
    }
    
    fn tempDensityIndex(cell: vec2u) -> u32 {
        let cell3 = vec3u(cell, DENSITY_TEMP_OFFSET);
        return imageIndex(cell3);
    }

    fn idIndex(cell: vec2u) -> vec2u {
        return vec2u(imageIndex(vec3u(cell, ID_OFFSET[0])), imageIndex(vec3u(cell, ID_OFFSET[1])));
    }
    
    fn rpIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, RP_OFFSET));
    }
    
    fn gIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, G_OFFSET));
    }
    
    fn bpIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, BP_OFFSET));
    }

    fn starListNodeIdIndex(cell: vec2u) -> u32 {
        let cell3 = vec3u(cell, STAR_LIST_NODE_ID_OFFSET);
        return imageIndex(cell3);
    }

    fn patchIdIndex(cell: vec2u, level: u32) -> u32 {
        let cell3 = vec3u(cell, PATCH_ID_0_OFFSET + level);
        return imageIndex(cell3);
    }


    fn temperatureIndex(cell: vec2u) -> u32 {
        return imageIndex(vec3u(cell, TEMP_OFFSET));
    }
    
    fn patchIdCountIdx(index: u32) -> u32 {
        return OUTPUT_DEPTH + index;
    }

    fn imageHistIdx(index: u32, channel: u32) -> u32 {
        return IMAGE_HIST_OFFSET + IMAGE_HIST_BIN_SIZE / 4 * channel + index;
    }

    fn mapWavelengthToIdx(wl : f32) -> u32 {
        if (wl < 336 || wl > 1020) { // out of range
            return 9999;
        }
        return u32((wl - 336) * 0.5);
    }


    fn mapIdxToWavelength(idx : u32) -> f32 {
        return f32(idx) * 2. + 336.;
    }


    fn integrate(x_0: f32, x_1: f32, y_0: f32, y_1: f32) -> f32{
        return 0.5 * (y_0 + y_1) * (x_1 - x_0);
    }
    
    fn fluxToMag(flux: f32, zero: f32) -> f32 {
        return -2.5 * log10(flux) + zero;
    }

    fn fluxToMagv(flux: vec3f) -> vec3f {
        return  vec3f(fluxToMag(flux.r, RP_ZERO), fluxToMag(flux.g, G_ZERO), fluxToMag(flux.b, BP_ZERO));
    }

    fn magToFlux(mag: f32, zero: f32) -> f32 {
        return pow(10, (mag - zero) / -2.5);
    }

    fn getApproxTemp(bp: f32, rp: f32) -> f32 {
        let c_xp = fluxToMag(bp, BP_ZERO) - fluxToMag(rp, RP_ZERO);
        let approx_temp = 3.999 - 0.654 * c_xp + 0.709 * pow(c_xp, 2) - 0.316 * pow(c_xp, 3);
        return pow(10, approx_temp);
    }

    fn pack(soft: SoftFloat) -> u32 {
        // take a softfloat and pack it into a u32
        let exponent: u32 = u32(soft.exponent + BIAS);
        var mantissa: u32 = soft.mantissa;

        if (soft.exponent != -BIAS) {
            mantissa |= IMPLICIT_LEADING_ONE;
        }

        return (u32(soft.sign) << 31) | (exponent << 23) | (mantissa & 0x7FFFFF);
    }

    fn unpack(packed: u32) -> SoftFloat {
        // take a packed u32 and return softfloat
        let sign: i32 = i32((packed >> 31) & 0x1);
        let exponent: i32 = i32((packed >> 23) & 0xFF);
        var mantissa: u32 = packed & 0x7FFFFF;

        if (exponent != 0) {
            mantissa |= IMPLICIT_LEADING_ONE;
        }

        return SoftFloat(sign, exponent - BIAS, mantissa);
    }

    fn softTofloat(soft: SoftFloat) -> f32 {
        // pack
        let packed: u32 = pack(soft);
        // to bits
        return bitcast<f32>(packed);
    }

    fn floatToSoft(float: f32) -> SoftFloat {
        // float to bits
        let packed: u32 = bitcast<u32>(float);
        // make softfloat
        return unpack(packed);
    }
    
    fn packedToFloat(packed: u32) -> f32 {
        return softTofloat(unpack(packed));
    }

    fn floatToPacked(float: f32) -> u32 {
        return pack(floatToSoft(float));
    }

    fn softFloatAdd(a: SoftFloat, b: SoftFloat) -> SoftFloat {

        var a_m: u32 = a.mantissa;
        var b_m: u32 = b.mantissa;
        var a_e: i32 = a.exponent;
        var b_e: i32 = b.exponent;
    
        if (a_e > b_e) {
            let expDiff = u32(a_e - b_e);
            b_m >>= expDiff;
            b_e = a_e;
        } else if (a_e < b_e) {
            let expDiff = u32(b_e - a_e);
            a_m >>= expDiff;
            a_e = b_e;
        }
    
        var resultMantissa: u32;
        var resultSign: i32;
        if (a.sign == b.sign) {
            resultMantissa = a_m + b_m;
            resultSign = a.sign;
        } else {
            if (a_m > b_m) {
                resultMantissa = a_m - b_m;
                resultSign = a.sign;
            } else {
                resultMantissa = b_m - a_m;
                resultSign = b.sign;
            }
        }
    
        var resultExponent: i32 = a_e;
        if (resultMantissa >= (1 << 24)) {
            resultMantissa >>= 1;
            resultExponent += 1;
        } else if (resultMantissa < (1 << 23) && resultMantissa != 0) {
            while (resultMantissa < (1 << 23)) {
                resultMantissa <<= 1;
                resultExponent -= 1;
            }
        }
    
        return SoftFloat(resultSign, resultExponent, resultMantissa);
    }

    fn packedSoftAdd(a: u32, b: u32) -> u32 {
        return pack(softFloatAdd(unpack(a), unpack(b)));
    }


    fn atomicAddCAS(buffer: ptr<storage, atomic<u32>, read_write>, soft: SoftFloat) {

        var oldPacked: u32;
        var newPacked: u32;

        var i: u32 = 0;

        loop {
            // if(i > 10) { break; }
            oldPacked = atomicLoad(buffer);

            let oldSoft = unpack(oldPacked);
            let newSoft = softFloatAdd(oldSoft, soft);

            newPacked = pack(newSoft);

            let result = atomicCompareExchangeWeak(buffer, oldPacked, newPacked);

            if (result.old_value == oldPacked) {
                break;
            }
            i++;
        }
    }

    fn atomicAddFloat(buffer: ptr<storage, atomic<u32>, read_write>, value: f32) {
        atomicAddCAS(buffer, floatToSoft(value));
    }

    fn atomicAddPacked(buffer: ptr<storage, atomic<u32>, read_write>, packed: u32) {
        atomicAddCAS(buffer, unpack(packed));
    }


    fn softFloatMax(a: SoftFloat, b: SoftFloat) -> bool {
        // return true if a is larger than b
        return (a.sign < b.sign) || (a.sign == b.sign && a.exponent > b.exponent) || (a.sign == b.sign && a.exponent == b.exponent && a.mantissa > b.mantissa);
    }

    fn softFloatMin(a: SoftFloat, b: SoftFloat) -> bool {
        // return true if a is smaller than b
        return (a.sign > b.sign) || (a.sign == b.sign && a.exponent < b.exponent) || (a.sign == b.sign && a.exponent == b.exponent && a.mantissa < b.mantissa);
    }

    fn packedSoftMax(a: u32, b: u32) -> u32 {
        if(softFloatMax(unpack(a), unpack(b))) {
            return a;
        }
        return b;
    }

    fn packedSoftMin(a: u32, b: u32) -> u32 {
        if(softFloatMin(unpack(a), unpack(b))) {
            return a;
        }
        return b;
    }

    fn atomicMaxPacked(buffer: ptr<storage, atomic<u32>, read_write>, packed: u32) {
        let soft = unpack(packed);
        var oldPacked: u32;

        loop {
            oldPacked = atomicLoad(buffer);

            let oldSoft = unpack(oldPacked);

            if softFloatMax(soft, oldSoft) {  
                let result = atomicCompareExchangeWeak(buffer, oldPacked, packed);
                if result.old_value == oldPacked {
                    break;
                } 
            } else {
                break;
            }
        }
    }

    fn atomicMinPacked(buffer: ptr<storage, atomic<u32>, read_write>, packed: u32) {
        let soft = unpack(packed);
        var oldPacked: u32;

        loop {
            oldPacked = atomicLoad(buffer);

            let oldSoft = unpack(oldPacked);

            if softFloatMin(soft, oldSoft) {  
                let result = atomicCompareExchangeWeak(buffer, oldPacked, packed);
                if result.old_value == oldPacked {
                    break;
                } 
            } else {
                break;
            }
        }
    }


    fn isPackedZero(packed: u32) -> bool {
        return packed == 0x00000000 || packed == 0x80000000;
    }

    fn isPackedInf(packed: u32) -> bool {
        return packed == 0xFF800000 || packed == 0x7F800000;
    }

    fn log10(x: f32) -> f32 { 
        //  log10(x) = log(x) / log(10) = (1 / log(10)) * log(x)
        return (0.30102999566) * log(x);
    }

    fn log10v(x: vec3f) -> vec3f { 
        return vec3f(log10(x.r), log10(x.g), log10(x.b));
    }

    fn clipf(x: f32, low: f32, high: f32) -> f32 {
        if x < low { return low; }
        if x > high { return high; }
        return x;
    }

    fn clipv(x: vec3f, low: f32, high: f32) -> vec3f { 
        return vec3f(clipf(x.r, low, high), clipf(x.g, low, high), clipf(x.b, low, high));
    }

    fn clipRemovef(x: f32, low: f32, high: f32) -> f32 {
        if x < low { return 0; }
        if x > high { return 0; }
        return x;
    }

    fn clipRemovev(x: vec3f, low: f32, high: f32) -> vec3f { 
        return vec3f(clipRemovef(x.r, low, high), clipRemovef(x.g, low, high), clipRemovef(x.b, low, high));
    }

    // fn magToIndex(mag: u32) -> f32 { 
    //     // 10 bins, min is 1e-19 max is 1e-9        
    //     return log10(f32(mag)) * .1;
    // }
    fn icrs2gal(coordinate: vec2f) -> vec2f {
        // takes  [0, 1] icrs coord, return gal coord in rad

        var vPos = vec2f(0);

        // get alpha and gamma
        let p = vec2f(coordinate.x*2, coordinate.y - 0.5) * PI;
        let r_icrs = vec3f(
            cos(p.x) * cos(p.y),
            sin(p.x) * cos(p.y),
            sin(p.y)
        );
        
        let r_gal = A_G * r_icrs;
        
        vPos.x = atan2(r_gal.y, r_gal.x);
        vPos.x += select(0, 2 * PI, vPos.x < 0);
        vPos.y = atan2(r_gal.z, sqrt(pow(r_gal.x, 2) + pow(r_gal.y, 2)));
        return vPos;
    }

    fn transformPos(coord: vec2f) -> vec3f {
        // takes  [0, 1] object space, returns [-1, 1] screen space
        var coordinate = coord;

        var vPos = vec3f(0); // final pos
        var p : vec2f; // intermediate pos

        if(camera.proj == ${projections.icrs} || camera.proj == ${projections.gal}) {
            if(camera.proj == ${projections.gal}) {
                coordinate = icrs2gal(coordinate);

                // normalize from rad to 0-1
                p.x = coordinate.x * 180 / PI;
                p.x /= 360;
                p.x = p.x + select(-0.5, 0.5, p.x < 0.5);
                p.y = coordinate.y * 180 / PI;
                p.y = (p.y) / 180 + 0.5;
            } else {
                p = coordinate;
            }
            vPos = vec3f((p - vec2f(camera.offset_x, camera.offset_y))*2.0*camera.zoom, 0);
        }
        else if(camera.proj == ${projections.projection360} || camera.proj == ${projections.sphere}) {
            p = vec2f(coordinate.x*2.0-1, coordinate.y - 0.5) * PI;
            // original code
            let horizontal = mat2x2<f32>(cos(p.x), sin(p.x), -sin(p.x), cos(p.x));
            let vertical = mat2x2<f32>(cos(p.y), sin(p.y), -sin(p.y), cos(p.y));
            var pos = vec3f(0.0, 0.0, 1.0);
            // pos.zy = vert * pos.zy
            var temp = vertical * pos.zy;
            pos.z = temp.x;
            pos.y = temp.y;
            // pos.zx = horz * pos.zx
            temp = horizontal * pos.zx;
            pos.z = temp.x;
            pos.x = temp.y;
            var pos_proj = camera.vpMat * vec4f(pos, 1.0);
            if(camera.proj == ${projections.projection360}) {
                pos_proj /= pos_proj.w;
            }
            vPos = vec3f(-pos_proj.x, pos_proj.y, pos_proj.z);
        }
        return vPos;
    }
    
    
    fn centralGaussian(wl: f32, wl_c: f32, sigma: f32) -> f32 {
        return exp(-0.5 * (wl - wl_c) * (wl - wl_c) / (sigma * sigma));
    }

    fn gaussian2D(i: i32, j: i32, sigma: f32) -> f32 {
        return exp(-(f32(i*i + j*j)) / (2 * sigma*sigma));
    }

    fn gaussian1D(i: i32, sigma: f32) -> f32 {
        return exp(-0.5 * f32(i * i) / (sigma * sigma));
    }

    `;

const include_combined_spectra_shader = /* wgsl*/`

fn getCombinedSpectra(coord: vec2u, starIndex: u32, nodeIndex: u32) -> f32 {
    var val: f32 = 0;
    
    if(camera.showStars > 0) { 
        val += packedToFloat(spectralImage[starIndex]);
    }
    if(camera.showPatches > 0) { 
        var level: u32 = 0;

        while(level < PATCH_ID_COUNT) {
            let patchIndex = spectralImage[patchIdIndex(coord, level)];
            if(patchIndex > 0) {
                let count = f32(atomicLoad(&outputSpectrum[patchIdCountIdx(patchIndex-1)]));
                val += nodes[patchIndex - 1].own[nodeIndex] / count;
                val += nodes[patchIndex - 1].sub[nodeIndex] / count;
            } else {
                break;
            }
            level++;
        }
    }
    return val;
}

fn getPhotG(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord, gIndex(coord), G_INDEX);
}

fn getPhotBP(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord, bpIndex(coord), BP_INDEX);
}

fn getPhotRP(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord, rpIndex(coord), RP_INDEX);
}

fn getFluxSum(coord: vec2u) -> f32 {
    if camera.extinction > 0 { return getCorrectedFluxSum(coord); }
    return getCombinedSpectra(coord, fluxSumIndex(coord), FLUX_SUM_OFFSET);
}

fn getCorrectedFluxSum(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord, correctedFluxSumIndex(coord), CORRECTED_FLUX_SUM_OFFSET);
}

fn getTemperature(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord, temperatureIndex(coord), TEMP_OFFSET);
}


fn getTemperatureCount(coord: vec2u) -> f32 {
    return getCombinedSpectra(coord.xy, tempDensityIndex(coord), DENSITY_TEMP_OFFSET);
}

fn getFlux(coord: vec3u, flag: bool) -> f32 {
    let extra = u32(flag && camera.extinction > 0 && coord.z < BINS) * CORRECTED_FLUX_OFFSET;
    let flux = getCombinedSpectra(coord.xy, 
        spectrumIndex(vec3u(coord.xy, coord.z + extra)), 
        coord.z + extra);
    return flux;
}
fn getCount(coord: vec2u) -> f32 {
    var val: f32 = 0;
    if(camera.showStars > 0) { 
        val += packedToFloat(spectralImage[densityIndex(coord)]);
    }
    if(camera.showPatches > 0) { 
        var level: u32 = 0;

        while(level < PATCH_ID_COUNT) {
            let patchIndex = spectralImage[patchIdIndex(coord, level)];
            if(patchIndex > 0) {
                let count = f32(atomicLoad(&outputSpectrum[patchIdCountIdx(patchIndex-1)]));
                val += f32(nodes[patchIndex - 1].starCount) / count;
                val += f32(nodes[patchIndex - 1].subStarCount) / count;
            } else {
                break;
            }
            level++;
        }
    }
    return val;
}
`
const vec2uTou64 = (high, low) => {
    low = BigInt(low);
    high = BigInt(high);
    return (high << 32n) + low;
}
const getApproxTemp = (bp, rp) => {
    let c_xp = (-2.5 * Math.log10(bp) + BP_ZERO) - (-2.5 * Math.log10(rp) + RP_ZERO);
    let approx_temp = 3.999 - 0.654 * c_xp + 0.709 * Math.pow(c_xp, 2) - 0.316 * Math.pow(c_xp, 3);
    return Math.pow(10, approx_temp);
}

const processSpectra = (rawData) => {
    let data = [...rawData];
    let patchIdCount = data.splice(OUTPUT_DEPTH);
    // console.log("patchIdCount", patchIdCount.filter(x => x > 0).length);
    // console.log("patchIdCount", patchIdCount.map((e,i) => e > 0 ? i : undefined).filter(x => x));
    let floatview = [...data].map(x => packedToFloat(x));
    // console.log("patch IDs", data.slice(PATCH_ID_0_OFFSET, PATCH_ID_0_OFFSET + PATCH_ID_COUNT));
    // console.log("length data", data.length);
    // console.log(floatview);
    // console.log("count", data.slice(R_COUNT_OFFSET, PERCENTILE_R_MAX_OFFSET));
    // console.log("hist", data.slice(IMAGE_HIST_OFFSET));
    // console.log("histpercentile", floatview.slice(PERCENTILE_R_MAX_OFFSET, IMAGE_HIST_OFFSET));

    return {
        flux: floatview.slice(0, LightSpectrum.NUM_BINS_BASE),
        corrFlux: floatview.slice(LightSpectrum.NUM_BINS_BASE, 2 * LightSpectrum.NUM_BINS_BASE),
        density: floatview[DENSITY_OFFSET],
        tempDensity: floatview[DENSITY_TEMP_OFFSET],
        bp: floatview[BP_OFFSET],
        rp: floatview[RP_OFFSET],
        g: floatview[G_OFFSET],
        tempSum: floatview[TEMP_OFFSET],
        id: vec2uTou64(data[ID_OFFSET[0]], data[ID_OFFSET[1]]),
        fluxSum: floatview[FLUX_SUM_OFFSET],
        correctedFluxSum: floatview[CORRECTED_FLUX_SUM_OFFSET],
        densityMax: floatview[DENSITY_MAX_OFFSET],
        maxG: floatview[G_MAX_OFFSET],
        maxB: floatview[B_MAX_OFFSET],
        maxR: floatview[R_MAX_OFFSET],
        minG: floatview[G_MIN_OFFSET],
        minB: floatview[B_MIN_OFFSET],
        minR: floatview[R_MIN_OFFSET],
        minA: floatview[A_MIN_OFFSET],
        maxA: floatview[A_MAX_OFFSET],
        perMaxR: floatview[PERCENTILE_R_MAX_OFFSET],
        perMaxG: floatview[PERCENTILE_G_MAX_OFFSET],
        perMaxB: floatview[PERCENTILE_B_MAX_OFFSET],
        perMaxA: floatview[PERCENTILE_A_MAX_OFFSET],
        perMinR: floatview[PERCENTILE_R_MIN_OFFSET],
        perMinG: floatview[PERCENTILE_G_MIN_OFFSET],
        perMinB: floatview[PERCENTILE_B_MIN_OFFSET],
        perMinA: floatview[PERCENTILE_A_MIN_OFFSET],
        starListNodeId: data[STAR_LIST_NODE_ID_OFFSET],
        patchId: data[PATCH_ID_0_OFFSET],
    }
}

export { downloadCanvas, saveTemplateAsFile, getJsonUpload, toggleClass, applyClass, removeClass, DEPTH, OUTPUT_DEPTH, DENSITY_MAX_OFFSET, include_combined_spectra_shader, include_shader, processSpectra, getApproxTemp, projections, A_G, initMinMax, CIE_BINS, IMAGE_HIST_OFFSET, IMAGE_HIST_BIN_SIZE };