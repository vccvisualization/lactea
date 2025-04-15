#include <lactea_xp_merged/raw_star_db.hpp>
#include <lactea_xp_merged/star_tree.hpp>


int main(int argc, char** argv) {

	if (argc < 4) {
		printf("Use %s [outputDirectory] [stardb] [str] \n", argv[0]);
		return 0;
	}

	std::string outputDirectory = argv[1];
    std::string pathStarDB = argv[2];
    std::string pathStarTree = argv[3];

    printf("INPUT:\n\t[outputDirectory]: %s\n\t[stardb]: %s\n\t[str]: %s\n\n", outputDirectory.c_str(), pathStarDB.c_str(), pathStarTree.c_str());

	RawStarDB sdb(true, 10000);
	sdb.load(pathStarDB, true);
	StarTree st;
	st.setStarDB(&sdb);
    st.setNodePath(outputDirectory);
    st.load(pathStarTree);
    st.printTree();
    st.chunker(true);

    st.loadTree(true);
    printf("# levels: %d\n", st.getNumLevels());

    StarTree::Node n(0);
    std::vector<StarTree::MinStar> stars;
    st.loadNode(n, stars, true);
    printf("id: %d, num stars: %d, clippingCoord: %f, children: %d %d\n", n.id, n.stars.size(), n.clippingCoord, n.children[0], n.children[1]);
//    printf("x: %f, y: %f, wl: %f %f, e: %f\n", stars[4].ra, stars[4].dec, stars[4].nu_astrometry, stars[4].pseudocolor, stars[4].photo_G_magnitude);

    return 0;
}