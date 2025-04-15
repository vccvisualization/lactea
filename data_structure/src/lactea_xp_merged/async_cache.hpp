#pragma once

#include <thread>
#include <vector>
#include <queue>
#include <iostream>
#include <fstream>
#include <iterator>
#include <chrono>
#include <mutex>
#include <condition_variable>
#include <list>
#include <unordered_map>
#include <atomic>

//#define ASYNC_CACHE_VERBOSE

class AsyncLRUCacheMultiDynMem {

protected:
	typedef std::pair<uint64_t, std::size_t> TDataPair;
	typedef struct LoadingThread {
		std::thread thread;
		std::mutex mutex;
		std::condition_variable cv;
		bool loading = false;
		uint64_t loadingChunkIdx;
		std::size_t numLoadedChunks = 0;
	} LoadingThread;

	std::size_t _numElementsCache = 16;
	std::size_t _chunkSize = 0;
	unsigned int _numLoadingThreads = 4;

	unsigned char * _cacheData;
	std::list<TDataPair> _priorityList;
	std::unordered_map<uint64_t, std::list<TDataPair>::iterator> _cacheHash;
	std::queue<uint64_t> _requests;

	std::thread _controllerThread;
	std::vector<LoadingThread> _loadingThreads;

	std::mutex _mutexRequests, _mutexStructs, _mutexFreeLoader;
	std::condition_variable _cvRequests, _cvFreeLoader;
	unsigned int _numOccupiedLoaders = 0;

	std::size_t _hits = 0;
	std::size_t _misses = 0;
	std::size_t _missesWhileLoading = 0;

	std::atomic_bool _finish = false;
	std::size_t _numChunksInCache = 0;

public:
	virtual bool loadChunk(uint64_t chunkIdx, void* cacheelemPtr) = 0;
	using RequestsList = std::vector<uint64_t>;

public:

	AsyncLRUCacheMultiDynMem(std::size_t numElements, std::size_t chunkSizeBytes, unsigned int numLoadingThreads) :
		_numElementsCache(numElements), _chunkSize(chunkSizeBytes), _numLoadingThreads(numLoadingThreads)
	{
 		std::cout << "Cache with " << _numLoadingThreads << " thread/s: Allocating " << _numElementsCache * _chunkSize << " bytes ...";
		_cacheData = (unsigned char *)malloc(_numElementsCache * _chunkSize);
		std::cout << "Cache: OK.\n";
		_loadingThreads = std::vector<LoadingThread>(_numLoadingThreads);
		_numOccupiedLoaders = 0;
	}

	~AsyncLRUCacheMultiDynMem() {
		//end();
		free(_cacheData);
	}

	void start() {
		// Rise loading threads
		for (unsigned int i = 0; i < _numLoadingThreads; ++i)
			_loadingThreads[i].thread = std::thread(&AsyncLRUCacheMultiDynMem::_loadingThreadProcess, this, i);

		// Rise control thread
		_controllerThread = std::thread(&AsyncLRUCacheMultiDynMem::_controllerThreadProcess, this);
	}

	void end() {
		_finish = true;
		_cvFreeLoader.notify_all();
		_cvRequests.notify_all();
		for (unsigned int i = 0; i < _numLoadingThreads; ++i) {
			_loadingThreads[i].cv.notify_all();
			_loadingThreads[i].thread.join();
		}
		_controllerThread.join();
	}

	void clearRequestList() {
		std::lock_guard<std::mutex> guard(_mutexRequests);
		while (!_requests.empty()) {
			_requests.pop();
		}
	}

	void reset() {
		std::cout << "Starting async cache reset...\n";

		clearRequestList();

		std::unique_lock<std::mutex> lockFreeLoader(_mutexFreeLoader);
		_cvFreeLoader.wait(lockFreeLoader, [=] { return (_numOccupiedLoaders == 0 || _finish); });

		_mutexRequests.lock();
		_mutexStructs.lock();

		_numChunksInCache = 0;
		_cacheHash.clear();
		_priorityList.clear();

		for (LoadingThread & lt : _loadingThreads) {
			lt.numLoadedChunks = 0;
		}

		_hits = 0; _misses = 0; _missesWhileLoading = 0;

		_mutexRequests.unlock();
		_mutexStructs.unlock();
	}

