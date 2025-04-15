#include <random>
#include <algorithm>
#include <iterator>
#include <numeric>

#include <lactea_xp_merged/raw_star_db.hpp>

int main(int argc, char** argv) {

	if (argc < 4) {
		printf("Use: %s <input_stars_db> <output_start_db> numStars\n", argv[0]);
		return 0;
	}

	std::string dbInPath = argv[1];
	std::string dbOutPath = argv[2];
	std::size_t numStarsToPick = std::stoul(argv[3]);

	RawStarDB sdb;
	sdb.load(dbInPath, true);

	printf("Creating vector of indices\n");
	std::vector<std::size_t> indices(sdb.getNumStars());
	std::iota(std::begin(indices), std::end(indices), 0);
	std::random_device rd;
	std::mt19937 g(rd());
	printf("Shuffling indices\n");
	std::shuffle(indices.begin(), indices.end(), g);
	printf("Shrinking indices\n");
	indices.resize(numStarsToPick);
	printf("Sorting indices\n");
	std::sort(indices.begin(), indices.end());

	sdb.writeByIndexes(indices, dbOutPath, true);

	return 0;
}