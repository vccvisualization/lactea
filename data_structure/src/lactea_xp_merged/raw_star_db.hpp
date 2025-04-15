#pragma once

#include <vector>
#include <string>
#include <filesystem>
#include <map>
#include <lactea_xp_merged/star.hpp>
#include "cached_star.hpp"

class RawStarDB {
	
public:

    RawStarDB(bool partial = false, int cacheSize = 10000) : _isPartial(partial), _starsCache(cacheSize) {};

	const bool load(std::string filepath, bool verbose = false, std::size_t num = 0);
	const bool write(std::string filepath);
    const bool writeByIndexes(std::vector<std::size_t>& indexes, std::string filepath, bool verbose = false);
    const bool writeForAnalysis(std::string filepath, bool verbose = false);
	const bool loadAndWriteByIndexes(std::vector<std::size_t>& indexes, std::string wfilepath, bool verbose = false);

	static void check(std::string filepath, bool streamOut = false);
	//static void checkWaveLengthHisto(std::string filepath);
	void getGroupBoundingBox(Star::IdxVecIter begin, Star::IdxVecIter end, float* bb);
    void getGroupBoundingBox3d(Star::IdxVecIter begin, Star::IdxVecIter end, float *bb);


	inline std::size_t getNumStars() const { return _numStars; }
	Star& getStar(Star::Idx id);
	inline const std::vector<Star>& getStarsVector() const { return _stars; }

private:
	std::vector<Star> _stars;
    StarCache _starsCache;

    std::size_t _numStars;
	std::string _path;
    bool _isPartial;
};