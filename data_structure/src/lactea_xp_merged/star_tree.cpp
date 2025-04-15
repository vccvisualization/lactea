#include <execution>
#include <algorithm>
#include <iterator>
#include <numeric>
#include <queue>
#include <cassert>
#include <lactea_xp_merged/star_tree.hpp>


unsigned int StarTree::nodeIdCounter = 0;

void StarTree::build(unsigned int numMaxStarsNode) {
    _numMaxStarsNode = numMaxStarsNode;
    _buildTreeSplitHalfDist();
    _fillupSpectra();
}

/*
void StarTree::_buildTreeSplitMedian() {

	struct BuildNode {
		BuildNode(Star::IdxVecIter begin, Star::IdxVecIter end, unsigned char level, NodeIdx node) :
		begin(begin), end(end), level(level), node(node) {}
		Star::IdxVecIter begin, end;
		unsigned int level;
		NodeIdx node;
	};

	printf("Creating vector of indices\n");
	Star::IdxVec sdbIndexes(_sdb->getNumStars());
	std::iota(std::begin(sdbIndexes), std::end(sdbIndexes), 0);

	std::queue<BuildNode> queue;
	queue.push(BuildNode(sdbIndexes.begin(), sdbIndexes.end(), 0, 0));
	_tree.push_back(NodeLevel());
	_tree[0].push_back(Node());

	while (!queue.empty()) {
		BuildNode tn = queue.front(); queue.pop();
		Node& sn = _tree[tn.level][tn.node];

		printf("LEVEL %i NODE %i\n", tn.level, tn.node);

		sort(tn.begin, tn.end,
			[=](const Star::Idx& a, const Star::Idx& b) -> bool
			{
				return _sdb->getStar(a).photo_G_magnitude < _sdb->getStar(b).photo_G_magnitude;
			});
		Star::Idx numStars = (Star::Idx) std::distance(tn.begin, tn.end);
		if (numStars > _numMaxStarsNode) { // Subdivide
			// copy first stars (brightests) to the tree node
			sn.stars.resize(_numMaxStarsNode);
			std::copy_n(tn.begin, _numMaxStarsNode, sn.stars.begin());
			// update the upper limit, to exclude those stars already asigned
			std::advance(tn.begin, _numMaxStarsNode);
			// update number of stars
			numStars = (Star::Idx) std::distance(tn.begin, tn.end);
			// iterator to the middle
			Star::IdxVecIter mid = tn.begin;
			std::advance(mid, numStars / 2);
			// sort by an spatial axis
			if (tn.level % 2) { // Odd level, sort by DEC axis
				sort(tn.begin, tn.end,
					[=](const Star::Idx& a, const Star::Idx& b) -> bool
					{
						return _sdb->getStar(a).dec > _sdb->getStar(b).dec;
					});
				sn.clippingCoord = float((_sdb->getStar(*mid).dec + _sdb->getStar(*(mid + 1)).dec) / 2.0f); // float???
			}
			else { // Even level, sort by RA axis
				sort(tn.begin, tn.end,
					[=](const Star::Idx& a, const Star::Idx& b) -> bool
					{
						return _sdb->getStar(a).ra > _sdb->getStar(b).ra;
					});
				sn.clippingCoord = float((_sdb->getStar(*mid).ra + _sdb->getStar(*(mid + 1)).ra) / 2.0f); // float???
			}

		//	printf("subdivide at %f (level %i)\n", sn.clippingCoord, tn.level);

			//Children creation
			unsigned int childrenLevel = tn.level + 1;
			if (_tree.size() > childrenLevel) {
				sn.children[0] = (NodeIdx)_tree[childrenLevel].size();
				sn.children[1] = (NodeIdx)_tree[childrenLevel].size() + 1;
			}
			else {
				sn.children[0] = 0;
				sn.children[1] = 1;
			}
			queue.push(BuildNode(tn.begin, mid, childrenLevel, sn.children[0]));
			queue.push(BuildNode(mid, tn.end, childrenLevel, sn.children[1]));
			if (_tree.size() <= childrenLevel) {
				_tree.push_back(NodeLevel());
		//		printf("Added level %zu\n", _tree.size() - 1);
			}
			_tree[childrenLevel].push_back(Node());
			_tree[childrenLevel].push_back(Node());
		}
		else { // Leave

			// copy first stars (brightests) to the tree node
			sn.stars.resize(numStars);
			std::copy(tn.begin, tn.end, sn.stars.begin());

			// compute leave spectrum
			for (const Star::Idx& i : sn.stars) {
				const Star& star = _sdb->getStar(i);
				sn.ownSpectrum.addWavelength(star.getWavelength(), star.photo_G_mean_flux);
			}

			//printf("leave with %i stars (level %i) energy %f\n", numStars, tn.level, sn.ownSpectrum.getTotalEnergy());
		}
	}
}
*/



