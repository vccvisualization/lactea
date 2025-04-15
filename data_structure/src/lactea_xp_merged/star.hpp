#pragma once

#include <cstdint>
#include <cstdio>
#include <utils/portable_io.h>
#include <vector>

#pragma pack(push)
#pragma pack(4)

struct Star {
	uint64_t id = 0;
    double ra = 0.0;
    double dec = 0.0;
    double parallax = 0.0;
    double nu_eff_used_in_astrometry = 0.0;
    double pseudocolour = 0.0;
    double phot_g_mean_flux = 0.0;
    double phot_g_mean_mag = 0.0;
    double phot_bp_mean_flux = 0.0;
    double phot_bp_mean_mag = 0.0;
    double phot_rp_mean_flux = 0.0;
    double phot_rp_mean_mag = 0.0;
    double rv_template_teff = 0.0;
    double teff_gspphot = 0.0;
    double azero_gspphot = 0.0;
    double ag_gspphot = 0.0;
    double ls[343] = {0};

    using Idx = uint32_t;
    using Vec = std::vector<Star>;
    using VecIter = std::vector<Star>::iterator;
    using IdxVec = std::vector<Star::Idx>;
    using IdxVecIter = std::vector<Star::Idx>::iterator;

    inline const void print() {
		printf("%lu\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t\n",
			id, ra, dec, phot_g_mean_mag);//, azero_gspphot, ag_gspphot);
        //ls.print();
	}
    inline const double getWavelength() const {
        return (nu_eff_used_in_astrometry == -1. ? 1. / pseudocolour : 1. / nu_eff_used_in_astrometry) * 1000.;
    }
    double getDistanceAU() {
        return 206264.80624538/parallax;
    }
    inline void getCoordinates(double& x, double& y) const {
        x = ra / 360.0;
        y = dec / 180.0 + 0.5;
	}

};
#pragma pack(pop)