	void addRequest(uint64_t id) {
		std::unique_lock<std::mutex> lock(_mutexRequests);
#if defined ASYNC_CACHE_VERBOSE
		std::cout << "Adding request " << id << " \n";
#endif
		_requests.push(id);
		_cvRequests.notify_one();
	}

	void addRequest(std::vector<uint64_t> listIds) {
		clearRequestList();
		std::unique_lock<std::mutex> lock(_mutexRequests);
#if defined ASYNC_CACHE_VERBOSE
		std::cout << "Adding request list with " << listIds.size() << " IDs.\n";
#endif
		for (auto i : listIds) _requests.push(i);
		//_requests.insert(_requests.end(), listIds.begin(), listIds.end());
		_cvRequests.notify_one();
	}

	bool isAvailable(uint64_t id) {
		std::lock_guard<std::mutex> guard(_mutexStructs);
		auto iter = _cacheHash.find(id);
		return iter != _cacheHash.end();
	}

	const void * getData(uint64_t id) {
		std::lock_guard<std::mutex> guard(_mutexStructs);
		auto iter = _cacheHash.find(id);
		if (iter != _cacheHash.end()) {
			return getPtrCacheElement(iter->second->second);
		}
		return nullptr;
	}

	void printState() {
		for (auto node : _priorityList) std::cout << "[" << node.first << "->" << node.second << "] "; std::cout << std::endl;
		std::cout << "misses: " << _misses << ", missesWhileLoading: " << _missesWhileLoading << ", hits: " << _hits << std::endl;
		std::cout << "Thread loads:";
		for (unsigned int i = 0; i < _loadingThreads.size(); ++i) std::cout << " [" << i << "]: " << _loadingThreads[i].numLoadedChunks; std::cout << std::endl;
	}

	void syncLoad(uint64_t id) {

		std::lock_guard<std::mutex> lock(_mutexStructs);
		std::size_t toLoadCacheIdx;
		if (_numChunksInCache < _numElementsCache) {
			toLoadCacheIdx = _numChunksInCache;
			_numChunksInCache++;
		}
		else {
			TDataPair last = _priorityList.back();
			toLoadCacheIdx = last.second;
			_cacheHash.erase(last.first);
			_priorityList.pop_back();
		}

		if (loadChunk(id, getPtrCacheElement(toLoadCacheIdx))) {
			_priorityList.emplace_front(id, toLoadCacheIdx);
			_cacheHash[id] = _priorityList.begin();
#if defined ASYNC_CACHE_VERBOSE
			std::cout << "MISS: loading data chunk " << id << " in " << toLoadCacheIdx << std::endl;
#endif
		} else std::cout << "Sync Load: something wrong loading Idx " << id << std::endl;
	}

private:

	inline void* getPtrCacheElement(std::size_t idx) { return (void*)& _cacheData[idx * _chunkSize]; }