void StarTree::_buildTreeSplitHalfDist() {
    struct BuildNode {
        BuildNode(Star::IdxVecIter begin, Star::IdxVecIter end, unsigned char level, NodeIdx node) :
                begin(begin), end(end), level(level), node(node) {
        }

        Star::IdxVecIter begin, end;
        unsigned int level;
        NodeIdx node;
    };

    printf("Creating vector of indices\n");
    Star::IdxVec sdbIndexes(_sdb->getNumStars());
    std::iota(std::begin(sdbIndexes), std::end(sdbIndexes), 0);
    printf("size: %zu\n", sdbIndexes.size());
    std::queue<BuildNode> queue;
    queue.emplace(sdbIndexes.begin(), sdbIndexes.end(), 0, 0);
    _tree.emplace_back();
    _tree[0].emplace_back();
    std::size_t totalStars = 0;
    while (!queue.empty()) {
        BuildNode tn = queue.front();
        queue.pop();
        Node &sn = _tree[tn.level][tn.node];
        long numStars = tn.end - tn.begin;
        printf("LEVEL %i NODE %i [%ti - %ti](%li stars)\n", tn.level, tn.node, tn.begin - sdbIndexes.begin(),
               tn.end - sdbIndexes.begin(), numStars);
        assert(numStars >= 0);
        sort(std::execution::par_unseq, tn.begin, tn.end,
             [=, this](const Star::Idx &a, const Star::Idx &b) -> bool {
                 return _sdb->getStar(a).phot_g_mean_mag < _sdb->getStar(b).phot_g_mean_mag;
             });
        if (numStars > _numMaxStarsNode) {
            // Subdivide
            // copy first stars (brightests) to the tree node
            sn.stars.resize(_numMaxStarsNode);
            std::copy_n(tn.begin, _numMaxStarsNode, sn.stars.begin());
            //compute its BB
            _sdb->getGroupBoundingBox(tn.begin, tn.begin + _numMaxStarsNode, sn.boundingBox);
            // update the upper limit, to exclude those stars already asigned
            std::advance(tn.begin, _numMaxStarsNode);
            // iterator to the middle
            auto mid = tn.begin;
            // look for the splitting point
            float bb[4];
            _sdb->getGroupBoundingBox(tn.begin, tn.end, bb);
            if ((bb[2] - bb[0]) > (bb[3] - bb[1])) {
                // vertical split, lets iterate RA
                sn.clippingCoord = (bb[0] + bb[2]) / 2.f;
                sn.splitAxis = 0;
                sort(std::execution::par_unseq, tn.begin, tn.end,
                     [=, this](const Star::Idx &a, const Star::Idx &b) -> bool {
                         return _sdb->getStar(a).ra < _sdb->getStar(b).ra;
                     });
                while ((mid + 1) != tn.end && _sdb->getStar(*(mid + 1)).ra < sn.clippingCoord) mid++;
            } else {
                // horizontal split, lets iterate DEC
                sn.clippingCoord = (bb[1] + bb[3]) / 2.f;
                sn.splitAxis = 1;
                sort(std::execution::par_unseq, tn.begin, tn.end,
                     [=, this](const Star::Idx &a, const Star::Idx &b) -> bool {
                         return _sdb->getStar(a).dec < _sdb->getStar(b).dec;
                     });
                while ((mid + 1) != tn.end && _sdb->getStar(*(mid + 1)).dec < sn.clippingCoord) mid++;
            }

            printf("  - Subdivide at %f (level %i)\n", sn.clippingCoord, tn.level);

            //Children creation
            unsigned int childrenLevel = tn.level + 1;
            if (_tree.size() > childrenLevel) {
                sn.children[0] = (NodeIdx) _tree[childrenLevel].size();
                sn.children[1] = (NodeIdx) _tree[childrenLevel].size() + 1;
            } else {
                sn.children[0] = 0;
                sn.children[1] = 1;
            }
            queue.emplace(tn.begin, mid, childrenLevel, sn.children[0]);
            queue.emplace(mid, tn.end, childrenLevel, sn.children[1]);
            printf("", tn.begin, mid, tn.end);
            if (_tree.size() <= childrenLevel) {
                _tree.emplace_back();
            }
            _tree[childrenLevel].emplace_back();
            _tree[childrenLevel].emplace_back();
        } else {
            // Leave

            // copy first stars (brightests) to the tree node
            sn.stars.resize(numStars);
            std::copy(tn.begin, tn.end, sn.stars.begin());

            //compute its BB
            _sdb->getGroupBoundingBox(tn.begin, tn.end, sn.boundingBox);

            // compute leaf spectrum
//                for (const Star::Idx &i: sn.stars) {
//                    const Star &star = _sdb->getStar(i);
//                    sn.ownSpectrum.addFlux(star.ls, star.azero_gspphot);
//                    sn.ownSpectrum.addPhotometry(star.phot_rp_mean_flux, star.phot_g_mean_flux, star.phot_bp_mean_flux);
//                    sn.ownSpectrum.addTemperature(star.teff_gspphot);
//                }
//                printf("  - Leaf with %li stars (level %i) energy %.2e\n", numStars, tn.level,
//                       sn.ownSpectrum.getTotalEnergy());
        }

        printf("  - BB: RA(%.2f , %.2f)\tDEC(%.2f , %.2f)\n", sn.boundingBox[0], sn.boundingBox[2],
               sn.boundingBox[1],
               sn.boundingBox[3]);
        printf("  - STARS %zu\n", sn.stars.size());
        totalStars += sn.stars.size();
    }
    printf("TOTAL STARS: %zu\n", totalStars);
}

