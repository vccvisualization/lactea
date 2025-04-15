#pragma once

#include "glm/vec2.hpp"
#include "lactea/light_spectrum.hpp"

#include <vector>
#include <numeric>
#include <algorithm>
#include <string>
#include <map>


struct SpectrumBound {
    int l, r;
    float b, t;
};

struct color_map_point {
    float lambda;
    float color[3];
};

struct color_map {
    std::string name;
    std::vector<color_map_point> points;
};

struct texture_vertex {
    float x, y, u, v;
};

struct MeasurementHelper{
    size_t counter = 0;
    std::map<std::string, std::map<size_t, double>> times;
    std::map<std::string, std::map<size_t, std::string>> settings;

    void startMeasure(std::string name, double time){
        if(!times.contains(name)) times[name] = std::map<size_t, double>();
        times[name][counter] = time;
    }

    void endMeasure(std::string name, double time){
        times[name][counter] = (time - times[name][counter]);
    }

    void setSetting(std::string name, std::string value){
        settings[name][counter] = value;
    }

    void endFrame(){
        counter++;
    }

    std::string resultString(){
        std::string results = "";
        for(size_t i = 0; i < counter; i++){
            bool first = true;
            results += "\n";
            for(auto const& [key, val] : times){
                results += (first ? "" : ",") + (val.contains(i) ? std::to_string(val.at(i)) : "0.0");
                first = false;
            }
            for(auto const& [key, val] : settings){
                results += (first ? "" : ",") + (val.contains(i) ? val.at(i) : "");
                first = false;
            }
        }
        return results;
    }

    std::string collumnsString(){
        std::string collumns = "";
        bool first = true;
        for(auto const& [key, val] : times){
            collumns += (first ? "" : ",") + key;
            first = false;
        }
        for(auto const& [key, val] : settings){
            collumns += (first ? "" : ",") + key;
            first = false;
        }
        return collumns;
    }
};

template <typename T, size_t SIZE>
struct CircularBufferSum{
    T buffer[SIZE];
    size_t index = 0;
    size_t count = 0;
    T sum = static_cast<T>(0);

    void addValue(T value){
        if(count == SIZE) sum -= buffer[(index+1) % SIZE];
        sum += value;
        buffer[(index++) % SIZE] = value;
        count = std::min(count+1, SIZE);
    }

    T getAvg(){
        return sum / static_cast<T>(count);
    }
};
