#pragma once

#include <vector>
#include <string>
#include "star.hpp"
#include "async_cache.hpp"

class StarCache : public AsyncLRUCacheMultiDynMem {
	
public:
#pragma pack(push)
#pragma pack(1)
#pragma pack(pop)
    StarCache(unsigned int numChunks=100, unsigned int numLoadingThreads=4);
	void init(std::string& path, unsigned int preload = 0);
	virtual bool loadChunk(uint64_t chunkIdx, void* cacheelemPtr);
	void getChunk(const std::size_t id, Star* star);
    inline unsigned int getChunkSize() { return _chunkSize; }
    inline unsigned int getNumChunks() { return _numElementsCache; }
    inline unsigned int getNumLoadingThreads() { return _numLoadingThreads; }
private:
    std::string _path;
};