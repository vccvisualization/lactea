import { LightSpectrum } from "../lactea/LightSpectrum.js";
import { SignatureViewer } from "../ui/SignatureViewer.js";

export class ViewerSignature {
    constructor(device, gui, mainSettings) {
        this.device = device;

        this.filter = false;

        let formatWl = wl => {
            return Math.round(wl, 2);
        }

        this.signature = new SignatureViewer({
            containerId: "#signature",
            gui: gui,
            binSize: LightSpectrum.NUM_BINS_BASE,
            WlToIdx: LightSpectrum.mapWavelengthToIdx,
            IdxToWl: idx => LightSpectrum.mapIdxToWavelength(idx)[0],
            tooltipText: (idx) => {
                let [wl_min, wl_max] = LightSpectrum.mapIdxToWavelength(idx);
                return `Bin: ${idx}<br>Wavelength: [${formatWl(wl_min)}, ${formatWl(wl_max)}]`;
            }

        });

        this.signature.gui.add(this, "filter")
            .onChange(value => {
                mainSettings.reloadEverything();
            })
            .listen();
        this.signature.updateData();
    }

    load(settings) {
        this.filter = settings?.filter ?? false;
        this.signature.signatures = settings?.signatures ?? [];
        this.signature.isUpdated = true;
        this.signature.updateData();
    }

    store() {
        return {
            signatures: this.signature.signatures,
            filter: this.filter,
        };
    }

    async setup() {
        // uniforms, samples, buffers
        this.signatureBindGroupLayout = this.device.createBindGroupLayout({
            label: "signatureBindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } // signatures
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } // offsets and lengths
                },
            ]
        });

        this.signatureArrayBuffer = this.device.createBuffer({
            label: "signatureArrayBuffer",
            size: Math.max(this.signature.array.length * 4, 32),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.signatureOffsetLengthBuffer = this.device.createBuffer({
            label: "signatureOffsetLengthBuffer",
            size: Math.max(this.signature.offsetsLengths.length * 4, 32),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });


        this.signatureBindGroup = this.device.createBindGroup({
            label: "signatureBindGroup",
            layout: this.signatureBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.signatureArrayBuffer } },
                { binding: 1, resource: { buffer: this.signatureOffsetLengthBuffer } },
            ],
        });

    }

    getLength() {
        return this.signature.offsetsLengths.length / 2;
    }


    update(settings, updateSpectrum) {

        if (this.signature.isUpdated) {
            updateSpectrum(this.signature.signatures, this.signature.errorRange);
            settings.updateUser();
            if (this.filter === true) {
                settings.reloadEverything();
            }

            // if (this.signature.signatures.length > 0) {
            if (this.signatureArrayBuffer) { this.signatureArrayBuffer.destroy(); }
            this.signatureArrayBuffer = this.device.createBuffer({
                label: "signatureArrayBuffer",
                size: Math.max(this.signature.array.length * 4, 32),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            this.device.queue.writeBuffer(this.signatureArrayBuffer, 0, this.signature.array);

            if (this.signatureOffsetLengthBuffer) { this.signatureOffsetLengthBuffer.destroy(); }
            this.signatureOffsetLengthBuffer = this.device.createBuffer({
                label: "signatureOffsetLengthBuffer",
                size: Math.max(this.signature.offsetsLengths.length * 4, 32),
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            this.device.queue.writeBuffer(this.signatureOffsetLengthBuffer, 0, this.signature.offsetsLengths);

            this.signatureBindGroup = this.device.createBindGroup({
                label: "signatureBindGroup",
                layout: this.signatureBindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: this.signatureArrayBuffer } },
                    { binding: 1, resource: { buffer: this.signatureOffsetLengthBuffer } },
                ],
            });
            // }
            this.signature.isUpdated = false;
        }
    }
}