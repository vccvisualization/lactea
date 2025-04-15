#include <lactea_xp_merged/raw_star_db.hpp>

const bool RawStarDB::load(std::string filepath, bool verbose, std::size_t num) {
    if (verbose) printf("Loading %s:\n", filepath.c_str());
    _path = filepath;
    std::uintmax_t filesize = std::filesystem::file_size(filepath);
    _numStars = filesize / sizeof(Star);

    if (verbose) printf("  - Star DB : %zu stars [%.2f MB]\n", _numStars, filesize / float(1024.f * 1024.f));
    if (num > 0) _numStars = std::min(num, _numStars);
    if (verbose) printf("  - Num stars to load: %zu\n", _numStars);
    if (_isPartial) {
        _starsCache.init(_path, 10);
//        _starsCache.start();
    } else {
        FILE *pFile;
        pFile = fopen(filepath.c_str(), "rb");
        if (verbose) printf("  - Allocating memory\n");
        _stars.resize(_numStars);
        if (verbose) printf("  - Loading stars:");
        std::size_t starsToLoadByStep = 100000000;
        std::size_t starsLoaded = 0;
        while (starsLoaded < _numStars) {
            std::size_t starsToRead = std::min(_numStars - starsLoaded, starsToLoadByStep);
            fread((void *) &(_stars[starsLoaded]), sizeof(Star), starsToRead, pFile);
            starsLoaded += starsToRead;
            if (verbose) {
                printf(" %zuM", starsLoaded / 1000000);
                fflush(stdout);
            }
        }
        fclose(pFile);
        if (verbose) printf("\n  - File %s closed\n", filepath.c_str());
    }
    return true;
}

const bool RawStarDB::write(std::string filepath) {
    FILE *pFile;
    pFile = fopen(filepath.c_str(), "wb");
    fwrite((void *) _stars.data(), sizeof(Star), _numStars, pFile);
    fclose(pFile);
    return true;
}

const bool RawStarDB::writeByIndexes(
        std::vector<std::size_t> &indexes, std::string filepath, bool verbose) {
    FILE *pFile;
    if (verbose) printf("Opening %s for writing:\n", filepath.c_str());
    pFile = fopen(filepath.c_str(), "wb");
    if (verbose) printf(" - Writing stars: ");
    for (std::size_t i = 0; i < indexes.size(); ++i) {
        fwrite((void *) &(_stars[indexes[i]]), sizeof(Star), 1, pFile);
        if (i % 10000000 == 0) {
            printf(" %zuM", i / 10000000);
            fflush(stdout);
        }
    }
    fclose(pFile);
    if (verbose) printf("\n  - File %s closed\n", filepath.c_str());
    return true;
}

const bool RawStarDB::writeForAnalysis(std::string filepath, bool verbose) {
    FILE *pFile;
    if (verbose) printf("Opening %s for writing:\n", filepath.c_str());
    pFile = fopen(filepath.c_str(), "wb");
    if (verbose) printf(" - Writing stars: ");

    double fluxTotal = 0;
    for(auto &star :_stars) {
        fwrite(&star.id, sizeof(uint64_t ), 1, pFile);
        fwrite( &star.ra, sizeof(double), 1, pFile);
        fwrite( &star.dec, sizeof(double), 1, pFile);
        fwrite( &star.phot_g_mean_flux, sizeof(double), 1, pFile);
        fwrite( &star.phot_bp_mean_flux, sizeof(double), 1, pFile);
        fwrite( &star.phot_rp_mean_flux, sizeof(double), 1, pFile);
        fwrite( &star.teff_gspphot, sizeof(double), 1, pFile);
        fwrite( &star.azero_gspphot, sizeof(double), 1, pFile);

        for(int i = 0; i < 343; i++) {
            fluxTotal += star.ls[i];
        }
        fwrite( &fluxTotal, sizeof(double), 1, pFile);
    }
    fclose(pFile);
    if (verbose) printf("\n  - File %s closed\n", filepath.c_str());

    return true;
}

//Star* RawStarDB::_loadStar(Star::Idx index)
//{
//	FILE* rFile;
//	rFile = fopen(_path.c_str(), "rb");
//	Star* star = new Star;
//	portable_fseek64(rFile, index * sizeof(Star), SEEK_SET);
//
//	fread(star, sizeof(Star), 1, rFile);
//	fclose(rFile);
//
//	return star;
//}

Star &RawStarDB::getStar(Star::Idx id) {
    if (_isPartial) {
        Star *star = nullptr;
        while (star == nullptr) {
            if (!_starsCache.isAvailable(id)) {
                _starsCache.syncLoad(id);
            }
//        printf("%d available!\n", id);
            star = (Star *) _starsCache.getData(id);
        }
        return *star;
    }
    return _stars[id];
}

