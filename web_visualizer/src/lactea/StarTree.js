import { Node } from "./Node.js";
import { MinStar } from "./MinStar.js";
import { LightSpectrum } from "./LightSpectrum.js";

export class StarTree {
    constructor(BASE = "") {
        // TODO: put your own data folder
        this.path = `${BASE}res/data/gdr3_gaia_source_xp_extinction_10K/`;
        // this.path = "http://127.0.0.1:5501/gdr3_gaia_source_xp_sampled_all/"
        // this.path = "http://127.0.0.1:5501/gdr3_gaia_source_xp_extinction/"

        this.tree = [];
        this.numMaxStarsNode = 0;
        this.numNodes = 0;
        this.numStars = 0;

        this.nodeMap = new Map();
    }

    getTreePath = () => `${this.path}tree.tr`;
    getNodePath = id => `${this.path}${id}.node`;
    getNodesPath = id => `${this.path}${id}.nodes`;

    getNumMaxStarsNode() { return this.numMaxStarsNode; }
    getNumLevels() { return this.tree.length; }
    includes(min1, max1, min2, max2) {
        return !((max2 < min1) || (min2 > max2));
    }
    intersect(a_x_min, a_y_min, a_x_max, a_y_max, b_x_min, b_y_min, b_x_max, b_y_max) {
        return !(b_x_min > a_x_max
            || b_x_max < a_x_min
            || b_y_min > a_y_max
            || b_y_max < a_y_min);
    }
    areaThreshold(a_x_min, a_y_min, a_x_max, a_y_max, b_x_min, b_y_min, b_x_max, b_y_max, threshold) {
        let boundArea = (b_x_max - b_x_min) * (b_y_max - b_y_min);
        let nodeArea = (a_x_max - a_x_min) * (a_y_max - a_y_min);
        return nodeArea / boundArea > threshold;
    }
    intersectionArea(a_x_min, a_y_min, a_x_max, a_y_max, b_x_min, b_y_min, b_x_max, b_y_max) {
        let nodeArea = (a_x_max - a_x_min) * (a_y_max - a_y_min);

        const i_x_min = Math.max(a_x_min, b_x_min);
        const i_x_max = Math.min(a_x_max, b_x_max);
        const i_y_max = Math.min(a_y_max, b_y_max);
        const i_y_min = Math.max(a_y_min, b_y_min);

        let area = (i_x_max - i_x_min) * (i_y_max - i_y_min);
        return area / nodeArea;
    }

    completelyIn(a_x_min, a_y_min, a_x_max, a_y_max, b_x_min, b_y_min, b_x_max, b_y_max, threshold) {
        return (a_x_min > (b_x_min - threshold)) && 
            (a_y_min > (b_y_min - threshold)) && 
            (a_x_max < (b_x_max + threshold)) && 
            (a_y_max < (b_y_max + threshold));
    }


    async loadTree() {
        return fetch(this.getTreePath())
            .then(res => res.blob())
            .then(data => data.arrayBuffer())
            .then(array => {
                let i = 0;
                this.numMaxStarsNode = new Uint32Array(array.slice(i, i += 4))[0];
                // console.log(`this.numMaxStarsNode = ${this.numMaxStarsNode}`);
                this.numStars = new Uint32Array(array.slice(i, i += 4))[0];
                // console.log(`this.numStars = ${this.numStars}`);
                let n = new Uint32Array(array.slice(i, i += 4))[0];
                // console.log(`levels = ${n}`);
                this.tree = Array(n);
                // console.log(numMaxStarsNode, n);
                for (let j = 0; j < this.tree.length; j++) {
                    n = new Uint32Array(array.slice(i, i += 4))[0];
                    // console.log(`n_${j} = ${n}`);
                    this.tree[j] = Array(n).fill(0).map(x => new Node());
                    // console.log(n);
                    this.numNodes += n;
                }
                // console.log(`this.numNodes = ${this.numNodes}`);

                // console.log(tree);
                this.tree.forEach((nl, row) => {
                    nl.forEach((node, col) => {
                        const compressed = new Uint32Array(array.slice(i, i += 4))[0];
                        node.splitAxis = compressed >> 24 & 0xFF;
                        node.id = compressed & 0xFFFFFF;
                        node.clippingCoord = new Float32Array(array.slice(i, i += 4))[0];
                        node.boundingBox = new Float32Array(array.slice(i, i += 4 * 4));
                        node.children = new Uint32Array(array.slice(i, i += 4 * 2));
                        node.starCount = new Uint32Array(array.slice(i, i += 4))[0];
                        node.subtreeStarsCount = new Uint32Array(array.slice(i, i += 4))[0];
                        node.ownEnergy = new Float64Array(array.slice(i, i += 8))[0];
                        node.subtreeEnergy = new Float64Array(array.slice(i, i += 8))[0];
                        // node.ownSpectrum = new LightSpectrum();
                        // node.ownSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                        // node.subtreeSpectrum = new LightSpectrum();
                        // node.subtreeSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                        
                        // gpu bb (more pretty than actual bb, useful for patch)
                        if(row === 0 && col === 0) {
                            // root bb is the same in cpu and gpu
                            // node.gpuBB = new Float32Array(node.boundingBox);
                            node.gpuBB = new Float32Array([0, -90, 360, 90]);
                        }
                        if(node.children[0] != node.children[1]) {
                            this.tree[row + 1][node.children[0]].gpuBB = new Float32Array(node.gpuBB);
                            this.tree[row + 1][node.children[0]].gpuBB[2 + node.splitAxis] = node.clippingCoord;
                            this.tree[row + 1][node.children[1]].gpuBB = new Float32Array(node.gpuBB);
                            this.tree[row + 1][node.children[1]].gpuBB[0 + node.splitAxis] = node.clippingCoord;
                        }
                
                        this.nodeMap.set(node.id, [row, col]);
                    });
                });
                return true;
            })
            .catch(error => {
                console.error(error);
                return false;
            });
    }

