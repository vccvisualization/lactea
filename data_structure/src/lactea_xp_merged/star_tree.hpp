#pragma once

#include <memory>
#include <filesystem>
#include <map>
#include "ViewBound.h"
#include <lactea_xp_merged/raw_star_db.hpp>
#include <lactea_xp_merged/light_spectrum.hpp>

inline std::string nodePath(std::string &path, uint32_t nodeId) {
    return path + PATH_SEP + std::to_string(nodeId) + ".node";
}

inline std::string nodeListPath(std::string &path, uint32_t nodeId) {
    return path + PATH_SEP + std::to_string(nodeId) + ".nodes";
}

inline std::string treePath(std::string &path) {
    return path + PATH_SEP + "tree.tr";
}


class StarTree {

public:
	using NodeIdx = uint32_t;
    using NodeIdxVec = std::vector<uint64_t>;

    static unsigned int nodeIdCounter;
    // using MinStar = Star;
#pragma pack(push)
#pragma pack(1)
    struct MinStar {
    	uint64_t id = 0;
    	float ra = 0.0;
    	float dec = 0.0;
        LightSpectrum ownSpectrum;
    };
#pragma pack(pop)

#pragma pack(push)
#pragma pack(1)
	struct Node {
        Node(){
            id = StarTree::nodeIdCounter++;
        };
        Node(NodeIdx i) : id(i){};
        unsigned int id;
		Star::IdxVec stars;
		NodeIdx children[2] = { 0 };
		float clippingCoord = 0.f;
		float boundingBox[4] = { 0.f };
		unsigned char splitAxis = 0;
        unsigned int subtreeStarsCount = 0;
        LightSpectrum ownSpectrum;
		LightSpectrum subtreeSpectrum;
	};
#pragma pack(pop)
	using NodeLevel = std::vector<Node>;

	inline void setStarDB(RawStarDB* sdb) { _sdb = sdb; }
    inline Node& getNode(int l, int id) {
        return _tree[l][id];
    }
    void setNodePath(std::string path) { std::filesystem::create_directory(path); _path = path; }
    inline unsigned int getNumMaxStarsNode() { return _numMaxStarsNode; }
    void build(unsigned int numMaxStarsNode);
	inline unsigned int getNumLevels() const { return _tree.size(); }
	unsigned int getNumInnerNodes() const;
	unsigned int getNumLeafNodes() const;
	void query(Star::IdxVec *result, float minx, float miny, float maxx, float maxy, unsigned int maxLevel);
	bool save(const std::string& file);
	bool load(const std::string& file);

    void chunker(bool verbose=false);
    bool saveTree(bool verbose=false);
    bool loadTree(bool verbose=false);
    bool saveNode(Node &node, bool verbose=false);
    bool saveNodes(std::vector<Node*> &nodeList, int filenum, bool verbose=false);
    static bool loadNode(std::string path, Node &node, std::vector<MinStar> &stars, bool verbose=false);
    bool loadNode(Node &node, std::vector<MinStar> &stars, bool verbose=false);
    static bool loadNodes(std::string path, std::vector<Node> &nodeList, int filenum, bool verbose=false);
    bool loadNodes(std::vector<Node> &nodeList, int filenum, bool verbose=false);
    void chunksQuery(NodeIdxVec *result, std::map<uint64_t, bool> *isLeaf, std::vector<ViewBound>& view_bounds, unsigned int maxLevel, float area_threshold);
    void printTree();
private:

	void _buildTreeSplitMedian();
	void _buildTreeSplitHalfDist();
	void _fillupSpectra();
	inline unsigned int _getLeavesLevel() const { return _tree.size()-1; }
	inline bool _includes(float min1, float max1, float min2, float max2) {
		return !((max2 < min1) || (min2 > max2));
	}
	inline bool _intersect(float a_x_min, float a_y_min, float a_x_max, float a_y_max, float b_x_min, float b_y_min, float b_x_max, float b_y_max) {
		return !(b_x_min > a_x_max
			  || b_x_max < a_x_min
			  || b_y_min > a_y_max
			  || b_y_max < a_y_min);
	}
	inline bool _area_threshold(float a_x_min, float a_y_min, float a_x_max, float a_y_max, float b_x_min, float b_y_min, float b_x_max, float b_y_max, float threshold) {
        float bound_area = (b_x_max - b_x_min) * (b_y_max - b_y_min);
        float node_area = (a_x_max - a_x_min) * (a_y_max - a_y_min);

		return node_area / bound_area > threshold;
	}

	RawStarDB* _sdb;
	std::vector<NodeLevel> _tree;
	unsigned int _numMaxStarsNode = 0;
    std::string _path;
};