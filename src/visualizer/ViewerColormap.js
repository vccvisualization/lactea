import { LightSpectrum } from "../lactea/LightSpectrum.js";
import { TransferFunction } from "../ui/TransferFunction.js";

export class ViewerColormap {
    constructor(device, gui) {
        this.device = device;

        let formatWl = wl => {
            return Math.round(wl, 2);
        }

        this.colormap1D = new TransferFunction({
            containerId: "#figures",
            gui: gui,
            binSize: LightSpectrum.NUM_BINS_BASE,
            tooltipText: (idx) => {
                let [wl_min, wl_max] = LightSpectrum.mapIdxToWavelength(idx);
                return `Bin: ${idx}<br>Wavelength: [${formatWl(wl_min)}, ${formatWl(wl_max)}]`;
            }
        });
        this.colormap1D.updateData();
    }

    load(settings) {
        this.colormap1D.colorMap = settings?.colorMap ?? [];
        this.colormap1D.isUpdated = true;
        this.colormap1D.updateData();
    }

    store() {
        return {
            colorMap: this.colormap1D.colorMap,
        };
    }


    async setup() {
        // uniforms, samples, buffers
        this.texture1D = this.device.createTexture({
            label: 'colorTexture',
            dimension: "1d",
            size: [LightSpectrum.NUM_BINS_BASE],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this.sampler1D = this.device.createSampler();
        this.BindGroupLayout1D = this.device.createBindGroupLayout({
            label: "BindGroupLayout1D",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    sampler: {} // sampler
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: "1d",
                    } // texture
                },
            ]
        });
        this.bindGroup1D = this.device.createBindGroup({
            label: "bindGroup1D",
            layout: this.BindGroupLayout1D,
            entries: [
                { binding: 0, resource: this.sampler1D },
                { binding: 1, resource: this.texture1D.createView() },
            ],
        });
    }

    update(settings) {
        if (this.colormap1D.isUpdated) {
            settings.userUpdate = true;
            this.device.queue.writeTexture(
                { texture: this.texture1D },
                this.colormap1D.colorMapArray,
                { bytesPerRow: LightSpectrum.NUM_BINS_BASE * 4 },
                { width: LightSpectrum.NUM_BINS_BASE },
            );
            
            this.colormap1D.isUpdated = false;
        }
    }
}