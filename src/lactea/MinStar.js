import { LightSpectrum } from "./LightSpectrum.js";
import { floatToSoft, softFloatAdd } from "./utils.js";

export class MinStar {
    static NUM_ATTR = 4 + LightSpectrum.NUM_BINS_TOTAL
    static ID_OFFSET = 0;
    static POS_OFFSET = 2;
    static FLUX_OFFSET = 4;
    static FLUX_TOTAL_OFFSET = 4 + LightSpectrum.TOTAL_ENERGY_INDEX
    static RP_OFFSET = 4 + LightSpectrum.RP_INDEX
    static G_OFFSET = 4 + LightSpectrum.G_INDEX
    static BP_OFFSET = 4 + LightSpectrum.BP_INDEX
    static TEMP_OFFSET = 4 + LightSpectrum.TEMPERATURE_INDEX

    constructor() {
        this.s = 0;
    }

    size(s) {
        this.s = s;
        this.buffer = new ArrayBuffer(MinStar.NUM_ATTR * s * 4); // attr x size x 4 bytes
        this.floatView = new Float32Array(this.buffer);
        this.uintView = new Uint32Array(this.buffer);
    }

    set(ids, pos, ownSpectrum, k) {
        const offset = k * MinStar.NUM_ATTR;
    
        this.uintView[offset + MinStar.ID_OFFSET] = Number(BigInt.asUintN(32, ids >> 32n));
        this.uintView[offset + MinStar.ID_OFFSET + 1] = Number(BigInt.asUintN(32, ids));
        this.floatView.set(pos, offset + MinStar.POS_OFFSET);

        let histogram = Float32Array.from(ownSpectrum.histogram);
        this.floatView.set(histogram, offset + MinStar.FLUX_OFFSET);
    }
}