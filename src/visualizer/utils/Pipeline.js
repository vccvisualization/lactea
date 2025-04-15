export class Pipeline {
    constructor(device, BASE="") {
        this.device = device;
        this.BASE = BASE;
    }
    

    async getShaderString(path) {
        return fetch(`${this.BASE}res/shaders/${path}`)
            .then(res => res.text())
    }

    insertInclude(src, text) {
        return text + "\n\n" +  src;
    }

    async getShaderModule(name, includes) {
        let src = await this.getShaderString(name);
        includes.forEach( k => {
            src = this.insertInclude(src, k);
        });
        return this.device.createShaderModule({
            label: name,
            code: src
        });
    }
    async createComputePipeline(shaderfile, includes=[], entryPoint, bindGroupLayouts) {
        this.pipeline = this.device.createComputePipeline({
            label: shaderfile,
            layout: this.device.createPipelineLayout({ bindGroupLayouts }),
            compute: {
                module: await this.getShaderModule(shaderfile, includes),
                entryPoint,
            }
        });
    }

    async createRenderPipeline(shaderfile, includes=[], vsEntryPoint, fsEntryPoint, bindGroupLayouts, targets, buffers = [], others = {}) {
        const shaderModule = await this.getShaderModule(shaderfile, includes);
        this.pipeline = this.device.createRenderPipeline({
            label: shaderfile,
            layout: this.device.createPipelineLayout({ label: shaderfile, bindGroupLayouts }),
            vertex: {
                module: shaderModule,
                entryPoint: vsEntryPoint,
                buffers: buffers,
            },
            fragment: {
                module: shaderModule,
                entryPoint: fsEntryPoint,
                targets,
            },
            ...others
        });
    }

    setBindGroups(pass, bindGroups) {
        pass.setPipeline(this.pipeline);
        bindGroups.forEach((bindGroup, indx) => {
            pass.setBindGroup(indx, bindGroup);
        });
    }
}