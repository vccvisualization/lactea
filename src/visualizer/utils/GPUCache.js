// https://stackoverflow.com/questions/996505/lru-cache-implementation-in-javascript
export class GPUCache {
    constructor(max = 10, chunkSize) {
        this.max = max;
        this.cache = new Map();
        this.offsets = Array.from({ length: max }, (x, i) => i * chunkSize)
    }

    upateSize(max) {
        this.max = max;
    }

    get(key) {
        let item = this.cache.get(key);
        if (item !== undefined) {
            // refresh key
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key, val=[]) {
        let offset;
        // refresh key
        if (this.cache.has(key)) {
            offset = this.cache.get(key)[0];
            this.cache.delete(key);
        }
        // evict oldest
        else if (this.cache.size === this.max) { 
            const toDeleteKey = this.first();
            offset = this.cache.get(toDeleteKey)[0];
            this.cache.delete(toDeleteKey);
        } else {
            offset = this.offsets.shift();
        }
        this.cache.set(key, [offset, ...val]);

        return offset;
    }

    first() {
        return this.cache.keys().next().value;
    }
}