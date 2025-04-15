import { LightSpectrum } from '../lactea/LightSpectrum.js';
import { LacteaCache } from './LacteaCache.js';
import { Camera } from "./Camera.js";

import { TimingHelper } from "./utils/TimingHelper.js";
import { DEPTH, DENSITY_MAX_OFFSET, IMAGE_HIST_OFFSET, IMAGE_HIST_BIN_SIZE, OUTPUT_DEPTH, include_shader, include_combined_spectra_shader, initMinMax } from './utils/utils.js';

import { ViewerProgress } from './ViewerProgress.js';
import { PerformanceViewer } from './ViewerPerformance.js';
import { ViewerColormap } from './ViewerColormap.js';
// import { ViewerSignature } from './ViewerSignature.js';

import { Pipeline } from './utils/Pipeline.js';
import { RenderPipeline } from './PipelineRender.js';
import { SelectedSpectrum } from './PipelineSelectedSpectrum.js';
import { StarCompute } from './PipelineStarCompute.js';
import { NodeCompute } from './PipelineNodeCompute.js';
import { MinimapPipeline } from './PipelineMinimap.js';
import { NodeLayoutPipeline } from './PipelineNodeLayout.js';
import { ViewerConvergence } from './ViewerConvergence.js';
import { downloadCanvas, saveTemplateAsFile, getJsonUpload } from './utils/utils.js';
import { Settings } from './Settings.js';

export class LacteaVisualizer {
    constructor(canvasId) {
        this.canvas = document.querySelector(canvasId);


        // WebGPU checking
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        // general settings
        this.settings = new Settings();

        console.log("making visualizer ...");
    }

    download() {
        const filename = new Date().toISOString();
        downloadCanvas(`${filename}_skymap.png`, this.canvas);
        downloadCanvas(`${filename}_spectrum.png`, this.selectedSpectrum.spectrumViewer.store());

        let settings = {};
        settings.general = this.settings.store();
        settings.camera = this.cam.store();
        settings.cache = this.lacteaCache.store();
        settings.renderPipeline = this.renderPipeline.store();
        // settings.signature = this.signature.store();
        settings.colormap = this.colormap.store();
        saveTemplateAsFile(`${filename}_settings.json`, settings);

        let snapshot = {};
        snapshot.progress = this.progressBar.store();
        snapshot.convergeChart = this.convergeChart.store();
        snapshot.selectedSpectrum = this.selectedSpectrum.store();
        snapshot.performance = this.performanceViewer.store();
        saveTemplateAsFile(`${filename}_snapshot.json`, snapshot);
    }

    async downloadHdr() {
        const filename = new Date().toISOString();
        await this.renderPipeline
            .spectrumToCpu()
            .then(data => {
                // console.log(data.reduce((a, b)=> a+b, 0));

                saveTemplateAsFile(`${filename}_hdr_image.json`, data);
            });
    }

    loadSettings(settings) {
        this.settings.load(settings.general ?? {});
        this.cam.load(settings.camera ?? {});
        this.lacteaCache.load(settings.cache ?? {});
        this.renderPipeline.load(settings.renderPipeline ?? {});
        // this.signature.load(settings.signature ?? {});
        this.colormap.load(settings.colormap ?? {});
        this.settings.reloadEverything();
    }

    async load() {
        await getJsonUpload().then(files => {
            this.loadSettings(files[0]);
        });
    }

    async loadProfile(name) {
        console.log(`loading profile ${name}`);
        await fetch(`res/profile/${name}`)
        .then(file => file.text())
        .then(text => JSON.parse(text))
        .then(settings => {
            this.loadSettings(settings);
        });
    }
    

    async init() {
        console.log("visualizer init start");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }
        console.log(adapter.limits);
        // limits
        const requiredLimits = {};
        requiredLimits.maxBufferSize = adapter.limits.maxBufferSize;
        requiredLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
        this.canTimestamp = adapter.features.has('timestamp-query');
        this.bufferSize = Math.min(
            requiredLimits.maxBufferSize,
            requiredLimits.maxStorageBufferBindingSize
        );
        this.device = await adapter.requestDevice({
            requiredLimits,
            requiredFeatures: [
                ...(this.canTimestamp ? ['timestamp-query'] : []),
            ],
        });