    async loadNodeList(id) {
        return fetch(this.getNodesPath(id))
            .then(res => res.blob())
            .then(data => data.arrayBuffer())
            .then(array => {
                let i = 0; 
                const nodeCount = new Uint32Array(array.slice(i, i += 4))[0];
                for (let k = 0; k < nodeCount; k++) {
                    const [row, col] = this.nodeMap.get(id * this.numMaxStarsNode + k);
                    const node = this.tree[row][col];
                    node.ownSpectrum = new LightSpectrum();
                    node.ownSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                    node.subtreeSpectrum = new LightSpectrum();
                    node.subtreeSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                }
                return nodeCount;
            })
            .catch(error => {
                console.error("Error at node list", id);
                console.error(error);
                return 0;
            })
    }
    async loadStarList(id) {
        const [row, col] = this.nodeMap.get(id);
        let minStar = new MinStar();
        let node = this.tree[row][col];

        return fetch(this.getNodePath(id))
            .then(res => res.blob())
            .then(data => data.arrayBuffer())
            .then(array => {
                let i = 0; //24 + 1 + 4 * (8 + 2 * LightSpectrum.NUM_BINS_BASE);
                // node.id = new Uint32Array(array.slice(i, i += 4))[0];
                // i += 24; // std::vector
                // node.children = new Uint32Array(array.slice(i, i += 4 * 2));
                // node.clippingCoord = new Float32Array(array.slice(i, i += 4))[0];
                // node.boundingBox = new Float32Array(array.slice(i, i += 4 * 4));
                // node.splitAxis = new Uint8Array(array.slice(i, i += 1))[0];
                // node.subtreeStarsCount = new Uint32Array(array.slice(i, i += 4))[0];
                // node.ownSpectrum = new LightSpectrum();
                // node.ownSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                // node.subtreeSpectrum = new LightSpectrum();
                // node.subtreeSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                
                // i += 4; // star count
                // console.log(`node`, node);
                // node.starCount = new Uint32Array(array.slice(i, i += 4))[0];
                // console.log(`s: ${s}`);
                // node.stars = new Uint32Array(array.slice(i, i+=4*s));
                // i += 4 * node.starCount; // TODO: ignore node.stars for now. activate later if needed
                minStar.size(node.starCount);
                for (let k = 0; k < node.starCount; k++) {
                    const solId = new BigUint64Array(array.slice(i, i += 8))[0];
                    const pos = new Float32Array(array.slice(i, i += 4 * 2));
                    let ownSpectrum = new LightSpectrum();
                    ownSpectrum.histogram = new Float64Array(array.slice(i, i += 8 * LightSpectrum.NUM_BINS_TOTAL));
                    minStar.set(solId, pos, ownSpectrum, k);
                }
                return minStar;
            })
            .catch(error => {
                console.error("Error at node", id);
                console.error(error);
                return minStar;
            })
    }

    // chunksQuery(viewBounds, nodeAddCondition) {
    //     const query = [];
    //     const patches = [];
    //     let q = [[0, 0]];
    //     while (q.length > 0) {
    //         let [level, node] = q.shift();
    //         let n = this.tree[level][node];

    //         // if out of the node BB => discard
    //         let intersect = false;
    //         viewBounds.forEach(lim => {
    //             intersect = intersect || this.intersect(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
    //         });
    //         if (!intersect) continue;

    //         // if node is smaller than a pixel
    //         if (nodeAddCondition(n.boundingBox, level)) {
    //             patches.push(n.id);
    //         }
    //         else {
    //             query.push(n.id);
    //             if (n.children[0] !== n.children[1] && level < this.tree.length - 1) {
    //                 // add children
    //                 q.push([level + 1, n.children[0]]);
    //                 q.push([level + 1, n.children[1]]);
    //             }
    //         }
    //     }
    //     return [query, patches];
    // }

