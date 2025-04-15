import { Pipeline } from "./utils/Pipeline.js";
import { LightSpectrum } from "../lactea/LightSpectrum.js";
import { SpectrumViewer } from "../ui/SpectrumViewer.js";
import { InfoViewer } from "../ui/InfoViewer.js";
import { TimingHelper } from "./utils/TimingHelper.js";
import { DEPTH, OUTPUT_DEPTH, DENSITY_MAX_OFFSET, processSpectra, getApproxTemp } from "./utils/utils.js";

export class SelectedSpectrum {
    constructor(device, gui, cam, screenToLoc) {
        this.device = device;
        this.cam = cam;
        
        this.screenToLoc = (coord = cam.cursorPos) => screenToLoc(coord, cam);

        let formatWl = wl => {
            return Math.round(wl, 2);
        }

        this.spectrumViewer = new SpectrumViewer({
            gui: gui,
            canvasId: "#spectrum",
            bins: LightSpectrum.NUM_BINS_BASE,
            indxToWl: idx => {
                let [wl_min, wl_max] = LightSpectrum.mapIdxToWavelength(idx);
                return formatWl(wl_min);
                // return `[${formatWl(wl_min)}, ${formatWl(wl_max)})`;
            },
            tooltipText: (idx, e) => {
                let [wl_min, wl_max] = LightSpectrum.mapIdxToWavelength(idx);
                return [`Bin: ${idx}`, `Wavelength: [${formatWl(wl_min)}, ${formatWl(wl_max)}]`, `Energy: ${e.toExponential(2)}`];
            }
        });

        this.infoViewer = new InfoViewer({
            containerId: "#info",
            title: "Selected Region Info",
        });

        // time pass
        this.timingHelper = new TimingHelper(this.device);
    }