void StarTree::_fillupSpectra() {
    for (int lev = int(_getLeavesLevel()); lev >= 0; --lev) {
        for (NodeIdx i = 0; i < _tree[lev].size(); ++i) {
            Node &node = _tree[lev][i];
            for (const Star::Idx &j: node.stars) {
                const Star &star = _sdb->getStar(j);
                node.ownSpectrum.addFlux(star.ls, star.azero_gspphot);
                node.ownSpectrum.addPhotometry(star.phot_rp_mean_flux, star.phot_g_mean_flux, star.phot_bp_mean_flux);
                node.ownSpectrum.addTemperature(star.teff_gspphot);
            }
            if (node.children[0] != node.children[1]) {
                node.subtreeSpectrum += _tree[lev + 1UL][node.children[0]].ownSpectrum;
                node.subtreeSpectrum += _tree[lev + 1UL][node.children[1]].ownSpectrum;
                node.subtreeSpectrum += _tree[lev + 1UL][node.children[0]].subtreeSpectrum;
                node.subtreeSpectrum += _tree[lev + 1UL][node.children[1]].subtreeSpectrum;

                node.subtreeStarsCount += _tree[lev + 1UL][node.children[0]].stars.size();
                node.subtreeStarsCount += _tree[lev + 1UL][node.children[1]].stars.size();
                node.subtreeStarsCount += _tree[lev + 1UL][node.children[0]].subtreeStarsCount;
                node.subtreeStarsCount += _tree[lev + 1UL][node.children[1]].subtreeStarsCount;

//                printf("[%2i,%3i] : %zu+%zu+%u+%u=%u\n",
//                       lev, i,
//                       _tree[lev + 1UL][node.children[0]].stars.size(), _tree[lev + 1UL][node.children[1]].stars.size(),
//                       _tree[lev + 1UL][node.children[0]].subtreeStarsCount,
//                       _tree[lev + 1UL][node.children[1]].subtreeStarsCount,
//                       node.subtreeStarsCount
//                );
            }
        }
    }

    printf("TOTAL ENERGY: %.2e\n",
           _tree[0][0].ownSpectrum.getTotalEnergy() + _tree[0][0].subtreeSpectrum.getTotalEnergy());
    printf("INNER NODES: %i\n", getNumInnerNodes());
    printf("LEAF NODES : %i\n", getNumLeafNodes());
}