        // Context setup
        this.context = this.canvas.getContext("webgpu");
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.canvasFormat,
        });

        // resize
        window.addEventListener('resize', evt => this.resizeCanvas(), true);
        this.resizeCanvas();

        // lactea, camera
        this.lacteaCache = new LacteaCache(
            adapter.limits.maxComputeWorkgroupsPerDimension,
            this.bufferSize
        );
        await this.lacteaCache.init(this.device);

        this.cam = new Camera();
        this.cam.addEventListeners(this.canvas, this.settings);

        // gui
        // this.gui = new lil.GUI({ container: document.querySelector("#maingui") });
        this.gui = new lil.GUI();

        this.gui.add(this, "download");
        this.gui.add(this, "downloadHdr");
        this.gui.add(this, "load");
        this.settings.ui(this.gui, this.settings);
        this.lacteaCache.ui(this.gui, this.settings);
        this.cam.ui(this.gui, this.settings);

        // ui for infovis
        this.progressBar = new ViewerProgress();
        this.selectedSpectrum = new SelectedSpectrum(
            this.device,
            this.gui,
            this.cam,
            (coord, cam) => this.lacteaCache.lactea.screenToLoc(coord, cam)
        );
        this.colormap = new ViewerColormap(this.device, this.gui);
        // this.signature = new ViewerSignature(this.device, this.gui, this.settings);
        this.performanceViewer = new PerformanceViewer();
        this.convergeChart = new ViewerConvergence();

        // time pass
        this.timingHelper = new TimingHelper(this.device);
        console.log("visualizer init done");
    }

    async setup() {
        console.log("visualizer setup start");

        // uniforms, samples, buffers
        this.spectralImageBuffer = this.device.createBuffer({
            label: "spectralImageBuffer",
            size: this.canvas.width * this.canvas.height * DEPTH * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        console.log(`spectral image size (${this.canvas.width}, ${this.canvas.height}, ${DEPTH}) [${this.spectralImageBuffer.size * 1e-6} megabytes]`);

        this.cameraArray = new ArrayBuffer(4 * 64); // 4 bytes x bytes
        this.cameraFloatView = new Float32Array(this.cameraArray);
        this.cameraUintView = new Uint32Array(this.cameraArray);
        this.cameraUintView[0] = this.canvas.width;
        this.cameraUintView[1] = this.canvas.height;
        this.cameraFloatView[4] = this.cam.zoom;
        this.cameraFloatView[5] = this.cam.offset[0];
        this.cameraFloatView[6] = this.cam.offset[1];
        this.cameraUintView[7] = Math.floor(this.cam.cursorPos[0] * (this.canvas.width - 1));
        this.cameraUintView[8] = Math.floor(this.cam.cursorPos[1] * (this.canvas.height - 1));
        this.cameraUintView[9] = Math.floor(this.cam.cursorPos2[0] * (this.canvas.width - 1));
        this.cameraUintView[10] = Math.floor(this.cam.cursorPos2[1] * (this.canvas.height - 1));
        this.cameraUintView[11] = this.cam.proj;
        this.cameraUintView[12] = this.cam.areaSelector;
        this.cameraFloatView[13] = this.settings.selectionColor.r;
        this.cameraFloatView[14] = this.settings.selectionColor.g;
        this.cameraFloatView[15] = this.settings.selectionColor.b;
        this.cameraFloatView.set(this.cam.vpMat, 48);

        this.cameraBuffer = this.device.createBuffer({
            label: 'cameraBuffer',
            size: this.cameraArray.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.selectedSpectrumBuffer = this.device.createBuffer({
            label: "selectedSpectrumBuffer",
            size: (OUTPUT_DEPTH + this.lacteaCache.lactea.tree.numNodes) * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });
        console.log(`selectedSpectrumBuffer size (${OUTPUT_DEPTH} + ${this.lacteaCache.lactea.tree.numNodes}) [${this.selectedSpectrumBuffer.size} bytes]`);

        // bind group layouts
        this.uiBindGroupLayout = this.device.createBindGroupLayout({
            label: "uiBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: {} // camera & user setting
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: { type: "storage" } // 3d texture data
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" } // nodes
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
                    buffer: { type: "storage" } // output + stats 1d buffer
                },
            ]
        });

        this.textureBindGroupLayout = this.device.createBindGroupLayout({
            label: "textureBindGroupLayout",
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
                    } // texture
                },
            ]
        });


        // setup buffers
        await this.colormap.setup();
        // await this.signature.setup();

        // pipelines
        this.starCompute = new StarCompute(this.device);
        await this.starCompute.setup(
            [include_shader],
            [this.uiBindGroupLayout]
        );
        this.starCompute.createBindGroups(this.lacteaCache);

        this.nodeCompute = new NodeCompute(this.device);
        await this.nodeCompute.setup(
            [include_shader],
            [this.uiBindGroupLayout],
            this.textureBindGroupLayout
        );
        this.nodeCompute.createBindGroups(this.lacteaCache);

        await this.selectedSpectrum.setup(
            [include_shader, include_combined_spectra_shader],
            [this.uiBindGroupLayout],
            this.canvasFormat,
            this.lacteaCache.lactea.tree.numNodes
        );

        this.renderPipeline = new RenderPipeline(this.device);
        await this.renderPipeline.setup(
            [include_shader, include_combined_spectra_shader],
            [this.uiBindGroupLayout, this.colormap.BindGroupLayout1D],
            this.canvasFormat
        );
        this.renderPipeline.ui(this.gui, this.settings);

        this.minimapPipeline = new MinimapPipeline(this.device);
        await this.minimapPipeline.setup(
            [include_shader],
            [this.uiBindGroupLayout, this.nodeCompute.nodeBindGroupLayout],
            this.canvasFormat,
            "bgra8unorm"
        );

        this.nodeLayoutPipeline = new NodeLayoutPipeline(this.device);
        await this.nodeLayoutPipeline.setup(
            [include_shader],
            [this.uiBindGroupLayout, this.nodeCompute.nodeBindGroupLayout],
            this.textureBindGroupLayout,
            this.canvasFormat,
            "bgra8unorm");

        this.secondScreenNodeLayoutPipeline = new NodeLayoutPipeline(this.device);
        await this.secondScreenNodeLayoutPipeline.setup(
            [include_shader],
            [this.uiBindGroupLayout, this.nodeCompute.nodeBindGroupLayout],
            this.textureBindGroupLayout,
            this.canvasFormat,
            "bgra8unorm",
            "line-list"
        );

        this.texturePipeline = new Pipeline(this.device);
        await this.texturePipeline.createRenderPipeline(
            'TextureShader.wgsl',
            [],
            'vs',
            'fs',
            [this.textureBindGroupLayout],
            [{ format: this.canvasFormat }]
        );

        this.twoScreenTexturePipeline = new Pipeline(this.device);
        await this.twoScreenTexturePipeline.createRenderPipeline(
            'TwoScreenTextureShader.wgsl',
            [],
            'vs',
            'fs',
            [this.textureBindGroupLayout, this.textureBindGroupLayout],
            [{ format: this.canvasFormat }]
        );

        this.loadProfile("default.json")

        console.log("visualizer setup done");
    }

    resizeCanvas() {
        console.log("resize");
        // sizing
        let width = window.innerWidth;
        let height = width * 9 / 16;
        while (width * height * DEPTH * 4 >= this.bufferSize) {
            width -= 20;
            height = width * 9 / 16;
        }
        this.canvas.width = width;
        this.canvas.height = height;
        this.settings.updateCanvas = true;
        this.settings.reloadEverything();
        console.log(this.canvas.width, this.canvas.height);
    }

    renderloop(now) {
        if(this.settings.loadProfile) {
            this.loadProfile(this.settings.profiles[this.settings.profile]);
            this.settings.loadProfile = false;
        }
        this.settings.performance = (this.settings.isRedraw() || this.settings.isUpdateSpectrum()) && !this.settings.isPaused();
        this.performanceViewer.start(now, this.settings.performance);
        if (((now - this.settings.then) > this.settings.deltaTime) && !this.settings.isPaused()) {
            this.settings.then = now;

            if (this.settings.updateCanvas) {
                if (this.spectralImageBuffer) { this.spectralImageBuffer.destroy(); }
                this.spectralImageBuffer = this.device.createBuffer({
                    label: "spectralImageBuffer",
                    size: this.canvas.width * this.canvas.height * DEPTH * 4,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                });

                this.cameraUintView[0] = this.canvas.width;
                this.cameraUintView[1] = this.canvas.height;

                this.renderPipeline.updateTexture([this.canvas.width, this.canvas.height]);
                this.nodeCompute.updateTexture([this.canvas.width, this.canvas.height]);
                this.minimapPipeline.updateTexture([this.canvas.width, this.canvas.height]);
                this.nodeLayoutPipeline.updateTexture([this.canvas.width, this.canvas.height]);
                this.secondScreenNodeLayoutPipeline.updateTexture([this.canvas.width, this.canvas.height], 1);

                this.uiBindGroup = this.device.createBindGroup({
                    label: "uiBindGroup",
                    layout: this.uiBindGroupLayout,
                    entries: [
                        { binding: 0, resource: { buffer: this.cameraBuffer } },
                        { binding: 1, resource: { buffer: this.spectralImageBuffer } },
                        { binding: 2, resource: { buffer: this.lacteaCache.nodeBuffer } },
                        { binding: 3, resource: { buffer: this.selectedSpectrumBuffer } },
                    ],
                });

                this.settings.updateCanvas = false;
            }

            if (this.settings.update || this.settings.userUpdate) {
                this.cameraUintView[2] = this.renderPipeline.settings.colormapStrategy;
                this.cameraUintView[3] = this.renderPipeline.settings.normalizationStrategy;
                this.cameraUintView[22] = this.renderPipeline.settings.tonemappingStrategy;
                this.cameraFloatView[4] = this.cam.zoom;
                this.cameraFloatView[5] = this.cam.offset[0];
                this.cameraFloatView[6] = this.cam.offset[1];
                this.cameraUintView[7] = Math.floor(this.cam.cursorPos[0] * (this.canvas.width - 1));
                this.cameraUintView[8] = Math.floor(this.cam.cursorPos[1] * (this.canvas.height - 1));
                this.cameraUintView[9] = Math.floor(this.cam.cursorPos2[0] * (this.canvas.width - 1));
                this.cameraUintView[10] = Math.floor(this.cam.cursorPos2[1] * (this.canvas.height - 1));
                this.cameraUintView[11] = this.cam.proj;
                this.cameraUintView[12] = this.cam.areaSelector;
                this.cameraFloatView[13] = this.settings.selectionColor.r;
                this.cameraFloatView[14] = this.settings.selectionColor.g;
                this.cameraFloatView[15] = this.settings.selectionColor.b;
                this.cameraFloatView[20] = this.renderPipeline.settings.minPercentile;
                this.cameraFloatView[21] = this.renderPipeline.settings.maxPercentile;
                this.cameraUintView[28] = this.renderPipeline.settings.extinction;
                this.cameraUintView[29] = this.renderPipeline.settings.gaussianKernelSize;
                this.cameraFloatView[30] = this.renderPipeline.settings.gaussianSigma;
                this.cameraFloatView[31] = this.renderPipeline.settings.narrowBandSigma;
                this.cameraFloatView[32] = this.renderPipeline.settings.gammaCorrection;
                this.cameraUintView[33] = this.renderPipeline.settings.isClip;
                this.cameraUintView[34] = this.settings.showPatches;
                this.cameraUintView[35] = this.settings.showStars;
                this.cameraUintView[36] = this.renderPipeline.settings.subtractContinuum;
                this.cameraUintView[37] = this.renderPipeline.settings.continuumKernelSize;
                this.cameraFloatView[38] = this.renderPipeline.settings.continuumSigma;
                this.cameraUintView[39] = this.renderPipeline.settings.patchLevel;
                this.cameraFloatView.set(this.cam.vpMat, 48);

                this.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraArray);

            }

            this.colormap.update(this.settings);

            if(this.settings.updateNarrowband) {
                this.selectedSpectrum.updateNarrowband(this.renderPipeline.settings.narrowBandSigma, this.renderPipeline.settings.extinction);
                this.settings.updateNarrowband = false;
            }
            // this.signature.update(this.settings, (signature, error) => this.selectedSpectrum.updateSignature(signature, error));

            if (this.settings.update || this.settings.cacheLoad || !this.settings.areTasksCompleted()) {
                this.computeSpectralImage();
            }
            const encoder = this.device.createCommandEncoder();

            if (this.settings.isUpdateSpectrum()) {
                this.settings.resetUpdateSpectrum();
                encoder.clearBuffer(this.selectedSpectrumBuffer, 0, DEPTH * 4);

                this.selectedSpectrum.reduceSelection(
                    encoder,
                    this.canvas.width,
                    this.canvas.height,
                    [this.uiBindGroup]
                );
                this.settings.updateCpuSpectrum();
            }


            if (this.settings.isRedraw()) {
                this.device.queue.writeBuffer(this.selectedSpectrumBuffer, (DENSITY_MAX_OFFSET) * 4, initMinMax);
                encoder.clearBuffer(this.selectedSpectrumBuffer, IMAGE_HIST_OFFSET * 4, (IMAGE_HIST_BIN_SIZE) * 4);
                this.renderPipeline.renderToTexture(encoder, [this.uiBindGroup, this.colormap.bindGroup1D]);

                // render pass
                let colorAttachments = [
                    {
                        view: this.context.getCurrentTexture().createView(),
                        loadOp: "clear",
                        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
                        storeOp: "store",
                    }
                ];
                const pass = this.timingHelper.beginRenderPass(encoder, { colorAttachments });

                if (this.settings.showTwoScreens) {
                    this.twoScreenTexturePipeline.setBindGroups(
                        pass,
                        [
                            this.renderPipeline.renderBindGroup,
                            this.secondScreenNodeLayoutPipeline.bindGroup
                        ]);
                } else {
                    this.texturePipeline.setBindGroups(
                        pass,
                        [this.renderPipeline.renderBindGroup]
                    );
                }
                pass.draw(8);
                if (this.settings.showSelection) {
                    this.selectedSpectrum.render(pass, [this.uiBindGroup]);
                }
                if (!this.settings.showTwoScreens) {
                    if (this.settings.showMinimap) {
                        this.minimapPipeline.render(pass);
                    }
                    if (this.settings.showNodeLayout) {
                        this.nodeLayoutPipeline.render(pass);
                    }
                }

                pass.end();

                this.settings.userUpdate = false;
                // submit command
            }

            this.device.queue.submit([encoder.finish()]);

            if (this.settings.isUpdateCpuSpectrum()) {
                this.selectedSpectrum.spectrumToCpu(this.selectedSpectrumBuffer).then(flag => {
                    if (flag) {
                        this.settings.resetUpdateCpuSpectrum();
                        if (this.selectedSpectrum.process.dataAvailable) {
                            this.convergeChart.update(
                                this.selectedSpectrum.process.density,
                                this.selectedSpectrum.process.fluxSum
                            );
                        }
                    }
                });
            }


            if (this.lacteaCache.done() && this.settings.areTasksCompleted() && this.settings.taskUpdate) {
                this.performanceViewer.endConvergence();
                this.convergeChart.done();
                this.settings.taskUpdate = false;

                console.log(`DONE. GPU cache sizes : [L1 - ${this.lacteaCache.starL1GpuCache.cache.size}], [L2 - ${this.lacteaCache.starL2GpuCache.cache.size}], [Node - ${this.lacteaCache.nodeGpuCache.cache.size}]`);

                this.settings.endTasks();
                // this.settings.updateCpuSpectrum();
            }
            // get gpu times
            if (this.canTimestamp) {
                if (this.starCompute.timingHelper.isGetResult()) {
                    this.starCompute.timingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("starCompute", gpuTime);
                    });
                }
                if (this.nodeCompute.timingHelper.isGetResult()) {
                    this.nodeCompute.timingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("nodeCompute", gpuTime);
                    });
                }
                if (this.renderPipeline.ldrTimingHelper.isGetResult()) {
                    this.renderPipeline.ldrTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("ldr pass", gpuTime);
                    });
                }
                if (this.renderPipeline.hdrTimingHelper.isGetResult()) {
                    this.renderPipeline.hdrTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("hdr pass", gpuTime);
                    });
                }
                if (this.renderPipeline.gaussianSmoothingTimingHelper.isGetResult()) {
                    this.renderPipeline.gaussianSmoothingTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("gaussian pass", gpuTime);
                    });
                }
            
                if (this.renderPipeline.reduceTimingHelper.isGetResult()) {
                    this.renderPipeline.reduceTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("min/max reduce", gpuTime);
                    });
                }
                if (this.renderPipeline.imageHistTimingHelper.isGetResult()) {
                    this.renderPipeline.imageHistTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("image hist", gpuTime);
                    });
                }
                if (this.renderPipeline.percentileTimingHelper.isGetResult()) {
                    this.renderPipeline.percentileTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("percentile hist", gpuTime);
                    });
                }
                if (this.renderPipeline.nodeCountReduceTimingHelper.isGetResult()) {
                    this.renderPipeline.nodeCountReduceTimingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("node count reduce", gpuTime);
                    });
                }
                if (this.selectedSpectrum.timingHelper.isGetResult()) {
                    this.selectedSpectrum.timingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("selectedSpectrum", gpuTime);
                    });
                }
                if (this.timingHelper.isGetResult()) {
                    this.timingHelper.getResult().then(gpuTime => {
                        this.performanceViewer.addGpu("lacteaVisualizer", gpuTime);
                    });
                }
            }
        }
        if (this.settings.performance) {
            this.performanceViewer.end();
            this.settings.performance = false;
        }
        window.requestAnimationFrame(this.renderloop.bind(this));
    }

    computeSpectralImage() {

        const encoder = this.device.createCommandEncoder();

        // get data
        if (this.settings.update) {
            this.performanceViewer.startConvergence();
            // buffer update
            encoder.clearBuffer(this.spectralImageBuffer);
            encoder.clearBuffer(this.selectedSpectrumBuffer, (OUTPUT_DEPTH) * 4);
            let moveCameraStart = performance.now();
            this.lacteaCache.moveCamera(this.cam);
            const delta = performance.now() - moveCameraStart;
            this.performanceViewer.add("moveCamera", delta);

            this.minimapPipeline.clearBuffer();
            this.nodeLayoutPipeline.clearBuffer();
            this.secondScreenNodeLayoutPipeline.clearBuffer();
            // update progress bars
            this.convergeChart.reset();
            this.settings.update = false;
        }


        if (this.settings.cacheLoad) {
            this.settings.startTasks();
            let cacheloadStart = performance.now();
            let offsetSizeInfo = this.lacteaCache.cacheLoad(this.settings.mouseMoving);
            if (offsetSizeInfo[0] > 0 || offsetSizeInfo[2] > 0) {
                this.cameraUintView[16] = offsetSizeInfo[1];
                this.cameraUintView[17] = offsetSizeInfo[0];
                this.cameraUintView[18] = offsetSizeInfo[2];
                this.cameraUintView[19] = offsetSizeInfo[3];
                this.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraArray);
                this.progressBar.totalUpdate(this.lacteaCache.starsTotal, this.lacteaCache.nodesTotal);
                this.progressBar.currentUpdate(this.lacteaCache.loadedStars, this.lacteaCache.loadedNodes);

                this.settings.starTasks = Array(Math.ceil(offsetSizeInfo[1] / this.settings.starTaskSize) * this.settings.taskDepthStages).fill(0).map((x, i) => i);
                this.settings.currentStarTaskSize = Math.min(this.settings.starTaskSize, offsetSizeInfo[1]);
                this.settings.nodeTasks = Array(Math.ceil(offsetSizeInfo[2] / this.settings.nodeTaskSize)).fill(0).map((x, i) => i);
                this.settings.currentNodeTaskSize = Math.min(this.settings.nodeTaskSize, offsetSizeInfo[2]);

                this.progressBar.resetTask(this.settings.starTasks.length, this.settings.nodeTasks.length);
                // console.log("star tasks", offsetSizeInfo[1], offsetSizeInfo[1] / this.settings.starTaskSize, this.settings.starTasks, this.settings.currentStarTaskSize);
                // console.log("node tasks", offsetSizeInfo[2], offsetSizeInfo[2] / this.settings.nodeTaskSize, this.settings.nodeTasks, this.settings.currentNodeTaskSize)
            }

            // if (offsetSizeInfo[3] > 0) {
            this.minimapPipeline.renderToTexture(encoder, [this.uiBindGroup, this.nodeCompute.nodeBindGroup], offsetSizeInfo[3]);
            this.nodeLayoutPipeline.renderToTexture(encoder, [this.uiBindGroup, this.nodeCompute.nodeBindGroup], offsetSizeInfo[3]);
            this.secondScreenNodeLayoutPipeline.renderToTexture(encoder, [this.uiBindGroup, this.nodeCompute.nodeBindGroup], offsetSizeInfo[3]);
            // }
            const delta = performance.now() - cacheloadStart;
            this.performanceViewer.add("cacheLoad", delta);

            this.settings.cacheLoad = false;
        }

        if (this.settings.taskUpdate) {
            if (this.settings.starTasks.length > 0 || this.settings.nodeTasks.length > 0) {
                
                this.cameraUintView[27] = this.settings.taskDepthStages;

                // console.log("task update", this.settings.starTasks, this.settings.nodeTasks)
                if (this.settings.starTasks.length > 0) {
                    this.cameraUintView[23] = this.settings.starTasks.shift();
                    this.cameraUintView[24] = this.settings.currentStarTaskSize;
                    this.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraArray);
                    // console.log("star task", this.cameraUintView[23], this.cameraUintView[24], this.cameraUintView[27], this.settings.starTasks, this.settings.currentTaskSize)

                    this.starCompute.compute(encoder,
                        this.settings.currentStarTaskSize,
                        this.settings.taskDepthStages,
                        [this.uiBindGroup]);
                }

                if (this.settings.nodeTasks.length > 0) {
                    // console.log("node task", this.settings.nodeTasks)
                    this.cameraUintView[25] = this.settings.nodeTasks.shift();
                    this.cameraUintView[26] = this.settings.currentNodeTaskSize;
                    this.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraArray);
                    // console.log("node task", this.cameraUintView[25], this.cameraUintView[26], this.cameraUintView[27], this.settings.nodeTasks, this.settings.nodeTaskSize)

                    this.nodeCompute.render(encoder,
                        this.settings.currentNodeTaskSize,
                        [this.uiBindGroup]);
                }
                this.progressBar.updateTask(this.settings.starTasks.length, this.settings.nodeTasks.length);
                // encoder.clearBuffer(this.selectedSpectrumBuffer, (OUTPUT_DEPTH) * 4);
                // this.renderPipeline.reduceNodeCount(
                //     encoder,
                //     [this.uiBindGroup]
                // );
            }
            if (this.settings.areTasksCompleted()) {
                this.settings.cacheLoad = !this.lacteaCache.done();
                this.settings.updateSpectrum();

                // console.log("reset cache load")
            }
            // console.log("task", this.settings.taskUpdate, this.settings.starTasks, this.lacteaCache.done(), this.settings.areTasksCompleted());
        }

        this.device.queue.submit([encoder.finish()]);
    }

    render() {
        window.requestAnimationFrame(this.renderloop.bind(this));
    }
}