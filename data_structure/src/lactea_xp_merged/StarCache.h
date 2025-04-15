#pragma once

#include <list>
#include <unordered_map>
#include <cassert>
#include "star.hpp"

// https://stackoverflow.com/questions/2504178/lru-cache-design
class StarCache {
private:
    std::list<std::pair<unsigned int, Star*>> item_list;
    std::unordered_map<unsigned int, decltype(item_list.begin()) > item_map;
    size_t cache_size;
    int hit = 0, miss = 0;
private:
    void clean(void){
        while(item_map.size()>cache_size){
            auto last_it = item_list.end();
            last_it --;
            item_map.erase(last_it->first);
            item_list.pop_back();
            printf("size clean: %d %d\n", item_list.size(), item_map.size());
            assert(item_list.size() == item_map.size());
        }
    };
public:
    StarCache(int cache_size_): cache_size(cache_size_) { };

    void put(unsigned int &key,  Star* val){
        auto it = item_map.find(key);
        if(it != item_map.end()){
            item_list.erase(it->second);
            item_map.erase(it);
            assert(item_list.size() == item_map.size());
            printf("size put: %d %d\n", item_list.size(), item_map.size());
        }
        item_list.push_front(std::make_pair(key,val));
        item_map.insert(std::make_pair(key, item_list.begin()));
        clean();
    };
    bool exist(const unsigned int &key){
        if((item_map.count(key)>0)) {
            hit += 1;
            return true;
        }
        miss += 1;
        return false;
    };
    Star* get(const unsigned int &key){
        assert(exist(key));
        auto it = item_map.find(key);
        printf("size before: %d %d\n", item_list.size(), item_map.size());
        item_list.splice(item_list.begin(), item_list, it->second);
        printf("size after: %d %d\n", item_list.size(), item_map.size());

//        assert(item_list.size() == item_map.size());
        return it->second->second;
    };

    void printState() {
        printf("Hit: %d. Miss: %d\n", hit, miss);
    }
};