import { LightSpectrum } from "../lactea/LightSpectrum.js";
import { Pipeline } from "./utils/Pipeline.js";
import { TimingHelper } from "./utils/TimingHelper.js";
import { CIE_BINS } from "./utils/utils.js";

export class RenderPipeline {
    constructor(device) {
        this.device = device;

        this.settings = {
            colormapStrategy: 0,
            colormapStrategies: {
                // Colormap2D: 0,
                Photometry: 0,
                Wavelength: 1,
                Intensity: 2,
                Temperature: 3,
                Temperature_BP_RP: 4,
                CIE: 5,
                Density: 6,
                PhotometryRp: 7,
                PhotometryBp: 8,
                PhotometryG: 9,
                Integrate: 10,
                HAlpha: 11,
                HubblePaletteSHO: 12,
                HubblePaletteHOO: 13,
                StarListNodeId: 14,
                PatchNodeId: 15,
            },
            normalizationStrategy: 0,
            normalizationStrategies: {
                log10: 0,
                linear: 1,
                loglinear: 2,
                gammaCorrection: 3,
            },
            tonemappingStrategy: 0,
            tonemappingStrategies: {
                none: 0,
                sigmoid: 1,
                logCompression: 2
            },
            extinction: false,
            gaussianKernelSize: 3,
            gaussianSigma: 1,
            narrowBandSigma: 1,
            minPercentile: 0.01,
            maxPercentile: 0.99,
            gammaCorrection: 2.2,
            subtractContinuum: false,
            continuumSigma: 10,
            continuumKernelSize: 10,
            patchLevel: 0
        }

        this.load({});

    }

    load(settings) {
        this.settings.colormapStrategy = settings?.colormapStrategy ?? this.settings.colormapStrategies.Photometry;
        this.settings.normalizationStrategy = settings?.normalizationStrategy ?? this.settings.normalizationStrategies.gammaCorrection;
        this.settings.tonemappingStrategy = settings?.tonemappingStrategy ?? this.settings.tonemappingStrategies.none;
        this.settings.extinction = settings?.extinction ?? false;
        this.settings.gaussianKernelSize = settings?.gaussianKernelSize ?? 3;
        this.settings.gaussianSigma = settings?.gaussianSigma ?? 1;
        this.settings.narrowBandSigma = settings?.narrowBandSigma ?? 1;
        this.settings.minPercentile = settings?.minPercentile ?? 0.01;
        this.settings.maxPercentile = settings?.maxPercentile ?? 0.99;
        this.settings.gammaCorrection = settings?.gammaCorrection ?? 2.2;
        this.settings.isClip = settings?.isClip ?? true;
        this.settings.subtractContinuum = settings?.subtractContinuum ?? false;
        this.settings.continuumSigma = settings?.continuumSigma ?? 10;
        this.settings.continuumKernelSize = settings?.continuumKernelSize ?? 10;
        this.settings.patchLevel = settings?.patchLevel ?? 0;
    }

    store() {
        let settings = {};
        settings.colormapStrategy = this.settings.colormapStrategy;
        settings.normalizationStrategy = this.settings.normalizationStrategy;
        settings.tonemappingStrategy = this.settings.tonemappingStrategy;
        settings.extinction = this.settings.extinction;
        settings.gaussianKernelSize = this.settings.gaussianKernelSize;
        settings.gaussianSigma = this.settings.gaussianSigma;
        settings.narrowBandSigma = this.settings.narrowBandSigma;
        settings.minPercentile = this.settings.minPercentile;
        settings.maxPercentile = this.settings.maxPercentile;
        settings.gammaCorrection = this.settings.gammaCorrection;
        settings.isClip = this.settings.isClip;
        settings.subtractContinuum = this.settings.subtractContinuum;
        settings.continuumSigma = this.settings.continuumSigma;
        settings.continuumKernelSize = this.settings.continuumKernelSize;
        settings.patchLevel = this.settings.patchLevel;
        return settings;
    }

