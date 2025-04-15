import { LightSpectrum } from "../lactea/LightSpectrum.js";
import { Pipeline } from "./utils/Pipeline.js";
import { TimingHelper } from "./utils/TimingHelper.js";

export class StarCompute {
    constructor(device) {
        this.device = device;
    }

    async setup(includes = [], bindgroupsLayouts = []) {

        // bind group layout
        this.starBindGroupLayout = this.device.createBindGroupLayout({
            label: "starBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // stars L1 cache
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // stars L2 cache
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // StarListInfo
                },
                // {
                //     binding: 3,
                //     visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                //     buffer: { type: "read-only-storage" } // gpu lengths
                // },
                // {
                //     binding: 4,
                //     visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                //     buffer: { type: "read-only-storage" } // gpu cache levels
                // },
            ]
        });


        // pipelines
        this.starComputePipeline = new Pipeline(this.device);
        await this.starComputePipeline.createComputePipeline("StarComputeShader.wgsl", includes, "computeMain",
            [...bindgroupsLayouts, this.starBindGroupLayout]);
        
        // this.starComputeFilterPipeline = new Pipeline(this.device);
        // await this.starComputeFilterPipeline.createComputePipeline("StarComputeShaderFiltering.wgsl", includes, "computeMain",
        //     [this.starBindGroupLayout, ...bindgroupsLayouts]);
        
        // time pass
        this.timingHelper = new TimingHelper(this.device);

    }

    createBindGroups(lacteaCache) {
        // bind group
        this.starBindGroup = this.device.createBindGroup({
            label: "starBindGroup",
            layout: this.starBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: lacteaCache.minStarL1Buffer } },
                { binding: 1, resource: { buffer: lacteaCache.minStarL2Buffer } },
                { binding: 2, resource: { buffer: lacteaCache.cacheInfoBuffer } },
            ],
        });
    }

    compute(encoder, count, depthCount, bindGroups = []) {
        // console.log("count", count, depthCount, LightSpectrum.NUM_BINS_TOTAL / depthCount);
        // console.log("workgorups", Math.ceil(count / 8), Math.ceil(LightSpectrum.NUM_BINS_TOTAL / depthCount / 8))
        const computePass = this.timingHelper.beginComputePass(encoder, {});
        this.starComputePipeline.setBindGroups(computePass, [...bindGroups, this.starBindGroup]);
        computePass.dispatchWorkgroups(Math.ceil(count / 8), Math.ceil(LightSpectrum.NUM_BINS_TOTAL / depthCount / 8));
        computePass.end();
    }
}