unsigned int StarTree::getNumInnerNodes() const {
    unsigned int n = 0;
    for (int lev = _getLeavesLevel() - 1; lev >= 0; --lev) n += _tree[lev].size();
    return n;
}

unsigned int StarTree::getNumLeafNodes() const {
    return _tree[_getLeavesLevel()].size();
}

bool StarTree::save(const std::string &file) {
    FILE *fOut = fopen(file.c_str(), "wb");
    if (!fOut) {
        printf("StarTree::save: error opening %s\n", file.c_str());
        return false;
    }
    printf("* Saving tree to %s\n", file.c_str());
    fwrite(&_numMaxStarsNode, 4, 1, fOut);
    unsigned int treeSize = _tree.size();
    fwrite(&treeSize, 4, 1, fOut);
    for (const auto &i: _tree) {
        treeSize = i.size();
        fwrite(&treeSize, 4, 1, fOut);
    }
    for (auto &nl: _tree) {
        std::vector<Star::IdxVec> backup = std::vector<Star::IdxVec>(nl.size());
        // this swap is necessary to have no dangling pointers when trying to load a vector which previously contained data but becomes non-existent
        for (size_t i = 0; i < nl.size(); i++) {
            nl[i].stars.swap(backup[i]);
        }
        if (nl.size() != fwrite(&nl[0], sizeof(Node), nl.size(), fOut)) {
            printf("StarTree::save: error writing %s\n", file.c_str());
            return false;
        }
        for (size_t i = 0; i < nl.size(); i++) {
            nl[i].stars.swap(backup[i]);
        }
        unsigned int s = 0;
        for (const auto &n: nl) {
            s = n.stars.size();
            fwrite(&s, sizeof(unsigned int), 1, fOut);
            if (n.stars.size() != fwrite(&n.stars[0], sizeof(Star::Idx), n.stars.size(), fOut)) {
                printf("StarTree::save: error writing %s\n", file.c_str());
                return false;
            }
        }
    }
    fclose(fOut);
    return true;
}

bool StarTree::load(const std::string &file) {
    _tree.clear();
    FILE *fIn = fopen(file.c_str(), "rb");
    if (!fIn) {
        printf("StarTree::load: error opening %s\n", file.c_str());
        return false;
    }
    printf("* Loading tree from %s\n", file.c_str());
    fread(&_numMaxStarsNode, 4, 1, fIn);
    printf("   - Max Stars per Node: %i\n", _numMaxStarsNode);
    unsigned int treeSize;
    fread(&treeSize, 4, 1, fIn);
    printf("   - Num Levels: %i\n", treeSize);
    _tree.resize(treeSize);
    for (unsigned int i = 0; i < _tree.size(); i++) {
        fread(&treeSize, 4, 1, fIn);
        printf("     - Level %i: %i nodes\n", i, treeSize);
        _tree[i].resize(treeSize);
    }
    printf("   - Reading data\n");
    for (auto &nl: _tree) {
        if (nl.size() != fread(&nl[0], sizeof(Node), nl.size(), fIn)) {
            printf("StarTree::load: error reading %s\n", file.c_str());
            return false;
        }
        unsigned int s;
        for (auto &n: nl) {
            fread(&s, sizeof(unsigned int), 1, fIn);
            n.stars.resize(s);
            if (n.stars.size() != fread(&n.stars[0], sizeof(Star::Idx), n.stars.size(), fIn)) {
                printf("StarTree::load: error reading %s\n", file.c_str());
                return false;
            }
        }
    }
    printf("   - End loading\n");
    fclose(fIn);
    return true;
}


