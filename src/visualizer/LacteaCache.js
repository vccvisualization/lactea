import { LacteaInterface } from "./LacteaInterface.js";
import { MinStar } from "../lactea/MinStar.js";
import { Node } from "../lactea/Node.js";
import { GPUCache } from "./utils/GPUCache.js";


export class LacteaCache {
    static STAR_INFO_COUNT = 4;
    constructor(maxComputeWorkgroupsPerDimension, bufferSize, BASE = "") {
        this.computeLimit = maxComputeWorkgroupsPerDimension;
        this.bufferSize = bufferSize;
        this.lactea = new LacteaInterface(BASE);
        this.settings = {};
        this.query = [];
        this.patches = [];
        this.starsTotal = 0;
        this.loadedStars = 0;
        this.nodesTotal = 0;
        this.loadedNodes = 0;

        this.load({});
    }

    load(settings) {
        this.settings.cachePreload = settings?.cachePreload ?? 5;
        this.settings.deltaLoop = settings?.deltaLoop ?? 20;
        this.settings.maxLoadingReq = settings?.maxLoadingReq ?? 50;
        this.lactea.load(settings?.interface ?? {});
    }

    store() {
        return { ...this.settings, interface: this.lactea.store() };
    }

    async init(device) {
        await this.lactea.init();
        console.log("compute limi", this.computeLimit);
        this.device = device;
        this.computeLimit = Math.floor(64 * this.computeLimit / (MinStar.NUM_ATTR * this.lactea.tree.getNumMaxStarsNode()));
    
        console.log("compute limi", this.computeLimit);
        // star gpu cache
        this.starLoading = new Set();
        this.nodeLoading = new Set();
        this.starChunkSize = (MinStar.NUM_ATTR * 4 * this.lactea.tree.getNumMaxStarsNode()); // num attr x 4 bytes x how many stars
        this.starL1GpuCache = new GPUCache(Math.min(Math.floor(this.bufferSize / this.starChunkSize), Math.floor(this.lactea.tree.numNodes / 2)), this.starChunkSize);
        this.starL2GpuCache = new GPUCache(Math.min(Math.floor(this.bufferSize / this.starChunkSize), Math.ceil(this.lactea.tree.numNodes / 2)), this.starChunkSize);


        this.minStarL1Buffer = this.device.createBuffer({
            label: "minStar Buffer L1",
            size: this.starL1GpuCache.max * this.starChunkSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.minStarL2Buffer = this.device.createBuffer({
            label: "minStar Buffer L2",
            size: this.starL2GpuCache.max * this.starChunkSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.cacheInfoBuffer = this.device.createBuffer({
            label: 'cacheInfoBuffer',
            size: Math.max(LacteaCache.STAR_INFO_COUNT * (this.starL1GpuCache.max + this.starL2GpuCache.max) * 4, 32), 
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        console.log(`Star GPU Cache L1 size (${this.starL1GpuCache.max}) [${this.minStarL1Buffer.size * 1e-6} megabytes]`);
        console.log(`Star GPU Cache L2 size (${this.starL2GpuCache.max}) [${this.minStarL2Buffer.size * 1e-6} megabytes]`);


        // node gpu cache
        this.nodeChunkSize = (Node.NUM_ATTR) * 4; // num attr x 4 bytes
        this.nodeGpuCache = new GPUCache(this.lactea.tree.numNodes, this.nodeChunkSize);
        this.nodeBuffer = this.device.createBuffer({
            label: "node Buffer",
            size: this.nodeGpuCache.max * this.nodeChunkSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.gpuNodeOffsetsBuffer = this.device.createBuffer({
            label: 'gpuNodesBuffer',
            size: Math.max(this.nodeGpuCache.max * 4, 32),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        this.gpuBordersBuffer = this.device.createBuffer({
            label: 'gpuNodesBuffer',
            size: Math.max(this.nodeGpuCache.max * 4, 32),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        console.log(`Node GPU Cache size (${this.nodeGpuCache.max}) [${this.nodeBuffer.size * 1e-6} megabytes]`);

        this.nodeToGPU();
        // preload
        for (let i = 0; i < this.settings.cachePreload; i++) {
            this.loadStarListToGPU(i);
        }
    }

    ui(gui, mainSettings) {
        this.lactea.ui(gui, mainSettings);
    }

    done() {
        return this.query.length == 0 && this.lactea.queue.isEmpty() && this.patches.length == 0;
        // return this.query.length == 0 && this.lactea.queue.length === 0 && this.patches.length == 0;
    }

    moveCamera(cam) {
        this.query = [];
        this.patches = [];
        this.starsTotal = 0;
        this.loadedStars = 0;
        this.nodesTotal = 0;
        this.loadedNodes = 0;
        this.lactea.moveCamera(cam);
        // this.starLoading.clear();
        console.log("NEW query");
    }

    cacheLoad(mouseMoving) {
        let nodeId = 0;
        let i = 0;
        let cacheInfo = [];
        let nodes = [];
        let borders = [];

        if(!this.lactea.queue.isEmpty() && (this.query.length < this.lactea.settings.maxLength || this.patches.length < this.lactea.settings.maxLength)) {
        // if(this.lactea.queue.length > 0 && (this.query.length < this.lactea.settings.maxLength || this.patches.length < this.lactea.settings.maxLength)) {
            let res = this.lactea.traverseTree();
            this.query.push(...res[0]);
            this.patches.push(...res[1]);
            // console.log("star query", this.query);
            // console.log("node query", this.patches);
            this.starsTotal += res[0].length;
            this.nodesTotal += res[1].length;
        }
        let start = performance.now();
        while (this.query.length > 0 && i < this.query.length // while query isn't empty
            && (performance.now() - start) < this.settings.deltaLoop  // and delta time is not done
            && this.starLoading.size < this.settings.maxLoadingReq // and stars to load aren't a lot
        ) {
            nodeId = this.query[i];
            let cachedStars;
            let level;
            if(nodeId < this.starL1GpuCache.max) {
                level = 1;
                cachedStars = this.starL1GpuCache.get(nodeId);
            } else {
                level = 2;
                cachedStars = this.starL2GpuCache.get(nodeId);
            }
            let cachedNode = this.nodeGpuCache.get(nodeId);

            if (cachedStars !== undefined) { // && cachedNode !== undefined) {
                cacheInfo.push(nodeId);
                cacheInfo.push(cachedStars[0]);
                cacheInfo.push(cachedStars[1]);
                cacheInfo.push(level);

                borders.push(cachedNode[0]);
                this.query.splice(i, 1);
                this.loadedStars++;
            }
            else if (!this.starLoading.has(nodeId)) {
                // console.log("load stars", nodeId);
                this.loadStarListToGPU(nodeId);
                i++;
            }
        }
        if(!mouseMoving && this.loadedStars > 10) {
            // dont load patches while moving the camera to prioritize stars. 
            // also don't load if lots of stars are to be loaded
            // this is an arbitrary condition just to make the visualization look nice 
            i = 0;
            while (this.patches.length > 0 && i < this.patches.length // while patches isn't empty
                && (performance.now() - start) < this.settings.deltaLoop  // and delta time is not done
                && this.nodeLoading.size < this.settings.maxLoadingReq // and nodes to load aren't a lot
                // && nodes.length < this.computeLimit // and current leaves isn't larger than compute limit
            ) {
                nodeId = this.patches[i];
                // load node
                let cachedNode = this.nodeGpuCache.get(nodeId);
                if (cachedNode && cachedNode[1] === true) {
                    nodes.push(cachedNode[0]);
                    borders.push(cachedNode[0])
                    this.patches.splice(i, 1);
                    this.loadedNodes++;
                }
                else if (!this.nodeLoading.has(Math.floor(nodeId / this.lactea.tree.getNumMaxStarsNode()))) {
                    // console.log("load node", nodeId);
                    this.nodeListToGPU(Math.floor(nodeId / this.lactea.tree.getNumMaxStarsNode()));
                    i++;
                }
            }
        }

        if (cacheInfo.length > 0) {
            this.device.queue.writeBuffer(this.cacheInfoBuffer, 0, new Uint32Array(cacheInfo));
        }

        if (nodes.length > 0) {
            this.device.queue.writeBuffer(this.gpuNodeOffsetsBuffer, 0, new Uint32Array(nodes));
        }

        if (borders.length > 0) {
            this.device.queue.writeBuffer(this.gpuBordersBuffer, 0, new Uint32Array(borders));
        }
        let chunkCount = cacheInfo.length / LacteaCache.STAR_INFO_COUNT;
        return [chunkCount, chunkCount * this.lactea.tree.getNumMaxStarsNode(), nodes.length, borders.length];
    }

    toGPU(nodeId, minStar, starOffset) {
        if(nodeId < this.starL1GpuCache.max) {
            this.device.queue.writeBuffer(this.minStarL1Buffer, starOffset, minStar.buffer);
        } else {
            this.device.queue.writeBuffer(this.minStarL2Buffer, starOffset, minStar.buffer);
        }
    }

    async nodeListToGPU(id) {
        this.nodeLoading.add(id);
        const offset = this.lactea.tree.getNumMaxStarsNode() * id;
        return this.lactea.tree.loadNodeList(id).then((nodeCount) => {
            if(nodeCount > 0) {
                let buffer = new ArrayBuffer(nodeCount * this.nodeChunkSize);
                let floatView = new Float32Array(buffer);
                let uintView = new Uint32Array(buffer);
                for(let i = 0; i < nodeCount; i++) {
                    let nodeId = offset + i;
                    const [row, col] = this.lactea.tree.nodeMap.get(nodeId);
                    const node = this.lactea.tree.tree[row][col];
                    // console.log("node list", nodeId, node.id, i);
                    node.toBuffer(floatView, uintView, i);
                    node.clearSpectra();
                    this.nodeGpuCache.set(nodeId, [true]);
                }
                this.device.queue.writeBuffer(this.nodeBuffer, offset * this.nodeChunkSize, buffer);
                // console.log("node list", id, offset * this.nodeChunkSize);

            }
            this.nodeLoading.delete(id);
        })
        .catch(e => {
            console.error(e);
        })
    }

    nodeToGPU() {
        let buffer = new ArrayBuffer(this.nodeBuffer.size);
        let floatView = new Float32Array(buffer);
        let uintView = new Uint32Array(buffer);
        for(let i = 0; i < this.lactea.tree.numNodes; i++) {
            const [row, col] = this.lactea.tree.nodeMap.get(i);
            const node = this.lactea.tree.tree[row][col];
            const nodeOffset = this.nodeGpuCache.set(node.id, [false]);
            node.toBufferNoSpectra(floatView, uintView, nodeOffset/4);
            // if(node.id % 1000 === 0) {
            //     console.log("node", node.id, nodeOffset);
            // }
        }
        this.device.queue.writeBuffer(this.nodeBuffer, 0, buffer);
    }

    async loadStarListToGPU(id) {
        this.starLoading.add(id);
        return this.lactea.tree.loadStarList(id)
            .then((minStar) => {
                // star
                let starOffset;
                if(id < this.starL1GpuCache.max) {
                    starOffset = this.starL1GpuCache.set(id, [minStar.s]);
                } else {
                    starOffset = this.starL2GpuCache.set(id, [minStar.s]);
                }
                this.toGPU(id, minStar, starOffset);
                
                this.starLoading.delete(id);
            })
            .catch(e => {
                console.error(e);
            })
    }
}