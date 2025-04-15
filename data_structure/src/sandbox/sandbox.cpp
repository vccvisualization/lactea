
#include <lactea_xp_merged/star.hpp>
#include <iostream>

#include <lactea_xp_merged/raw_star_db.hpp>
#include <lactea_xp_merged/star_tree.hpp>


int main(int argc, char** argv) {

    printf("starting ...");
    if (argc < 5) {
		printf("Use %s [stardb] [str] [outputDirectory] [MaxStarsPerNode] \n", argv[0]);
		return 0;
	}
    std::string dbFilename(argv[1]);
    std::string treeFilename(argv[2]);
    std::string outputDirectory(argv[3]);
    unsigned int maxStarsPerNode = atoi(argv[4]);

    RawStarDB sdb;
    sdb.load(dbFilename, true);

    StarTree st;
    st.setStarDB(&sdb);
    st.setNodePath(outputDirectory);

    st.build(maxStarsPerNode);
    st.save(treeFilename);
    st.load(treeFilename);
    st.chunker(true);
    st.loadTree(true);
    st.printTree();
    return 0;
}