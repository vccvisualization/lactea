#pragma once

#include <vector>
#include <map>
#include <string>
#include <stdexcept>


static std::map<std::string, std::string> parse_options(int argc, char** argv){
    std::map<std::string, std::string> options = std::map<std::string, std::string>();
    for (size_t i = 0; i < argc; i++){
        std::string s(argv[i]);
        if(s[0] == '-'){
            s = s.substr(1);
            std::string next;
            if((i+1) < argc && (next = argv[i+1])[0] != '-'){
                options[s] = next;
                i++;
            }else{
                options[s] = "";
            }
        }
    }
    return options;
}

static std::string options_to_str(std::map<std::string, std::string> &options){
    std::string s = "";
    for (auto const& [key, val] : options){
        s += key + " = " + val + '\n';
    }
    return s;
}

static void read_option(std::map<std::string, std::string> &options, const char* key, bool &val) {
    val = options.contains(key);
}

static void read_option(std::map<std::string, std::string> &options, const char* key, int &val) {
    if(options.contains(key)) {
        try {
            val = std::stoi(options[key]);
        }
        catch (std::invalid_argument &) {
            printf("Failed to convert %s: %s\n", key, options[key].c_str());
        }
    }
}

static void read_option(std::map<std::string, std::string> &options, const char* key, float &val) {
    if(options.contains(key)) {
        try {
            val = std::stof(options[key]);
        }
        catch (std::invalid_argument &) {
            printf("Failed to convert %s: %s\n", key, options[key].c_str());
        }
    }
}

static void read_option(std::map<std::string, std::string> &options, const char* key, std::string &val) {
    if(options.contains(key)) {
        val = options[key];
    }
}

static void write_option(std::map<std::string, std::string> &options, const char* key, bool &val) {
    if(val) {
        options[key] = "true";
    }
    else {
        options.erase(key);
    }
}

static void write_option(std::map<std::string, std::string> &options, const char* key, int &val) {
    options[key] = std::to_string(val);
}

static void write_option(std::map<std::string, std::string> &options, const char* key, float &val) {
    options[key] = std::to_string(val);
}

static void write_option(std::map<std::string, std::string> &options, const char* key, std::string &val) {
    options[key] = val;
}