export class LightSpectrum {
    // https://gea.esac.esa.int/archive/documentation/GDR3/Gaia_archive/chap_datamodel/sec_dm_spectroscopic_tables/ssec_dm_xp_sampled_mean_spectrum.html
    static MIN_WAVELENGTH = 336;
    static MAX_WAVELENGTH = 1020;
    static NUM_BINS_BASE = 343;
    static OUT_OF_RANGE = 9999;

    // flux, corrected flux, total energy, corrected total energy, photometry, temperature, temperature count
    static NUM_BINS_TOTAL = 343 * 2 + 7;
    static CORRECTED_FLUX_INDEX = 343;
    static TOTAL_ENERGY_INDEX = 343 * 2;
    static CORRECTED_TOTAL_ENERGY_INDEX = 343 * 2 + 1;
    static RP_INDEX = 343 * 2 + 2;
    static G_INDEX = 343 * 2 + 3;
    static BP_INDEX = 343 * 2 + 4;
    static TEMPERATURE_INDEX = 343 * 2 + 5;
    static TEMPERATURE_COUNT_INDEX = 343 * 2 + 6;
    
    histogram = new Float64Array(LightSpectrum.NUM_BINS_TOTAL).fill(0.0);

    static mapWavelengthToIdx(wl) {
        if (wl < LightSpectrum.MIN_WAVELENGTH || wl > LightSpectrum.MAX_WAVELENGTH) { // out of range
            return LightSpectrum.OUT_OF_RANGE;
        }
        return Math.floor((wl - LightSpectrum.MIN_WAVELENGTH) * 0.5);
    }

    static mapIdxToWavelength(idx) { // wl_min <= wl <= wl_max
        let wl = []
        wl.push(idx * 2 + LightSpectrum.MIN_WAVELENGTH);
        wl.push(idx * 2 + LightSpectrum.MIN_WAVELENGTH + 1);
        return wl;
    }

    add(b) {
        return this.histogram.map((num, idx) => num + b.histogram[idx]);
    }
}