void StarTree::query(Star::IdxVec *result, float minx, float miny, float maxx, float maxy, unsigned int maxLevel) {
    struct TravNode {
        TravNode(unsigned char level, NodeIdx node) : level(level), node(node) {
        }

        unsigned int level;
        NodeIdx node;
    };
    std::queue<TravNode> q;
    q.emplace(0, 0);
    while (!q.empty()) {
        TravNode tn = q.front();
        q.pop();
        const Node &n = _tree[tn.level][tn.node];

        // if out of the node BB => discard
        if (!_intersect(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3], minx, miny, maxx,
                        maxy))
            continue;

        // TODO add stars to the result, operate bacground spectrum, etc. i.e...
        result->insert(result->end(), n.stars.begin(), n.stars.end());

        // check if reached the level threshold
        if (tn.level >= maxLevel) continue;

        // check children
        if (n.splitAxis == 0) {
            // splitted in axis x
            if (minx <= n.clippingCoord) q.emplace(tn.level + 1, n.children[0]);
            if (maxx >= n.clippingCoord) q.emplace(tn.level + 1, n.children[1]);
        } else {
            // splitted in axis y
            if (miny <= n.clippingCoord) q.emplace(tn.level + 1, n.children[0]);
            if (maxy >= n.clippingCoord) q.emplace(tn.level + 1, n.children[1]);
        }
    }
}


void StarTree::chunker(bool verbose) {
    printf("Chunking StarTree ...\n");
    printf("* Saving tree and nodes to %s\n", _path.c_str());

    saveTree(verbose);

    int counter = 0;
    int nodeListCounter = 0;
    std::vector<Node*> nodes;
    for (auto &nl: _tree) {
        for (auto &n: nl) {
            saveNode(n, verbose);
            nodes.push_back(&n);
            if(nodes.size() == _numMaxStarsNode) {
                saveNodes(nodes, nodeListCounter, verbose);
                nodes.clear();
                nodeListCounter++;
            }
            counter++;
        }
    }

    if(nodes.size() > 0) {
        saveNodes(nodes, nodeListCounter, verbose);
        nodes.clear();
    }

    printf("* Saving %d Nodes to %s\n", counter, _path.c_str());
}

bool StarTree::saveTree(bool verbose) {
    std::string file = treePath(_path);
    FILE *fOut = fopen(file.c_str(), "wb");
    if (!fOut) {
        printf("StarTree::saveTree: error opening %s\n", file.c_str());
        return false;
    }
    fwrite(&_numMaxStarsNode, 4, 1, fOut);
    unsigned int n = _sdb->getNumStars();
    fwrite(&n, 4, 1, fOut);
    n = _tree.size();
    fwrite(&n, 4, 1, fOut);
    for (const auto &i: _tree) {
        n = i.size();
        fwrite(&n, 4, 1, fOut);
    }
    for (auto &nl: _tree) {
        for (auto &node: nl) {
            unsigned int compressed = node.splitAxis << 24 | node.id;
            n = node.stars.size();
            fwrite(&compressed, 4, 1, fOut);
            fwrite(&node.clippingCoord, 4, 1, fOut);
            fwrite(&node.boundingBox[0], 4, 4, fOut);
            fwrite(&node.children[0], sizeof(NodeIdx), 2, fOut);
            fwrite(&n, 4, 1, fOut);
            fwrite(&node.subtreeStarsCount, 4, 1, fOut);
            double e = node.ownSpectrum.getTotalEnergy();
            fwrite(&e, 8, 1, fOut);
            e = node.subtreeSpectrum.getTotalEnergy();
            fwrite(&e, 8, 1, fOut);
//            fwrite(&node.ownSpectrum, sizeof(LightSpectrum), 1, fOut);
//            fwrite(&node.subtreeSpectrum, sizeof(LightSpectrum), 1, fOut);
        }
    }
    fclose(fOut);
    printf("* Saving tree structure to %s\n", file.c_str());
    return true;
}