    priorityQuery(viewBounds, q, cutofflevel, maxLength=5, areaThreshold=0.9, energyTol=0.9, refParents = {}) {
        // TODO: fix 360 projection
        const patches = [];
        const query = []; 

        while (!q.isEmpty() && (query.length < maxLength && patches.length < maxLength)) {
            let [level, node] = q.dequeue().value;
            let n = this.tree[level][node];

            // if out of the node BB => discard
            let intersect = false;
            viewBounds.forEach(lim => {
                intersect = intersect || this.intersect(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
            });
            if (!intersect) continue;

            // if completely in = ref
            let overlapArea = 0;
            viewBounds.forEach(lim => {
                overlapArea += this.intersectionArea(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
            });

            if(refParents.level === undefined || refParents.level === level) {
                if(!(level in refParents.threshold)) {
                    refParents.threshold[level] = 0;
                    refParents.accumEnergy[level] = 0;
                }
                refParents.threshold[level] += energyTol * (n.ownEnergy + n.subtreeEnergy) * overlapArea;
                if(overlapArea >= areaThreshold) {
                    refParents.level = level;
                    console.log(`threshold energy updated to ${refParents.threshold[level]} at node ${n.id} level ${level} with ${overlapArea} overlap`);
                } else {
                    console.log(`node ${n.id} at level ${level} updated threshold by ${overlapArea} of ${energyTol * (n.ownEnergy + n.subtreeEnergy)} = ${energyTol * (n.ownEnergy + n.subtreeEnergy) * overlapArea}`);
                }
            }
            


            if(level >= cutofflevel || 
                (refParents.level !== undefined && refParents.accumEnergy[refParents.level] >= refParents.threshold[refParents.level])
            ) {
                patches.push(n.id);
                if(refParents.level !== undefined) {
                    refParents.accumEnergy[refParents.level] += (n.ownEnergy + n.subtreeEnergy); // * overlapArea;
                }
                // console.log(`nodelist ${n.id} at level ${level} overlapArea ${overlapArea}`)
            } else {
                query.push(n.id);
                refParents.accumEnergy[refParents.level] += n.ownEnergy; // * overlapArea;
                // console.log(`starlist ${n.id} at level ${level} overlapArea ${overlapArea}`)

                if (n.children[0] !== n.children[1] && level < this.tree.length - 1) {
                    q.enqueue([level + 1, n.children[0]], this.tree[level + 1][n.children[0]].getTotalEnergy());
                    q.enqueue([level + 1, n.children[1]], this.tree[level + 1][n.children[1]].getTotalEnergy());
                }
            }
        }
        return [query, patches, q, refParents];
    }

    chunksQuery(viewBounds, nodeAddCondition, q = [[0, 0, -1]], maxLength=5) {
        const query = [];
        const patches = [];
        while (q.length > 0 && (query.length < maxLength && patches.length < maxLength)) {
            let [level, node, ref] = q.shift();
            let n = this.tree[level][node];

            // if out of the node BB => discard
            let intersect = false;
            viewBounds.forEach(lim => {
                intersect = intersect || this.intersect(n.boundingBox[0], n.boundingBox[1], n.boundingBox[2], n.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
            });
            if (!intersect) continue;

            if (nodeAddCondition(n.boundingBox, level)) { 
                patches.push(n.id);
            }
            else {
                query.push(n.id);
                if (n.children[0] !== n.children[1] && level < this.tree.length - 1) {
                    // add children
                    q.push([level + 1, n.children[0], ref]);
                    q.push([level + 1, n.children[1], ref]);
                }
            }
        }
        return [query, patches, q];
    }

    getNode(level, index) {
        return {node: this.tree[level][index], level: level};
    }

    async * tr(level, index, vb, nodeAddCondition) {
        let result = [this.getNode(level, index)];
        let starQuery = [];
        let nodeQuery = [];
    
        while (result.length) {
            yield [starQuery, nodeQuery];
    
            result = await Promise.all(result.flatMap(group => { 
                let intersect = false;
                vb.forEach(lim => {
                    intersect = intersect || this.intersect(group.node.boundingBox[0], group.node.boundingBox[1], group.node.boundingBox[2], group.node.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
                });
                if (!intersect) {
                    return [];
                } 
                else {
                    if(nodeAddCondition(group.node.boundingBox, group.level)) {
                        nodeQuery.push(group.node.id);
                        // return [];
                    } else {
                        starQuery.push(group.node.id);
                    }
                }
                if(group.node.children[0] === group.node.children[1]) {
                    return [];
                }
                
                return [...group.node.children].flatMap( index => this.getNode(group.level + 1, index));
            }));
        }
    };
    async asyncChunksQuery(viewBounds, nodeAddCondition) {
        // let query = [];
        // let patches = [];
        this.query = this.tr(0, 0, viewBounds, nodeAddCondition);
        // for await (let result of this.tr(0, 0, viewBounds, nodeAddCondition)) {
        //     console.log([result[1], result[2]]);
        //     query = result[1];
        //     patches = result[2];
        //     return [query, patches];

        // }
    }
    getQuery() {
        return this.query.next();
    }
    printTree() {
        let i = 0;
        console.log("digraph {\n");
        this.tree.forEach(nl => {
            i++;
            if (i < this.tree.length) {
                nl.forEach(n => {
                    if (n.children[0] !== n.children[1]) {
                        console.log("\t%d -> %d\n", n.id, this.tree[i][n.children[0]].id);
                        console.log("\t%d -> %d\n", n.id, this.tree[i][n.children[1]].id);
                    }
                });
            }
        });
        console.log("}\n");
    }
}