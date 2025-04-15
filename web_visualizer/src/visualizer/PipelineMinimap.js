import { Pipeline } from "./utils/Pipeline.js";
import { TimingHelper } from "./utils/TimingHelper.js";

export class MinimapPipeline {
    constructor(device) {
        this.device = device;
    }

    async setup(includes = [], bindgroupsLayouts = [], canvasFormat, format = "rgba8unorm") {
        this.format = format;
        // uniforms, samples, buffers
        this.borderPipeline = new Pipeline(this.device);
        await this.borderPipeline.createRenderPipeline('BorderShader.wgsl', includes, 'vs', 'fs',
            [...bindgroupsLayouts],
            [{ format: canvasFormat }],
            [],
            { primitive: { topology: 'line-list' } });

        this.minimapPipeline = new Pipeline(this.device);
        await this.minimapPipeline.createRenderPipeline('MinimapShader.wgsl', includes, 'vs', 'fs',
            [bindgroupsLayouts[0]],
            [{
                format: canvasFormat,
                // blend: {
                //     color: {
                //         operation: 'add',
                //         srcFactor: 'one-minus-dst',
                //         dstFactor: 'one-minus-src'
                //     },
                //     alpha: {
                //         operation: 'add',
                //         srcFactor: 'one',
                //         dstFactor: 'one'
                //     },
                // },
            }],
        );

        this.minimapBindGroupLayout = this.device.createBindGroupLayout({
            label: "minimapBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {} // sampler
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: "2d",
                    } // border
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: "2d",
                    } // minimap area
                },
            ]
        });

        this.minimapComboPipleline = new Pipeline(this.device);
        await this.minimapComboPipleline.createRenderPipeline('MinimapComboShader.wgsl', [], 'vs', 'fs',
            [this.minimapBindGroupLayout],
            [{ format: canvasFormat }]);
    }

    updateTexture(size) {
        this.sampler = this.device.createSampler();

        this.borderTexture = this.device.createTexture({
            label: 'borderTexture',
            dimension: "2d",
            size: size.map(x => x * .25),
            format: this.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.minimapTexture = this.device.createTexture({
            label: 'minimapTexture',
            dimension: "2d",
            size: size.map(x => x * .25),
            format: this.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.bindGroup = this.device.createBindGroup({
            label: "borderBindGroup",
            layout: this.minimapBindGroupLayout,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.borderTexture.createView() },
                { binding: 2, resource: this.minimapTexture.createView() },

            ],
        });
        this.clearBuffer();
    }

    clearBuffer() {
        this.loadOp = "clear";
    }

    renderToTexture(encoder, bindGroups = [], nodeSize) {
        // minimap pass
        if (nodeSize > 0) {
            const borderPass = encoder.beginRenderPass(
                {
                    colorAttachments: [
                        {
                            view: this.borderTexture.createView(),
                            loadOp: this.loadOp,
                            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                            storeOp: "store",
                        }
                    ]
                });
            this.borderPipeline.setBindGroups(borderPass, [...bindGroups]);
            borderPass.draw(nodeSize * 4 * 2); // 4 lines
            borderPass.end();
            this.loadOp = "load";
        }
        const minimapPass = encoder.beginRenderPass(
            {
                colorAttachments: [
                    {
                        view: this.minimapTexture.createView(),
                        loadOp: "clear",
                        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                        storeOp: "store",
                    }
                ]
            });
        this.minimapPipeline.setBindGroups(minimapPass, [bindGroups[0]]);
        minimapPass.draw(6);
        minimapPass.end();
    }

    render(pass) {
        this.minimapComboPipleline.setBindGroups(pass, [this.bindGroup]);
        pass.draw(8);
    }
}