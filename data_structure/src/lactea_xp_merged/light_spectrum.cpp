#include <lactea_xp_merged/light_spectrum.hpp>

LightSpectrum::LightSpectrum() {
    memset(this->_histogram, 0, LIGHTSPECTRUM_NUM_BINS_TOTAL * sizeof(double));
}

double LightSpectrum::getTotalEnergy() const {
    return this->_histogram[LIGHTSPECTRUM_TOTAL_ENERGY_INDEX];
}

double LightSpectrum::getCorrectedTotalEnergy() const {
    return this->_histogram[LIGHTSPECTRUM_CORRECTED_TOTAL_ENERGY_INDEX];
}

double LightSpectrum::getTemperature() const {
    return this->_histogram[LIGHTSPECTRUM_TEMPERATURE_INDEX];
}

double LightSpectrum::getTemperatureCount() const {
    return this->_histogram[LIGHTSPECTRUM_TEMPERATURE_COUNT_INDEX];
}


double LightSpectrum::getRP() const {
    return this->_histogram[LIGHTSPECTRUM_RP_INDEX];
}
double LightSpectrum::getG() const {
    return this->_histogram[LIGHTSPECTRUM_G_INDEX];
}
double LightSpectrum::getBP() const {
    return this->_histogram[LIGHTSPECTRUM_BP_INDEX];
}


void LightSpectrum::print() {
    printf("[");
    for (unsigned int i = 0; i < LIGHTSPECTRUM_NUM_BINS_BASE; ++i) printf("%.10f,", _histogram[i]);
    printf("]\n");
}

const double* LightSpectrum::getHistogram() const { return _histogram; }


bool LightSpectrum::addFlux(const double b[], const double azero)
{
    double a0 = std::max(azero, 0.);
    for (int i = 0; i < LIGHTSPECTRUM_NUM_BINS_BASE; ++i) {
        double f = std::max(b[i], 0.);
        this->_histogram[i] += f;
        this->_histogram[LIGHTSPECTRUM_TOTAL_ENERGY_INDEX] += f;
        double corrected = f * pow(10, 0.4 * a0 * EXTINCTION_CURVE[i] / 3.1);
        this->_histogram[LIGHTSPECTRUM_CORRECTED_FLUX_INDEX + i] += corrected;
        this->_histogram[LIGHTSPECTRUM_CORRECTED_TOTAL_ENERGY_INDEX] += corrected;
    }
    return true;
}

bool LightSpectrum::addPhotometry(double rp, double g, double bp)
{
    this->_histogram[LIGHTSPECTRUM_RP_INDEX] += std::max(rp, 0.);
    this->_histogram[LIGHTSPECTRUM_G_INDEX] += std::max(g, 0.);
    this->_histogram[LIGHTSPECTRUM_BP_INDEX] += std::max(bp, 0.);
    return true;
}


bool LightSpectrum::addTemperature(double temperature)
{
    this->_histogram[LIGHTSPECTRUM_TEMPERATURE_INDEX] += std::max(temperature, 0.);
    this->_histogram[LIGHTSPECTRUM_TEMPERATURE_COUNT_INDEX] += temperature > 0;
    return true;
}


LightSpectrum LightSpectrum::operator+(const LightSpectrum& b)
{
    LightSpectrum ls;
    for (int i = 0; i < LIGHTSPECTRUM_NUM_BINS_TOTAL; ++i)
        ls._histogram[i] = std::max(this->_histogram[i] + b._histogram[i], 0.);
    return ls;
}

LightSpectrum LightSpectrum::operator-(const LightSpectrum& b)
{
    LightSpectrum ls;
    for (int i = 0; i < LIGHTSPECTRUM_NUM_BINS_TOTAL; ++i)
        ls._histogram[i] = std::max(0., this->_histogram[i] - b._histogram[i]);
    return ls;
}

LightSpectrum & LightSpectrum::operator+=(const LightSpectrum &b)
{
    for (int i = 0; i < LIGHTSPECTRUM_NUM_BINS_TOTAL; ++i)
        this->_histogram[i] += std::max(b._histogram[i], 0.);
    return *this;
}

LightSpectrum & LightSpectrum::operator-=(const LightSpectrum &b)
{
    for (int i = 0; i < LIGHTSPECTRUM_NUM_BINS_TOTAL; ++i)
        this->_histogram[i] -= b._histogram[i];
    return *this;
}