    // updateSignature(x, errorRange) {
    //     this.spectrumViewer.updateSpectralLines(x, errorRange);
    // }
    async setup(includes = [], bindgroupsLayouts = [], format = "rgba8unorm", nodeCount=0) {
        this.bufferSize = OUTPUT_DEPTH + nodeCount;
        // uniforms, samples, buffers
        this.cpuSpectrumBuffer = this.device.createBuffer({
            label: "cpuSpectrumBuffer",
            size: this.bufferSize * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // pipelines
        this.drawSelectionPipleline = new Pipeline(this.device);
        await this.drawSelectionPipleline.createRenderPipeline('SelectedPointShader.wgsl', [includes[0]], 'vs', 'fs',
            [...bindgroupsLayouts],
            [{ format: format }],
            [],
            { primitive: { topology: 'line-list' } });
            
        this.singlePointSelectionPipeline = new Pipeline(this.device);
        await this.singlePointSelectionPipeline.createComputePipeline("AccumulateSinglePoint.wgsl", includes, "computeMain",
            [...bindgroupsLayouts]);

        this.regionSelectionPipeline = new Pipeline(this.device);
        await this.regionSelectionPipeline.createComputePipeline("AccumulateRegion.wgsl", includes, "computeMain",
            [...bindgroupsLayouts]);
    }

    reduceSelection(encoder, width, height, bindGroups = []) {
        let x1 = Math.floor(this.cam.cursorPos[0] * (width - 1));
        let x2 = Math.floor(this.cam.cursorPos2[0] * (width - 1));
        let y1 = Math.floor(this.cam.cursorPos[1] * (height - 1));
        let y2 = Math.floor(this.cam.cursorPos2[1] * (height - 1));

        const spectrumReducePass = this.timingHelper.beginComputePass(encoder, {});

        if (this.cam.areaSelector) {
            let l = Math.abs((x1 - x2)) + 1;
            let w = Math.abs((y1 - y2)) + 1;

            const workgroup_y = Math.ceil(l / 8);
            const workgroup_z = Math.ceil(w / 8);

            // this.accumulate4BytesPipeline.setBindGroups(spectrumReducePass, [...bindGroups, this.spectrumReduceGroup]);
            // spectrumReducePass.dispatchWorkgroups(1, workgroup_y, workgroup_z);

            // this.accumulate8BytesPipeline.setBindGroups(spectrumReducePass, [...bindGroups, this.spectrumReduceGroup]);
            // spectrumReducePass.dispatchWorkgroups(1, Math.ceil(l / 4), Math.ceil(l / 4));

            // this.accumulateSpectraPipeline.setBindGroups(spectrumReducePass, [...bindGroups, this.spectrumReduceGroup]);
            // spectrumReducePass.dispatchWorkgroups(Math.ceil(LightSpectrum.NUM_BINS_BASE / 4), workgroup_y, workgroup_z);

            this.regionSelectionPipeline.setBindGroups(spectrumReducePass, [...bindGroups]);
            spectrumReducePass.dispatchWorkgroups(Math.ceil(DEPTH / 4), workgroup_y, workgroup_z);
        } else {
            const workgroup = Math.ceil(DEPTH / 256);
            this.singlePointSelectionPipeline.setBindGroups(spectrumReducePass, [...bindGroups]);
            spectrumReducePass.dispatchWorkgroups(workgroup);
        }

        spectrumReducePass.end();
    }

    render(pass, bindGroups = []) {
        this.drawSelectionPipleline.setBindGroups(pass, [...bindGroups]);
        pass.draw(8);

    }

    updateNarrowband(width, isExtinction) {
        this.spectrumViewer.updateNarrowband(width, isExtinction);
    }

    async spectrumToCpu(selectedSpectrumBuffer) {
        if (this.cpuSpectrumBuffer.mapState === "unmapped") {
            // console.log("spectrumToCpu done");
            const gpu2cpuEncoder = this.device.createCommandEncoder();
            gpu2cpuEncoder.copyBufferToBuffer(
                selectedSpectrumBuffer, 0,
                this.cpuSpectrumBuffer, 0,
                this.cpuSpectrumBuffer.size,
            );
            this.device.queue.submit([gpu2cpuEncoder.finish()]);
            return this.cpuSpectrumBuffer
                .mapAsync(GPUMapMode.READ)
                .then(() => {
                    const copyArrayBuffer = this.cpuSpectrumBuffer.getMappedRange();
                    const data = new Uint32Array(copyArrayBuffer.slice(0));
                    this.cpuSpectrumBuffer.unmap();
                    this.process = processSpectra(data);
                    this.process.temp = 0;
                    this.process.approx_temp = 0;
                    if (!data.every(item => item === 0)) {
                        this.process.temp = this.process.tempSum / this.process.tempDensity;
                        this.process.approx_temp = getApproxTemp(this.process.bp, this.process.rp);
                        this.spectrumViewer.updateTemp(this.process.temp);
                        this.spectrumViewer.updateBpRpTemp(this.process.approx_temp);
                        this.spectrumViewer.updateData(this.process.flux, this.process.corrFlux);
                        // console.log(this.process.flux, this.process.corrFlux);
                        this.process.dataAvailable = true;
                    } else {
                        
                        this.spectrumViewer.reset();
                        this.process.dataAvailable = false;
                    }
                    this.spectrumViewer.draw();
                    // this.infoViewer.update("Sky Position (broken!!)", `${this.screenToLoc()}`)
                    let density = Math.round(this.process.density);
                    this.infoViewer.update("Star Count", `${density}`);
                    this.infoViewer.update("Max count per pixel", `${Math.round(this.process.densityMax)}`);
                    this.infoViewer.update("Stars with Temperature Count", `${Math.round(this.process.tempDensity)}`);
                    this.infoViewer.update("Star List node ID", `${density === 1 ? this.process.starListNodeId - 1 : NaN}`);
                    this.infoViewer.update("Patch node ID", `${density === 1 ? this.process.patchId - 1 : NaN}`);
                    this.infoViewer.update("Star ID", `${density === 1 ? this.process.id : NaN}`);

                    this.infoViewer.update("Sum RP", `${this.process.rp.toFixed(3)}`);
                    this.infoViewer.update("Sum G", `${this.process.g.toFixed(3)}`);
                    this.infoViewer.update("Sum BP", `${this.process.bp.toFixed(3)}`);
                    this.infoViewer.update("Sum Flux", `${this.process.fluxSum}`);
                    this.infoViewer.update("Sum Corrected Flux", `${this.process.correctedFluxSum}`);
                
                    this.infoViewer.update("Max R", `${this.process.maxR}`);
                    this.infoViewer.update("Max G", `${this.process.maxG}`);
                    this.infoViewer.update("Max B", `${this.process.maxB}`);
                    this.infoViewer.update("Max A", `${this.process.maxA}`);
                    this.infoViewer.update("Min R", `${this.process.minR}`);
                    this.infoViewer.update("Min G", `${this.process.minG}`);
                    this.infoViewer.update("Min B", `${this.process.minB}`);
                    this.infoViewer.update("Min A", `${this.process.minA}`);
                    
                    this.infoViewer.update("Average Temperature", `${this.process.temp.toFixed(3)}`);
                    this.infoViewer.update("BP-RP Temperature", `${this.process.approx_temp.toFixed(3)}`);
                    this.infoViewer.updateData();
                    return true;
                });
        }
        return false;
    }

    store() {
        return {...this.process, id: this.process.id.toString() };
    }
}