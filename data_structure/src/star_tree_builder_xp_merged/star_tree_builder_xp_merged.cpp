
#include <lactea_xp_merged/star.hpp>
#include <iostream>

#include <lactea_xp_merged/raw_star_db.hpp>
#include <lactea_xp_merged/star_tree.hpp>

int main(int argc, char** argv) {

	if (argc < 4) {
		printf("Use %s [stardb] [MaxStarsPerNode] [OutputPath]\n", argv[0]);
		return 0;
	}

	std::string pathStarDB = argv[1];
	unsigned int maxStarsPerNode = atoi(argv[2]);
	std::string pathOut = argv[3];

    printf("INPUT:\n\t[stardb]: %s\n\t[MaxStarsPerNode]: %u\n\t[OutputPath]: %s\n",
           pathStarDB.c_str(), maxStarsPerNode, pathOut.c_str());

	RawStarDB sdb;
	sdb.load(pathStarDB, true);
	StarTree st;
	st.setStarDB(&sdb);
	st.build(maxStarsPerNode);
    st.printTree();
    st.save(pathOut);
	st.load(pathOut);
    return 0;
}