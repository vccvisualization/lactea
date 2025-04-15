#pragma once

#include <vector>
#include <string>
#include "star_tree.hpp"
#include "async_cache.hpp"

class CachedStarDB : public AsyncLRUCacheMultiDynMem {
	
public:
#pragma pack(push)
#pragma pack(1)
	struct Chunk {
        Chunk(StarTree::NodeIdx i) : node(StarTree::Node(i)){};
        StarTree::Node node;
        std::vector<StarTree::MinStar> stars;
    };
#pragma pack(pop)
    CachedStarDB(unsigned int numStarsPerNode=10000, unsigned int numChunks=100, unsigned int numLoadingThreads=4);
	void init(std::string& path, unsigned int preload = 0);
	virtual bool loadChunk(uint64_t chunkIdx, void* cacheelemPtr);
	Chunk * getChunk(const std::size_t id);
    inline unsigned int getChunkSize() { return _chunkSize; }
    inline unsigned int getNumChunks() { return _numElementsCache; }
    inline unsigned int getNumLoadingThreads() { return _numLoadingThreads; }
private:
	std::string _path;



};