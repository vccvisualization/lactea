#include "cached_star_db.hpp"

unsigned int getSizeChunk(unsigned int numStarsPerNode) {
    return (sizeof(StarTree::Node) + (sizeof(StarTree::MinStar) + sizeof(Star::Idx)) * numStarsPerNode + sizeof(unsigned int));
    return (sizeof(StarTree::Node) + (sizeof(Star) + sizeof(Star::Idx)) * numStarsPerNode + sizeof(unsigned int));
}
CachedStarDB::CachedStarDB(unsigned int numStarsPerNode, unsigned int numChunks, unsigned int numLoadingThreads) :
	AsyncLRUCacheMultiDynMem(numChunks, getSizeChunk(numStarsPerNode), numLoadingThreads) {}

void CachedStarDB::init(std::string& path, unsigned int preload) {
	_path = path;
	for (unsigned int i = 0; i < preload; ++i) {
		syncLoad(i);
	}
}

bool CachedStarDB::loadChunk(uint64_t chunkIdx, void* cacheelemPtr) {
    Chunk chunk(chunkIdx);
    if(!StarTree::loadNode(_path, chunk.node, chunk.stars)) {
        printf("loadChunk: Something went wrong\n");
        return false;
    }
    std::vector<unsigned char> bytes;
    unsigned int size = chunk.node.stars.size();
    bytes.insert(bytes.end(), static_cast<const char*>(static_cast<const void*>(&size)), static_cast<const char*>(static_cast<const void*>(&size)) + sizeof(unsigned int));

    Star::IdxVec backup;
    chunk.node.stars.swap(backup);
    bytes.insert(bytes.end(), static_cast<const char*>(static_cast<const void*>(&chunk.node)), static_cast<const char*>(static_cast<const void*>(&chunk.node)) + sizeof(StarTree::Node));
    chunk.node.stars.swap(backup);

    for (auto const& x : chunk.node.stars) {
        bytes.insert(bytes.end(), static_cast<const char*>(static_cast<const void*>(&x)), static_cast<const char*>(static_cast<const void*>(&x)) + sizeof(Star::Idx));
    }
    for (auto const& x : chunk.stars) {
        bytes.insert(bytes.end(), static_cast<const char*>(static_cast<const void*>(&x)), static_cast<const char*>(static_cast<const void*>(&x)) + sizeof(StarTree::MinStar));
    }
    std::copy(bytes.begin(), bytes.end(),(char*) cacheelemPtr);

    return true;

}

CachedStarDB::Chunk * CachedStarDB::getChunk(const std::size_t id) {
	if (isAvailable(id)) {
        const char* bytes = (char*) getData(id);
        Chunk *c = new Chunk(id);
        unsigned int s;
        int offset = 0;
        memcpy(&s, &bytes[0], sizeof(unsigned int));
        offset += sizeof(unsigned int);
        memcpy(&c->node, &bytes[offset], sizeof(StarTree::Node));
        offset += sizeof(StarTree::Node);
        c->node.stars.resize(s);
        c->stars.resize(s);
        memcpy(&c->node.stars[0], &bytes[offset], sizeof(Star::Idx) * s);
        offset += sizeof(Star::Idx) * s;
        memcpy(&c->stars[0], &bytes[offset], sizeof(StarTree::MinStar) * s);

//        printf("Chunk info:\n");
//        printf("\tid: %d, num stars: %d, clippingCoord: %f, children: %d %d\n", c->node.id, c->node.stars.size(), c->node.clippingCoord, c->node.children[0], c->node.children[1]);
//        printf("\tx: %f, y: %f, wl: %f, e: %f\n", c->vertices[4].x, c->vertices[4].y, c->vertices[4].wl, c->vertices[4].e);
        return c;
    }

    return nullptr;
}