bool StarTree::loadTree(bool verbose) {
    _tree.clear();
    std::string file = treePath(_path);
    FILE *fIn = fopen(file.c_str(), "rb");
    if (!fIn) {
        printf("StarTree::loadTree: error opening %s\n", file.c_str());
        return false;
    }
    printf("* Loading tree from %s\n", file.c_str());
    fread(&_numMaxStarsNode, 4, 1, fIn);
    printf("   - Max Stars per Node: %i\n", _numMaxStarsNode);
    unsigned int n;
    fread(&n, 4, 1, fIn);
    printf("   - Num Stars: %i\n", n);
    fread(&n, 4, 1, fIn);
    printf("   - Num Levels: %i\n", n);
    _tree.resize(n);
    for (unsigned int i = 0; i < _tree.size(); i++) {
        fread(&n, 4, 1, fIn);
        printf("     - Level %i: %i nodes\n", i, n);
        _tree[i].resize(n);
    }
    printf("   - Reading data\n");
    for (auto &nl: _tree) {
        for (auto &node: nl) {
            unsigned int compressed;
            fread(&compressed, 4, 1, fIn);
            node.splitAxis = compressed >> 24 & 0xFF;
            node.id = compressed & 0xFFFFFF;
            fread(&node.clippingCoord, 4, 1, fIn);
            fread(&node.boundingBox[0], 4, 4, fIn);
            fread(&node.children[0], sizeof(NodeIdx), 2, fIn);
            fread(&n, 4, 1, fIn); // count
            fread(&node.subtreeStarsCount, 4, 1, fIn);
            double e;
            fread(&e, 8, 1, fIn);
            fread(&e, 8, 1, fIn);
//            fread(&node.ownSpectrum, sizeof(LightSpectrum), 1, fIn);
//            fread(&node.subtreeSpectrum, sizeof(LightSpectrum), 1, fIn);
            node.stars.resize(n);
//            if (verbose)
//                printf("id: %d, splitAxis: %d, clippingCoord: %f, children: %d %d\n", node.id, node.splitAxis,
//                       node.clippingCoord, node.children[0], node.children[1]);
        }
    }
    printf("   - End loading\n");
    fclose(fIn);
    return true;
}

bool StarTree::saveNode(Node &node, bool verbose) {
    std::string file = nodePath(_path, node.id);
    FILE *fOut = fopen(file.c_str(), "wb");
    if (!fOut) {
        printf("StarTree::saveNode: error opening %s\n", file.c_str());
        return false;
    }
    if (verbose) printf("* Saving node to %s\n", file.c_str());
//    Star::IdxVec backup;
//    node.stars.swap(backup);
//    fwrite(&node, sizeof(Node), 1, fOut);
//    node.stars.swap(backup);

//    unsigned int s = node.stars.size();
//    fwrite(&s, sizeof(unsigned int), 1, fOut);
//    if (node.stars.size() != fwrite(&node.stars[0], sizeof(Star::Idx), node.stars.size(), fOut)) {
//        printf("StarTree::saveNode: error writing %s\n", file.c_str());
//        return false;
//    }

    std::vector<MinStar> stars;
    for (auto &starId: node.stars) {
        const Star &star = _sdb->getStar(starId);
        MinStar minStar;
        minStar.id = star.id;
        minStar.ra = star.ra;
        minStar.dec = star.dec;
        minStar.ownSpectrum.addFlux(star.ls, star.azero_gspphot);
        minStar.ownSpectrum.addPhotometry(star.phot_rp_mean_flux, star.phot_g_mean_flux, star.phot_bp_mean_flux);
        minStar.ownSpectrum.addTemperature(star.teff_gspphot);
        stars.push_back(minStar);
    }
    if (stars.size() != fwrite(&stars[0], sizeof(MinStar), stars.size(), fOut)) {
        printf("StarTree::saveNode: error writing %s\n", file.c_str());
        return false;
    }
    fclose(fOut);
    return true;
}

bool StarTree::loadNode(std::string path, StarTree::Node &node, std::vector<StarTree::MinStar> &stars, bool verbose) {
//    node.stars.clear();
    std::string file = nodePath(path, node.id);
    if (verbose) printf("loadNode: opening %s\n", file.c_str());
    FILE *fIn = fopen(file.c_str(), "rb");
    if (!fIn) {
        printf("loadNode: error opening %s\n", file.c_str());
        return false;
    }
    if (verbose) printf("* Loading node from %s\n", file.c_str());
//    fread(&node, sizeof(StarTree::Node), 1, fIn);
//    unsigned int s;
//    fread(&s, sizeof(unsigned int), 1, fIn);
//    node.stars.resize(s);
//    if (node.stars.size() != fread(&node.stars[0], sizeof(Star::Idx), node.stars.size(), fIn)) {
//        printf("loadNode: error reading star indicies %s\n", file.c_str());
//        return false;
//    }
    stars.resize(node.stars.size());
    if (stars.size() != fread(&stars[0], sizeof(StarTree::MinStar), stars.size(), fIn)) {
        printf("loadNode: error reading stars %s\n", file.c_str());
        return false;
    }

    fclose(fIn);
    return true;
}

