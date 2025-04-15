export class NarrowBandViewer {
    constructor({
        data = [],
        containerId = "#container",
        binSize = 512,

    }) {
        this.data = data;
        
        this.rChannel = new Float32Array(binSize).fill(0);
        this.gChannel = new Float32Array(binSize).fill(0);
        this.bChannel = new Float32Array(binSize).fill(0);
        this.aChannel = new Float32Array(binSize).fill(0);

        this.binSize = binSize;
        this.chart = d3.select(containerId);
        const container = this.chart.append("div").attr("class", "signature");

        this.textarea = container
            .append('textarea')
            .attr("class", "signatures")
            .node();

        this.textarea.addEventListener("keypress", (event) => {
            if (event.keyCode == 13) {
                this.textarea.value.trim().split("\n").splice(2).forEach(row => {
                    let data = row.split(",")
                    let temp = {
                        name: "",
                        color: [1, 0, 0],
                        isEmission: false,
                        indicies: [],
                        labels: []
                    }
                    let name = data.splice(0, 1);
                    if (name.length === 1) {
                        temp.name = name;
                    }
                    let isEmission = data.splice(0, 1);
                    if (isEmission.length === 1) {
                        temp.isEmission = isEmission[0].trim() == "true" ? true : false;
                    }
                    let colors = data.splice(0, 3).map(x => parseFloat(x)).filter(x => !isNaN(x));
                    if (colors.length === 3) {
                        temp.color = colors
                    }
                    data.forEach(pairs => {
                        let x = pairs;
                        let label = "";
                        if (pairs.includes("-")) {
                            pairs = pairs.split("-");
                            x = pairs.splice(0, 1);
                            label = pairs[0];
                        }
                        temp.labels.push(label);

                        let wl = WlToIdx(parseFloat(x));
                        if (!isNaN(wl)) {
                            temp.indicies.push(wl);
                        }

                    });
                    tempSignatures.push(temp);
                });
                this.signatures = tempSignatures;
                this.isUpdated = true;
                this.updateData();
            }

        }, false);
        updateData();
        this.isUpdated = true;
    }



    updateData() {

        let text = `Press <Enter> to update the values\nChannel, wavelength, width\n`;
        this.signatures.forEach(signature => {
            let wl_label = signature.indicies.map((idx, i) => `${this.IdxToWl(idx)}${signature.labels[i] == "" ? "" : "-" + signature.labels[i]}`);
            text += `${signature.name}, ${signature.isEmission}, ${signature.color}, ${wl_label}\n`;
        })

        this.textarea.value = text;
    }
}