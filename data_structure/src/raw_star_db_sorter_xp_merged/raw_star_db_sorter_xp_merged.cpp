
#include <lactea_xp_merged/star.hpp>
#include <iostream>

#include <external_sort/external_sort.hpp>



struct StarComparator
{
    bool operator()(const Star& x, const Star& y) const {
        return x.phot_g_mean_mag < y.phot_g_mean_mag;
    }
};

struct Star2Str
{
    std::string operator()(const Star& x)
    {
        std::ostringstream ss;
        ss << ""; // (st::format("%lu\t%.5f\t%.5f\t%.5f\t") % x.id % x.ra % x.dec & x.phot_g_mean_mag)
        return ss.str();
    }
};

//struct CustomRecordGenerator
//{
//    Star operator()()
//    {
//        CustomRecord x;
//        std::ostringstream name;
//        std::ostringstream text;
//        x.id = rand();
//        cnt++;
//        name << boost::format("Name %03d") % cnt;
//        memcpy(x.name, name.str().c_str(), sizeof(x.name));
//        x.name[sizeof(x.name) - 1] = '\0';
//        text << boost::format("Text %03d") % cnt;
//        memcpy(x.text, text.str().c_str(), sizeof(x.text));
//        x.text[sizeof(x.text) - 1] = '\0';
//        return x;
//    }
//    size_t cnt = 0;
//};

namespace external_sort {
    template <>
    struct ValueTraits<Star>
    {
        using Comparator = StarComparator;
        using Generator = DefaultValueGenerator<Star>;
        using Value2Str = Star2Str;

        // .. or default generator with all random bytes:
        // using Generator = DefaultValueGenerator<CustomRecord>;
    };
}

int main(int argc, char** argv) {
    printf("starting ...");
	if (argc < 3) return -1;
	std::string filenameIn(argv[1]);
	std::string filenameOut(argv[2]);

// set split and merge parameters
    external_sort::SplitParams sp;
    external_sort::MergeParams mp;
    sp.mem.size = 1000;
    sp.mem.unit = external_sort::MB;
    mp.mem = sp.mem;
    sp.spl.ifile = filenameIn;
    mp.mrg.ofile = filenameOut;

    using ValueType = Star;

    // run external sort
    external_sort::sort<ValueType>(sp, mp);

    if (sp.err.none && mp.err.none) {
        std::cout << "File sorted successfully!" << std::endl;
    } else {
        std::cout << "External sort failed!" << std::endl;
        if (sp.err) {
            std::cout << "Split failed: " << sp.err.msg() << std::endl;
        } else {
            std::cout << "Merge failed: " << mp.err.msg() << std::endl;
        }
    }
	return 0;
}