bool StarTree::loadNode(StarTree::Node &node, std::vector<StarTree::MinStar> &stars, bool verbose) {
    return loadNode(_path, node, stars, verbose);
}


bool StarTree::saveNodes(std::vector<Node*> &nodeList, int filenum, bool verbose) {
    std::string file = nodeListPath(_path, filenum);
    FILE *fOut = fopen(file.c_str(), "wb");
    if (!fOut) {
        printf("StarTree::saveNodes: error opening %s\n", file.c_str());
        return false;
    }
    if (verbose) printf("* Saving %lu nodes to %s\n", nodeList.size(), file.c_str());

    unsigned int s = nodeList.size();
    fwrite(&s, sizeof(unsigned int), 1, fOut);

    for(auto node: nodeList) {
        fwrite(&node->ownSpectrum, sizeof(LightSpectrum), 1, fOut);
        fwrite(&node->subtreeSpectrum, sizeof(LightSpectrum), 1, fOut);
    }

    fclose(fOut);
    return true;
}


bool StarTree::loadNodes(std::string path, std::vector<Node> &nodeList, int filenum, bool verbose) {
//    node.stars.clear();
    std::string file = nodeListPath(path, filenum);
    if (verbose) printf("loadNodes: opening %s\n", file.c_str());
    FILE *fIn = fopen(file.c_str(), "rb");
    if (!fIn) {
        printf("loadNodes: error opening %s\n", file.c_str());
        return false;
    }
    unsigned int s;
    fread(&s, sizeof(unsigned int), 1, fIn);
    nodeList.resize(s);
    if (verbose) printf("* Loading %lu nodes from %s\n", s, file.c_str());

    for(auto node: nodeList) {
        fread(&node.ownSpectrum, sizeof(LightSpectrum), 1, fIn);
        fread(&node.subtreeSpectrum, sizeof(LightSpectrum), 1, fIn);
    }

    fclose(fIn);
    return true;
}

bool StarTree::loadNodes(std::vector<Node> &nodeList, int filenum, bool verbose) {
    return loadNodes(_path, nodeList, filenum, verbose);
}


void StarTree::chunksQuery(NodeIdxVec *result,
                           std::map<uint64_t, bool> *isLeaf,
                           std::vector<ViewBound> &view_bounds,
                           unsigned int maxLevel,
                           float area_threshold) {
    maxLevel = std::min(maxLevel, (unsigned int) _tree.size());

    struct TravNode {
        TravNode(unsigned char level, NodeIdx node) : level(level), node(node) {
        }

        unsigned int level;
        NodeIdx node;
    };
    std::queue<TravNode> q;
    q.emplace(0, 0);
    //    printf("QUERY\n");
    while (!q.empty()) {
        TravNode tn = q.front();
        q.pop();
        const Node &n = _tree[tn.level][tn.node];

        // if out of the node BB => discard
        bool intersect = false;
        for (const auto &lim: view_bounds) {
            intersect = intersect || _intersect(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3],
                                                lim.l, lim.b, lim.r, lim.t);
        }
        if (!intersect) continue;

        // check if node is big enough
        bool node_is_big = false;
        for (const auto &lim: view_bounds) {
            node_is_big = node_is_big || _area_threshold(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2],
                                                         n.boundingBox[3], lim.l, lim.b, lim.r, lim.t, area_threshold);
        }

        result->push_back(n.id);
        (*isLeaf)[n.id] = tn.level >= (maxLevel - 1) || (n.children[0] == n.children[1]) || !node_is_big;

        // check if reached the level threshold
        if ((*isLeaf)[n.id]) continue;

        // add children
        q.emplace(tn.level + 1, n.children[0]);
        q.emplace(tn.level + 1, n.children[1]);
    }
    //    printf("\nEND QUERY\n");
}


void StarTree::printTree() {
    printf("digraph {\n");
    int i = 0;
    for (auto &nl: _tree) {
        i++;
        if (i == _tree.size()) break;
        for (auto &n: nl) {
            if (n.children[0] != n.children[1]) {
                printf("\t%d -> %d\n", n.id, _tree[i][n.children[0]].id);
                printf("\t%d -> %d\n", n.id, _tree[i][n.children[1]].id);
            }
        }
    }
    printf("}\n");
}