const bool RawStarDB::loadAndWriteByIndexes(
        std::vector<std::size_t> &indexes, std::string wfilepath, bool verbose) {

    if (verbose) printf("Opening %s for reading:\n", _path.c_str());
    FILE *rFile;
    rFile = fopen(_path.c_str(), "rb");

    FILE *wFile;
    if (verbose) printf("Opening %s for writing:\n", wfilepath.c_str());
    wFile = fopen(wfilepath.c_str(), "wb");

    if (verbose) printf("  - Loading and Writing stars:");
    Star star;

    for (auto &index: indexes) {
        portable_fseek64(rFile, index * sizeof(Star), SEEK_SET);
        fread(&star, sizeof(Star), 1, rFile);
        fwrite(&star, sizeof(Star), 1, wFile);
    }


    fclose(wFile);
    if (verbose) printf("\n  - File %s closed\n", wfilepath.c_str());
    fclose(rFile);
    if (verbose) printf("\n  - File %s closed\n", _path.c_str());
    return true;
}


void RawStarDB::check(std::string filepath, bool streamOut) {
    FILE *pFile;
    pFile = fopen(filepath.c_str(), "rb");
    portable_fseek64(pFile, 0L, SEEK_END);
    std::size_t filesize = portable_ftell64(pFile);
    std::size_t numStars = filesize / sizeof(Star);
    printf("NUM STARS: %zu\n", numStars);
    rewind(pFile);
    Star star;
    std::size_t count = 0;
    while (fread((void *) &star, sizeof(Star), 1, pFile)) {
        if (streamOut) star.print();
        if (star.id == 0) {
            printf("\nBAD STAR! [%zu]: ", count);
            star.print();
        }
        count++;
        if (count % 10000000 == 0) printf("%zuM ", count / 1000000);
    }
    fclose(pFile);
}

/*
void RawStarDB::checkWaveLengthHisto(std::string filepath)
{
	FILE* pFile;
	pFile = fopen(filepath.c_str(), "rb");
    portable_fseek64(pFile, 0L, SEEK_END);
	std::size_t filesize = portable_ftell64(pFile);
	std::size_t numStars = filesize / sizeof(Star);
	printf("NUM STARS: %zu\n", numStars);
	rewind(pFile);
	Star star;
	std::size_t count = 0, discardedNeg = 0, discardedBig = 0;
	unsigned int maxWL = 100000;
	unsigned int stepsSpectrum = 2000;
	std::vector<unsigned int> spectrum(stepsSpectrum, 0);
	while (fread((void*)&star, sizeof(Star), 1, pFile)) {
		float freq = (float)star.getWavelength();
		if (freq < 0) { discardedNeg++; continue; }
		if (freq > maxWL) { discardedBig++; continue; }
		unsigned int idxSpectrum = (unsigned int)((freq / maxWL) * (float)stepsSpectrum);
		spectrum[idxSpectrum]++;
		count++;
		//if (count > 100000000) break;
		if (count % 10000000 == 0) printf("%zuM ", count / 1000000);

	}
	fclose(pFile);

	for (unsigned int i = 0; i < stepsSpectrum; i++) {
		printf("[%5i-%5i]: %i\n", i * (maxWL / stepsSpectrum), (i + 1) * (maxWL / stepsSpectrum), spectrum[i]);
	}
	printf("neg:%zu, big:%zu\n", discardedNeg, discardedBig);

}
*/

void RawStarDB::getGroupBoundingBox(Star::IdxVecIter begin, Star::IdxVecIter end, float *bb) {
    bb[0] = bb[1] = 999999.9f;
    bb[2] = bb[3] = -999999.9f;
    for (Star::IdxVecIter i = begin; i < end; i++) {
        float ra = (float) getStar(*i).ra;
        float dec = (float) getStar(*i).dec;
        if (ra < bb[0]) bb[0] = ra;
        if (ra > bb[2]) bb[2] = ra;
        if (dec < bb[1]) bb[1] = dec;
        if (dec > bb[3]) bb[3] = dec;
    }
}

void RawStarDB::getGroupBoundingBox3d(Star::IdxVecIter begin, Star::IdxVecIter end, float *bb) {
    bb[0] = bb[1] = bb[2] = 999999.9f;
    bb[3] = bb[4] = bb[5] = -999999.9f;
    for (Star::IdxVecIter i = begin; i < end; i++) {
        float ra = (float) _stars[*i].ra;
        float dec = (float) _stars[*i].dec;
        float par = (float) _stars[*i].parallax;
        if (ra < bb[0]) bb[0] = ra;
        if (ra > bb[3]) bb[3] = ra;
        if (dec < bb[1]) bb[1] = dec;
        if (dec > bb[4]) bb[4] = dec;
        if (par < bb[2]) bb[2] = par;
        if (par > bb[5]) bb[5] = par;
    }
}
