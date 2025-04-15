import { LightSpectrum } from "./LightSpectrum.js";

export class Node {
    static NUM_ATTR = 7 + LightSpectrum.NUM_BINS_TOTAL * 2
    static ID_OFFSET = 0;
    static COUNT_OFFSET = 1;
    static SUBTREE_COUNT_OFFSET = 2;
    static BB_OFFSET = 3;
    static OWN_SPECTRUM_OFFSET = 7;
    static SUBTREE_SPECTRUM_OFFSET = 7 + LightSpectrum.NUM_BINS_TOTAL

    constructor() {
        this.id = 0;
        // this.stars = [];
        this.starCount = 0;
        this.children = new Uint32Array(2).fill(0);
        this.clippingCoord = 0.0;
        this.boundingBox = new Float32Array(4).fill(0);
        this.gpuBB = new Float32Array(4).fill(0);
        this.splitAxis = 0;
        this.subtreeStarsCount = 0;
        this.ownEnergy = 0;
        this.subtreeEnergy = 0;
        this.ownSpectrum = [];
        this.subtreeSpectrum = [];
    }

    getTotalEnergy() {
        return this.ownEnergy + this.subtreeEnergy;
    }
    
    toBuffer(floatView, uintView, k) {
        const offset = k * Node.NUM_ATTR;

        uintView[offset + Node.ID_OFFSET] = this.id;
        // console.log("id", this.id, this.uintView[Node.ID_OFFSET])
        uintView[offset + Node.COUNT_OFFSET] = this.starCount;
        uintView[offset + Node.SUBTREE_COUNT_OFFSET] = this.subtreeStarsCount;

        floatView.set(this.gpuBB, offset + Node.BB_OFFSET);  

        floatView.set(Float32Array.from(this.ownSpectrum.histogram), offset + Node.OWN_SPECTRUM_OFFSET);
        floatView.set(Float32Array.from(this.subtreeSpectrum.histogram), offset + Node.SUBTREE_SPECTRUM_OFFSET);
    }

    clearSpectra() {
        this.ownSpectrum = [];
        this.subtreeSpectrum = [];
    }
    toBufferNoSpectra(floatView, uintView, offset) {
        uintView[offset + Node.ID_OFFSET] = this.id;
        // console.log("id", this.id, this.uintView[Node.ID_OFFSET])
        uintView[offset + Node.COUNT_OFFSET] = this.starCount;
        uintView[offset + Node.SUBTREE_COUNT_OFFSET] = this.subtreeStarsCount;

        floatView.set(this.gpuBB, offset + Node.BB_OFFSET);  
    }


    // spectraToBuffer() {
    //     let buffer = new ArrayBuffer(LightSpectrum.NUM_BINS_TOTAL * 2 * 4);
    //     let floatView = new Float32Array(buffer);
    //     floatView.set(Float32Array.from(this.ownSpectrum.histogram), 0);
    //     floatView.set(Float32Array.from(this.subtreeSpectrum.histogram), LightSpectrum.NUM_BINS_TOTAL);
    //     return [buffer, Node.OWN_SPECTRUM_OFFSET];
    // }
}