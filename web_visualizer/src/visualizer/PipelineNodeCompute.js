import { Pipeline } from "./utils/Pipeline.js";
import { TimingHelper } from "./utils/TimingHelper.js";
import { LightSpectrum } from "../lactea/LightSpectrum.js";

export class NodeCompute {
    static format = "r8unorm"; // color is not needed

    constructor(device) {
        this.device = device;
    }

    async setup(includes = [], bindgroupsLayouts = [], textureBindGroupLayout) {

        // bind group layout
        this.nodeBindGroupLayout = this.device.createBindGroupLayout({
            label: "nodeBindGroupLayout",
            entries: [
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // gpu offsets
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // gpu borders
                }
            ]
        });

        this.N = 1;
        let constants = `
            const N = ${this.N};
        `;
        // pipelines
        this.nodeComputePipeline = new Pipeline(this.device);
        await this.nodeComputePipeline.createRenderPipeline("NodeComputeShader.wgsl", [...includes, constants], 'vs', 'fs',
            [...bindgroupsLayouts, this.nodeBindGroupLayout],
            [{ format: NodeCompute.format }],
            [],
            { primitive: { cullMode: "none" } });

        this.textureBindGroupLayout = textureBindGroupLayout;

        // time pass
        this.timingHelper = new TimingHelper(this.device);

    }

    createBindGroups(lacteaCache) {
        // bind group
        this.nodeBindGroup = this.device.createBindGroup({
            label: "nodeBindGroup",
            layout: this.nodeBindGroupLayout,
            entries: [
                { binding: 1, resource: { buffer: lacteaCache.gpuNodeOffsetsBuffer } },
                { binding: 2, resource: { buffer: lacteaCache.gpuBordersBuffer } },
            ],
        });
    }


    updateTexture(size) {
        this.texture = this.device.createTexture({
            label: 'clusterTexture',
            dimension: "2d",
            size: size,
            format: NodeCompute.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.sampler = this.device.createSampler();
        this.bindGroup = this.device.createBindGroup({
            label: "clusterBindGroup",
            layout: this.textureBindGroupLayout,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.texture.createView() },
            ],
        });
    }

    render(encoder, count, bindGroups = []) {
        /** NODES */
        // console.log("count", count);

        const nodePass = this.timingHelper.beginRenderPass(encoder,
            {
                colorAttachments: [
                    {
                        view: this.texture.createView(),
                        loadOp: "clear",
                        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                        storeOp: "discard",
                    }
                ]
            });
        this.nodeComputePipeline.setBindGroups(nodePass, [...bindGroups, this.nodeBindGroup]);
        nodePass.draw(count * 2 * 3); // , this.N * this.N); // 2 triangles for N grids
        nodePass.end();
    }

}