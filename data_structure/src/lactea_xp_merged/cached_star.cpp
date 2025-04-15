#include <cstring>
#include "cached_star.hpp"


StarCache::StarCache(unsigned int numChunks, unsigned int numLoadingThreads) :
	AsyncLRUCacheMultiDynMem(numChunks, sizeof(Star), numLoadingThreads) {}

void StarCache::init(std::string& path, unsigned int preload) {
    _path = path;

    for (unsigned int i = 0; i < preload; ++i) {
		syncLoad(i);
	}
}

bool StarCache::loadChunk(uint64_t chunkIdx, void* cacheelemPtr) {
    FILE* rFile;
    rFile = fopen(_path.c_str(), "rb");
    portable_fseek64(rFile, chunkIdx * sizeof(Star), SEEK_SET);
    fread(cacheelemPtr, sizeof(Star), 1, rFile);
    fclose(rFile);
    return true;
}

void StarCache::getChunk(const std::size_t id, Star* star) {
	if (isAvailable(id)) {
//        printf("%d available!\n", id);
        star = (Star*) getData(id);
    }
}