    ui(gui, mainSettings) {
        const query = gui.addFolder('UI');
        query.add(this.settings, "colormapStrategy", this.settings.colormapStrategies)
            .onChange(value => {
                mainSettings.updateUser();
            }).listen();
        query.add(this.settings, "normalizationStrategy", this.settings.normalizationStrategies)
            .onChange(value => {
                mainSettings.updateUser();
            }).listen();
        query.add(this.settings, "tonemappingStrategy", this.settings.tonemappingStrategies)
            .onChange(value => {
                mainSettings.updateUser();
            }).listen();
        query.add(this.settings, "extinction")
            .onChange(value => {
                mainSettings.updateUser();
                mainSettings.updateNarrowband = true;
            }).listen();
        query.add(this.settings, "gaussianKernelSize")
            .onChange(value => {
                mainSettings.updateUser();
            }).listen();
        query.add(this.settings, "gaussianSigma")
            .onChange(value => {
                mainSettings.updateUser();
            }).listen();
        query.add(this.settings, "narrowBandSigma")
            .onChange(value => {
                mainSettings.updateUser();
                mainSettings.updateNarrowband = true;
            }).listen();

        query.add(this.settings, "maxPercentile")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "minPercentile")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "gammaCorrection")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "subtractContinuum")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "continuumKernelSize")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "continuumSigma")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        query.add(this.settings, "patchLevel")
        .onChange(value => {
            mainSettings.updateUser();
        }).listen();
        // query.add(this.settings, "isClip")
        // .name("clip (T) or remove outliers (F)")
        // .onChange(value => {
        //     mainSettings.updateUser();
        // }).listen();
    }

    async setup(includes = [], bindgroupsLayouts = [], canvasFormat) {
        this.hdrFormat = "rgba32float";
        this.ldrFormat = "rgba8unorm";
        this.workgroup_z = Math.ceil(LightSpectrum.NUM_BINS_BASE / 256);
        this.workgroup_z_cie = Math.ceil(CIE_BINS / 256);
        // uniforms, samples, buffers

        this.hdrBindGroupLayout = this.device.createBindGroupLayout({
            label: "HdrBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: { type: "storage" }
                },
            ]
        });

        this.ldrBindGroupLayout = this.device.createBindGroupLayout({
            label: "LdrBindGroupLayout",
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
                        viewDimension: "2d",
                        format: canvasFormat,
                        sampleType: "float"
                    } // texture
                },
            ]
        });


        this.postprocessBindGroupLayout = this.device.createBindGroupLayout({
            label: "postprocessBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        viewDimension: "2d",
                        // format: this.ldrFormat,
                    } // input texture
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        viewDimension: "2d",
                        format: this.ldrFormat,
                        access: 'write-only',
                    } // output texture
                },
            ]
        });

        let strategies = `
        const Photometry: u32 = ${this.settings.colormapStrategies.Photometry};
        const PhotometryRp: u32 = ${this.settings.colormapStrategies.PhotometryRp};
        const PhotometryBp: u32 = ${this.settings.colormapStrategies.PhotometryBp};
        const PhotometryG: u32 = ${this.settings.colormapStrategies.PhotometryG};
        const Density: u32 = ${this.settings.colormapStrategies.Density};
        const Temperature: u32 = ${this.settings.colormapStrategies.Temperature};
        const Temperature_BP_RP: u32 = ${this.settings.colormapStrategies.Temperature_BP_RP};
        const CIE: u32 = ${this.settings.colormapStrategies.CIE};
        const Intensity: u32 = ${this.settings.colormapStrategies.Intensity};
        const Wavelength: u32 = ${this.settings.colormapStrategies.Wavelength};
        const StarListNodeId: u32 = ${this.settings.colormapStrategies.StarListNodeId};
        const PatchNodeId: u32 = ${this.settings.colormapStrategies.PatchNodeId};
        const Integrate: u32 = ${this.settings.colormapStrategies.Integrate};
        const HAlpha: u32 = ${this.settings.colormapStrategies.HAlpha};
        const HubblePaletteSHO: u32 = ${this.settings.colormapStrategies.HubblePaletteSHO};
        const HubblePaletteHOO: u32 = ${this.settings.colormapStrategies.HubblePaletteHOO};

        const normalizationLog10 : u32 = ${this.settings.normalizationStrategies.log10};
        const normalizationLoglinear : u32 = ${this.settings.normalizationStrategies.loglinear};
        const normalizationGammaCorrection : u32 = ${this.settings.normalizationStrategies.gammaCorrection};
        const normalizationLinear : u32 = ${this.settings.normalizationStrategies.linear};

        const tonemappingNone : u32 = ${this.settings.tonemappingStrategies.none};
        const tonemappingSigmoid : u32 = ${this.settings.tonemappingStrategies.sigmoid};
        const tonemappingLogCompression : u32 = ${this.settings.tonemappingStrategies.logCompression};
        
        `;
        // pipelines


        this.ciePipeline = new Pipeline(this.device);
        await this.ciePipeline.createComputePipeline('CIEConvolutionShader.wgsl', [...includes, strategies], 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);

        this.colorConvolutionPipeline = new Pipeline(this.device);
        await this.colorConvolutionPipeline.createComputePipeline('ColorConvolutionShader.wgsl', includes, 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);

        this.narrowBandFilteringPipeline = new Pipeline(this.device);
        await this.narrowBandFilteringPipeline.createComputePipeline('NarrowBandFilter.wgsl', [...includes, strategies], 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);


        this.photometryPipeline = new Pipeline(this.device);
        await this.photometryPipeline.createComputePipeline('PhotometryShader.wgsl', [...includes, strategies], 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);


        this.colormapPipeline = new Pipeline(this.device);
        await this.colormapPipeline.createComputePipeline('ColormapShader.wgsl', [...includes, strategies], 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);


        this.colormapCategoricalPipeline = new Pipeline(this.device);
        await this.colormapCategoricalPipeline.createComputePipeline('ColormapCategoricalShader.wgsl', [...includes, strategies], 'computeMain',
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);


        this.ldrPipeline = new Pipeline(this.device);
        await this.ldrPipeline.createRenderPipeline('LDRShader.wgsl', [...includes, strategies], 'vs', 'fs',
            [...bindgroupsLayouts, this.hdrBindGroupLayout],
            [{ format: this.ldrFormat }]);

        this.horizontalGaussianSmoothingPipeline = new Pipeline(this.device);
        await this.horizontalGaussianSmoothingPipeline.createComputePipeline('GaussianSmoothingShader.wgsl', [...includes, `
            const HORIZONTAL = true;
        `], "computeMain",
            [bindgroupsLayouts[0], this.postprocessBindGroupLayout]);

        this.verticalGaussianSmoothingPipeline = new Pipeline(this.device);
        await this.verticalGaussianSmoothingPipeline.createComputePipeline('GaussianSmoothingShader.wgsl', [...includes, `
            const HORIZONTAL = false;
        `], "computeMain",
            [bindgroupsLayouts[0], this.postprocessBindGroupLayout]);

        this.reduceMaxPipeline = new Pipeline(this.device);
        await this.reduceMaxPipeline.createComputePipeline("ReduceMax.wgsl", includes, "computeMain",
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);

        this.imageHistPipeline = new Pipeline(this.device);
        await this.imageHistPipeline.createComputePipeline("ImageHistogram.wgsl", includes, "computeMain",
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);
            
        this.percentilePipeline = new Pipeline(this.device);
        await this.percentilePipeline.createComputePipeline("Percentile.wgsl", includes, "computeMain",
            [...bindgroupsLayouts, this.hdrBindGroupLayout]);

        this.nodeCountPipeline = new Pipeline(this.device);
        await this.nodeCountPipeline.createComputePipeline("ReduceNodeCount.wgsl", [includes[0]], "computeMain",
            [bindgroupsLayouts[0]]);

        // time pass
        this.hdrTimingHelper = new TimingHelper(this.device);
        this.ldrTimingHelper = new TimingHelper(this.device);
        this.gaussianSmoothingTimingHelper = new TimingHelper(this.device);
        this.reduceTimingHelper = new TimingHelper(this.device);
        this.imageHistTimingHelper = new TimingHelper(this.device);
        this.percentileTimingHelper = new TimingHelper(this.device);
        this.nodeCountReduceTimingHelper = new TimingHelper(this.device);
    }

    updateTexture(size) {
        this.size = size;
        this.workgroup_x = Math.ceil(this.size[0] / 8);
        this.workgroup_y = Math.ceil(this.size[1] / 8);
        this.workgroup_x1 = Math.ceil(this.size[0]);
        this.workgroup_y1 = Math.ceil(this.size[1]);

        this.ldrTexture = this.device.createTexture({
            label: 'LdrTexture',
            dimension: "2d",
            size: size,
            format: this.ldrFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        this.ldrSampler = this.device.createSampler({
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            magFilter: 'linear',
        });
        this.ldrBindGroup = this.device.createBindGroup({
            label: "LdrBindGroup",
            layout: this.ldrBindGroupLayout,
            entries: [
                { binding: 0, resource: this.ldrSampler },
                { binding: 1, resource: this.ldrTexture.createView() },
            ],
        });

        this.hdrBuffer = this.device.createBuffer({
            label: "hdrBuffer",
            size: size[0] * size[1] * 4 * 4, // 4 channels per pixel, each is 4 bytes
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        this.hdrBindGroup = this.device.createBindGroup({
            label: "HdrBindGroup",
            layout: this.hdrBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.hdrBuffer } },
            ],
        });

        this.horizontalGaussTexture = this.device.createTexture({
            label: 'horizontalGaussTexture',
            dimension: "2d",
            size: size,
            format: this.ldrFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
        });
        this.verticalGaussTexture = this.device.createTexture({
            label: 'verticalGaussTexture',
            dimension: "2d",
            size: size,
            format: this.ldrFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
        });
        this.horizontalGaussBindGroup = this.device.createBindGroup({
            label: "horizontalGaussBindGroup",
            layout: this.postprocessBindGroupLayout,
            entries: [
                { binding: 0, resource: this.ldrTexture.createView() },
                { binding: 1, resource: this.horizontalGaussTexture.createView() },
            ],
        });
        this.verticalGaussBindGroup = this.device.createBindGroup({
            label: "verticalGaussBindGroup",
            layout: this.postprocessBindGroupLayout,
            entries: [
                { binding: 0, resource: this.horizontalGaussTexture.createView() },
                { binding: 1, resource: this.verticalGaussTexture.createView() },
            ],
        });
        this.renderBindGroup = this.device.createBindGroup({
            label: "renderBindGroup",
            layout: this.ldrBindGroupLayout,
            entries: [
                { binding: 0, resource: this.ldrSampler },
                { binding: 1, resource: this.verticalGaussTexture.createView() },
            ],
        });

        // copy hdr
        this.cpuBuffer = this.device.createBuffer({
            size: this.hdrBuffer.size, // 4 channels, each 4 bytes
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

    }

    renderHdr(encoder, bindGroups) {
        encoder.clearBuffer(this.hdrBuffer);
        const hdrpass = this.hdrTimingHelper.beginComputePass(encoder, {});


        if (this.settings.colormapStrategy === this.settings.colormapStrategies.CIE ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.Temperature_BP_RP ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.Temperature
        ) {
            this.ciePipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_z_cie, this.workgroup_x1, this.workgroup_y1);
        }
        else if (this.settings.colormapStrategy === this.settings.colormapStrategies.Wavelength) {
            this.colorConvolutionPipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_z, this.workgroup_x1, this.workgroup_y1);
        }
        else if (this.settings.colormapStrategy === this.settings.colormapStrategies.Integrate || 
            this.settings.colormapStrategy === this.settings.colormapStrategies.HAlpha ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.HubblePaletteSHO || 
            this.settings.colormapStrategy === this.settings.colormapStrategies.HubblePaletteHOO
        ) {
            this.narrowBandFilteringPipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_z, this.workgroup_x1, this.workgroup_y1);
        }
        else if (this.settings.colormapStrategy === this.settings.colormapStrategies.Photometry) {
            this.photometryPipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_x, this.workgroup_y);
        }
        else if (
            this.settings.colormapStrategy === this.settings.colormapStrategies.StarListNodeId ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.PatchNodeId
        ) {
            this.colormapCategoricalPipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_x, this.workgroup_y);
        }
        else if (
            this.settings.colormapStrategy === this.settings.colormapStrategies.Density ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.PhotometryRp ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.PhotometryBp ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.PhotometryG ||
            this.settings.colormapStrategy === this.settings.colormapStrategies.Intensity
        ) {
            this.colormapPipeline.setBindGroups(hdrpass, [...bindGroups]);
            hdrpass.dispatchWorkgroups(this.workgroup_x, this.workgroup_y);
        }
        hdrpass.end();
    }

    renderLdr(encoder, bindGroups) {
        const ldrpass = this.ldrTimingHelper.beginRenderPass(encoder,
            {
                colorAttachments: [
                    {
                        view: this.ldrTexture.createView(),
                        loadOp: "clear",
                        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                        storeOp: "store",
                    }
                ]
            });
        this.ldrPipeline.setBindGroups(ldrpass, [...bindGroups]);
        ldrpass.draw(6);
        ldrpass.end();
    }

    renderGaussianBlur(encoder, bindGroups) {
        const workgroup_x = Math.ceil(this.size[0] / 8);
        const workgroup_y = Math.ceil(this.size[1] / 8);

        const pass = this.gaussianSmoothingTimingHelper.beginComputePass(encoder, {});
        this.horizontalGaussianSmoothingPipeline.setBindGroups(pass, [...bindGroups, this.horizontalGaussBindGroup]);
        pass.dispatchWorkgroups(workgroup_x, workgroup_y);
        this.verticalGaussianSmoothingPipeline.setBindGroups(pass, [...bindGroups, this.verticalGaussBindGroup]);
        pass.dispatchWorkgroups(workgroup_x, workgroup_y);
        pass.end();
    }

    reduceNodeCount(encoder, bindGroups = []) {
        const workgroup_x = Math.ceil(this.size[0] / 4);
        const workgroup_y = Math.ceil(this.size[1] / 4);

        // node count 
        const nodeCountPass = this.nodeCountReduceTimingHelper.beginComputePass(encoder, {});
        this.nodeCountPipeline.setBindGroups(nodeCountPass, [...bindGroups]);
        nodeCountPass.dispatchWorkgroups(1, workgroup_x, workgroup_y);
        nodeCountPass.end();
    }

    renderToTexture(encoder, bindGroups = []) {
        const workgroup_x = Math.ceil(this.size[0] / 4);
        const workgroup_y = Math.ceil(this.size[1] / 4);

        // HDR
        this.renderHdr(encoder, [...bindGroups, this.hdrBindGroup]);

        // min/max for tone mapping
        const reducePass = this.reduceTimingHelper.beginComputePass(encoder, {});
        this.reduceMaxPipeline.setBindGroups(reducePass, [...bindGroups, this.hdrBindGroup]);
        reducePass.dispatchWorkgroups(1, workgroup_x, workgroup_y);
        reducePass.end();

        // image hist
        const histPass = this.imageHistTimingHelper.beginComputePass(encoder, {});
        this.imageHistPipeline.setBindGroups(histPass, [...bindGroups, this.hdrBindGroup]);
        histPass.dispatchWorkgroups(1, workgroup_x, workgroup_y);
        histPass.end();

        // percentile 
        const percentilePass = this.percentileTimingHelper.beginComputePass(encoder, {});
        this.percentilePipeline.setBindGroups(percentilePass, [...bindGroups, this.hdrBindGroup]);
        percentilePass.dispatchWorkgroups(1);
        percentilePass.end();

        // LDR
        this.renderLdr(encoder, [...bindGroups, this.hdrBindGroup]);

        // post processing
        this.renderGaussianBlur(encoder, [bindGroups[0]]);
    }

    async spectrumToCpu() {
        if (this.cpuBuffer.mapState === "unmapped") {
            const gpu2cpuEncoder = this.device.createCommandEncoder();
            gpu2cpuEncoder.copyBufferToBuffer(
                this.hdrBuffer, 0, 
                this.cpuBuffer, 0,
                this.cpuBuffer.size
            );
            this.device.queue.submit([gpu2cpuEncoder.finish()]);
            return this.cpuBuffer
                .mapAsync(GPUMapMode.READ)
                .then(() => {
                    const copyArrayBuffer = this.cpuBuffer.getMappedRange();
                    const data = new Float32Array(copyArrayBuffer.slice(0));
                    this.cpuBuffer.unmap();
                    return {
                        data: [...data],
                        width: this.size[0],
                        height: this.size[1],
                    };
                });
        }
    }
}