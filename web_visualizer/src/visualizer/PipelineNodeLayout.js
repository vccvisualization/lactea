import { Pipeline } from "./utils/Pipeline.js";
import { TimingHelper } from "./utils/TimingHelper.js";

export class NodeLayoutPipeline {
    constructor(device) {
        this.device = device;
    }

    async setup(includes = [], bindgroupsLayouts = [], textureBindGroupLayout, canvasFormat, format = "rgba8unorm", topology = 'point-list') {
        this.format = format;
        this.textureBindGroupLayout = textureBindGroupLayout;

        // uniforms, samples, buffers
        this.N = 100;
        let constants = `
            const N = ${this.N};
        `;
        this.borderPipeline = new Pipeline(this.device);
        await this.borderPipeline.createRenderPipeline('NodeLayout.wgsl', [...includes, constants], 'vs', 'fs',
            [...bindgroupsLayouts],
            [{ format: canvasFormat }],
            [],
            { primitive: { topology } });

        this.textureTransformPipleline = new Pipeline(this.device);
        await this.textureTransformPipleline.createRenderPipeline('TextureShaderTransform.wgsl', [], 'vs', 'fs',
            [this.textureBindGroupLayout],
            [{ format: canvasFormat }]);
    }

    updateTexture(size, scale=0.25) {
        this.sampler = this.device.createSampler();

        this.texture = this.device.createTexture({
            label: 'NodeLayoutTexture',
            dimension: "2d",
            size: size.map(x => x * scale),
            format: this.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        
        this.bindGroup = this.device.createBindGroup({
            label: "NodeLayoutBindGroup",
            layout: this.textureBindGroupLayout,
            entries: [
                { binding: 0, resource: this.sampler },
                { binding: 1, resource: this.texture.createView() },
            ],
        });
        this.clearBuffer();
    }

    clearBuffer() {
        this.loadOp = "clear";
    }

    renderToTexture(encoder, bindGroups = [], nodeSize) {

        if(nodeSize > 0) {
            // minimap pass
            const borderPass = encoder.beginRenderPass(
                {
                    colorAttachments: [
                        {
                            view: this.texture.createView(),
                            loadOp: this.loadOp,
                            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                            storeOp: "store",
                        }
                    ]
                });
            this.borderPipeline.setBindGroups(borderPass, [...bindGroups]);
            borderPass.draw(nodeSize * 4 * 2 * this.N); // 4 faces x 6 lines per face x 2 points per line
            borderPass.end();

            this.loadOp = "load";
        }
    }

    render(pass) {
        this.textureTransformPipleline.setBindGroups(pass, [this.bindGroup]);
        pass.draw(8);
    }
}