	void _controllerThreadProcess() {

		auto begin = std::chrono::steady_clock::now();

		while (!_finish) {
			std::unique_lock<std::mutex> lockRequests(_mutexRequests);
			_cvRequests.wait(lockRequests, [=] { return !_requests.empty() || _finish; });
#if defined ASYNC_CACHE_VERBOSE
			std::cout << "controller thread woken up" << std::endl;
#endif
			if (_finish) break;
			
			uint64_t chunkIdxToLoad = 0;
			if (!_requests.empty()) {
				chunkIdxToLoad = _requests.front();
				_requests.pop();
			}
			else continue;

			_mutexStructs.lock();
			// Check if already in cache
			bool skipLoading = false;
			auto iter = _cacheHash.find(chunkIdxToLoad);
			if (iter != _cacheHash.end()) { // found in cache
				_priorityList.splice(_priorityList.begin(), _priorityList, iter->second); // cache hit -> put into the head of the list
				_hits++;
#if defined ASYNC_CACHE_VERBOSE
				std::cout << "HIT : data chunk " << chunkIdxToLoad << " is in " << iter->second->second << std::endl;
#endif
				skipLoading = true;
			}

			// Check if is being loaded by some of the threads
			for (auto& lt : _loadingThreads) {
				if (lt.loading && lt.loadingChunkIdx == chunkIdxToLoad) {
					_missesWhileLoading++;
#if defined ASYNC_CACHE_VERBOSE
					std::cout << "Data chunk " << chunkIdxToLoad << " is being loaded... " << std::endl;
#endif
					break;
				}
			}

			_mutexStructs.unlock();
			if (skipLoading) continue;


			// Otherwise, it is a miss. Let's assign it to a free loader
			_misses++;

			_mutexRequests.unlock();
			std::unique_lock<std::mutex> lockFreeLoader(_mutexFreeLoader);
			_cvFreeLoader.wait(lockFreeLoader, [=] { return _numOccupiedLoaders < _numLoadingThreads || _finish; });
			_mutexRequests.lock();
			if (_finish) break;

			for (unsigned int i = 0; i < _loadingThreads.size(); ++i) {
				LoadingThread& lt = _loadingThreads[i];
				if (!lt.loading) {
					lt.loadingChunkIdx = chunkIdxToLoad;
					lt.loading = true;
					lt.cv.notify_one();
#if defined ASYNC_CACHE_VERBOSE
					std::cout << "Assigning " << chunkIdxToLoad << " to thread " << i << std::endl;
#endif
					break;
				}
			}
		}
	}

	void _loadingThreadProcess(unsigned int threadIdx) {

		LoadingThread& lt = _loadingThreads[threadIdx];
		auto begin = std::chrono::steady_clock::now();
#if defined ASYNC_CACHE_VERBOSE
		std::cout << "Starting thread " << threadIdx << std::endl;
#endif
		while (!_finish) {
			std::unique_lock<std::mutex> lockRequests(lt.mutex);
			lt.cv.wait(lockRequests, [&]() { return lt.loading || _finish; });
#if defined ASYNC_CACHE_VERBOSE
			std::cout << "loading thread" << threadIdx << " woken up" << std::endl;
#endif
			if (_finish) break;
			_numOccupiedLoaders++;
#if defined ASYNC_CACHE_VERBOSE
			std::cout << "Thread " << threadIdx << " loading " << lt.loadingChunkIdx << std::endl;
#endif
			_mutexStructs.lock();
			std::size_t toLoadCacheIdx;
			if (_numChunksInCache < _numElementsCache) {
				toLoadCacheIdx = _numChunksInCache;
				_numChunksInCache++;
			}
			else {
				TDataPair last = _priorityList.back();
				toLoadCacheIdx = last.second;
				_cacheHash.erase(last.first);
				_priorityList.pop_back();
			}
			_mutexStructs.unlock();
			if(loadChunk(lt.loadingChunkIdx, getPtrCacheElement(toLoadCacheIdx))) {
				std::lock_guard<std::mutex> lock(_mutexStructs);
				_priorityList.emplace_front(lt.loadingChunkIdx, toLoadCacheIdx);
				_cacheHash[lt.loadingChunkIdx] = _priorityList.begin();
#if defined ASYNC_CACHE_VERBOSE
				std::cout << "MISS: loading data chunk " << lt.loadingChunkIdx << " in " << toLoadCacheIdx << std::endl;
#endif
				lt.numLoadedChunks++;
			}
			else {
				printf("Thread %i: something wrong loading Idx %zu\n", threadIdx, lt.loadingChunkIdx);
			}
			lt.loading = false;
			_numOccupiedLoaders--;
			_cvFreeLoader.notify_one();
		}
	}
};