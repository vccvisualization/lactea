export class SignatureViewer {
    constructor({
        gui = new lil.GUI(),
        signatures = [],
        margin = {
            outer: 40,
            inner: 50,
            right: 40,
            left: 80
        },
        containerId = "#container",
        binSize = 512,
        width = 512,
        WlToIdx = (wl) => (wl),
        IdxToWl = (idx) => (idx),
        tooltipText = (idx) => `bin ${idx}`,
        pointsHeight = 50,
        rectWidth = 10
    }) {
        this.signatures = signatures;
        this.array = [];
        this.offsetsLengths = [];
        this.errorRange = 1;
        this.rectWidth = rectWidth;
        this.isUpdated = true;
        this.WlToIdx = WlToIdx;
        this.IdxToWl = IdxToWl;

        // set the dimensions and margins of the graph
        this.margin = margin;
        this.binSize = binSize;
        this.ogWidth = width;
        this.width = width + this.margin.left + this.margin.right;
        this.pointsHeight = pointsHeight;
        this.interval = this.ogWidth / this.binSize;
        this.getX = (idx) => this.margin.left + idx * this.interval;
        this.getIdx = (x) => Math.round(this.binSize * (x - this.margin.left) / this.ogWidth);

        this.getY = (i) => this.margin.outer + i * (this.pointsHeight + this.margin.inner);
        this.getYText = (i) => 10 + this.margin.outer + (this.pointsHeight) * (i + 1) + this.margin.inner * i;
        this.chart = d3.select(containerId);
        const container = this.chart.append("div").attr("class", "signature");

        this.svg = container
            .append('svg')
            .attr("width", this.width)
            .attr("height", this.pointsHeight)
            .style('display', 'block');

        this.lines = this.svg
            .append('g');

        this.textarea = container
            .append('textarea')
            .attr("class", "signatures")
            .node();

        this.textarea.addEventListener("keypress", (event) => {
            if (event.keyCode == 13) {
                let tempSignatures = [];
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

        // create a tooltip
        this.tooltip = d3.select(containerId)
            .append("div")
            .style("position", "absolute")
            .style("opacity", 0)
            .attr("class", "tooltip");
        this.tooltipText = tooltipText;

        this.settings = {
            color: [1, 0, 0],
            newSignature: [],
            predefined: { // source: https://portia.astrophysik.uni-kiel.de/~koeppen/discharge/
                // const l = (s) => {let f = []; s.split("\n").forEach(x => f.push(parseInt(x.split(/(\s+)/)[0]) / 10)); return f}
                "Empty": [],
                "Hydrogen": [397, 410.1, 434, 486.1, 656.2, 656.2],
                "Hydrogen alpha": [656.2],
                "Hydrogen absorption": [397, 410.1, 434, 486.1],
                "Helium": [396.4, 400.9, 402.6, 402.6, 412, 412, 414.3, 438.7, 443.7, 447.1, 447.1, 468.5, 468.5, 471.3, 471.3, 492.1, 501.5, 504.7, 541.1, 587.5, 587.5, 656, 667.8, 686.7, 706.5, 706.5],
                "Carbon": [391.8, 392, 407.4, 407.5, 426.7, 426.7, 477.1, 493.2, 505.2, 513.2, 513.3, 514.3, 514.5, 515.1, 538, 564.8, 566.2, 588.9, 589.1, 600.1, 600.6, 600.7, 601, 601.3, 601.4, 657.8, 658.2, 658.7, 678.3, 711.3, 711.5, 711.5, 711.6, 711.9],
                "Nitrogen": [391.9, 395.5, 399.5, 403.5, 404.1, 404.3, 409.9, 410.9, 417.6, 422.7, 423.6, 423.7, 424.1, 443.2, 444.7, 453, 460.1, 460.7, 461.3, 462.1, 463, 464.3, 478.8, 480.3, 484.7, 489.5, 491.4, 493.5, 495, 496.3, 498.7, 499.4, 500.1, 500.2, 500.5, 500.7, 501, 501.6, 502.5, 504.5, 528.1, 529.2, 549.5, 553.5, 566.6, 567.6, 567.9, 568.6, 571, 574.7, 575.2, 576.4, 582.9, 585.4, 592.7, 593.1, 594, 594.1, 595.2, 599.9, 600.8, 616.7, 637.9, 641.1, 642, 642.3, 642.8, 643.7, 644, 645.7, 646.8, 648.2, 648.2, 648.3, 648.1, 648.4, 649.1, 649.9, 650.6, 661, 662.2, 663.6, 664.4, 664.6, 665.3, 665.6, 672.2],
                "Oxygen": [391.1, 391.9, 394.7, 394.7, 394.7, 395.4, 395.4, 397.3, 398.2, 406.9, 407.2, 407.5, 408.3, 408.7, 408.9, 409.7, 410.5, 411.9, 413.2, 414.6, 415.3, 418.5, 418.9, 423.3, 425.3, 425.3, 427.5, 430.3, 431.7, 433.6, 434.5, 434.9, 436.6, 436.8, 439.5, 441.4, 441.6, 444.8, 445.2, 446.5, 446.6, 446.7, 446.9, 459, 459.6, 460.9, 463.8, 464.1, 464.9, 465, 466.1, 467.6, 469.9, 470.5, 492.4, 494.3, 532.9, 532.9, 533, 543.5, 543.5, 543.6, 557.7, 595.8, 595.8, 599.5, 604.6, 604.6, 604.6, 610.6, 615.5, 615.6, 615.8, 625.6, 626.1, 636.6, 637.4, 645.3, 645.4, 645.5, 660.4, 665.3, 700.1, 700.2, 715.6],
            }
        }
        this.selectedIndex = -1;
        this.gui = gui.addFolder('Signature Filter');
        this.gui.addColor(this.settings, 'color')
            .onChange(value => {
                if (this.selectedIndex > -1) {
                    this.signatures[this.selectedIndex].color = value;
                    this.isUpdated = true;
                    this.updateData();
                }
            })
            .listen();
        this.gui.add(this.settings, "newSignature", Object.keys(this.settings.predefined))
            .onChange((value) => {
                this.addSignature(value, true);
                this.isUpdated = true;
                this.updateData();
            });
        this.gui.add(this, "errorRange", 0, this.binSize, 1).onChange((value) => {
            this.isUpdated = true;
            this.updateData();
        });

        // this.addSignature("Hydrogen absorption", false);
        this.addSignature("Hydrogen alpha", true);

        this.isUpdated = true;
        this.updateData();
        this.resize(container);
    }

    addSignature(name, isEmission) {
        let random = Math.floor(Math.random() * 10);
        let c = d3.color(d3[`schemeTableau10`][random]);
        
        let group = {
            name: name,
            isEmission: isEmission,
            color: [(c.r / 255).toFixed(2), (c.g / 255).toFixed(2), (c.b / 255).toFixed(2)],
            indicies: [...new Set(this.settings.predefined[name].map(wl => this.WlToIdx(wl)))],
        };
        group.labels = Array(group.indicies.length).fill("");
        this.signatures.push(group);
    }

    resize(container) {
        const resizeObserver = new ResizeObserver((entries) => {
            let entry = entries[0];
            let width = 0;
            width = entry.borderBoxSize[0].inlineSize;
            this.ogWidth = width - this.margin.left - this.margin.right;
            this.updateData();
        });

        resizeObserver.observe(container.node());
    }


    updateData() {
        // update width & height
        this.width = this.ogWidth + this.margin.left + this.margin.right;
        this.interval = this.ogWidth / this.binSize;
        this.svg
            .attr("width", this.width)
            .attr("height", (this.pointsHeight + this.margin.inner) * (this.signatures.length) + 2 * this.margin.outer);

        this.interval = this.ogWidth / this.binSize;

        // update arrays
        this.array = [];
        this.offsetsLengths = [];
        // console.log(this.signatures);


        this.signatures.forEach(signature => {
            this.offsetsLengths.push(this.array.length); // offset
            this.offsetsLengths.push(signature.indicies.length); // length
            // this.array.push(...signature.color);
            this.array.push(signature.isEmission);
            this.array.push(...signature.indicies);
        });
        // console.log(this.array, this.lengths, this.offsets);

        this.array = new Float32Array(this.array);
        this.offsetsLengths = new Uint32Array(this.offsetsLengths);
        // console.log(this.array);
        // console.log(this.lengths);
        // console.log(this.offsets);

        // draw
        this.lines
            .selectAll(".background")
            .data(this.signatures.map((d, i) => {
                return { ...d, i: i }
            }))
            .join(
                enter => enter
                    .append("rect")
                    .attr("class", "background")
                    .attr("y", (d, i) => this.getY(i))
                    .attr("x", this.margin.left)
                    .attr("height", this.pointsHeight)
                    .attr("width", this.ogWidth)
                    .attr("fill", "#000000")
                    .on('dblclick', event => { this.addNew(event) })
                    .on("contextmenu", (event, d) => { this.rightClickName(event, d) })
                    .on("click", (event, d) => { this.clicked(event, d) })

                ,
                update => update
                    .attr("y", (d, i) => this.getY(i))
                    .attr("x", this.margin.left)
                    .attr("height", this.pointsHeight)
                    .attr("width", this.ogWidth)
                ,
                exit => exit
                    .remove()
            );

        const groups = this.lines
            .selectAll("g")
            .data(this.signatures)
            .join(
                enter => enter
                    .append("g"),
                update => update,
                exit => exit
                    .remove()
            );


        groups
            .selectAll("rect")
            .data((d, i) => d.indicies.map((idx, j) => { return { idx: idx, color: d.color, i: i, j: j } }))
            .join(
                enter => enter
                    .append("rect")
                    .attr("height", this.pointsHeight)
                    .attr("width", this.rectWidth)
                    .attr("class", "circle")
                    .attr("y", d => this.getY(d.i))
                    .attr("x", d => this.getX(d.idx))
                    .attr("fill", d => `rgba(${d.color[0] * 256}, ${d.color[1] * 256}, ${d.color[2] * 256})`)
                    .call(d3.drag()
                        .on('start', this.dragStart)
                        .on('drag', (event, d) => { this.dragging(event, d) })
                        .on('end', this.dragEnd)
                    )
                    .on("contextmenu", (event, d) => { this.rightClick(event, d) })
                    .on("mouseover", (event) => { this.mouseover() })
                    .on("mousemove", (event, d) => { this.mousemove(event, d) })
                    .on("mouseleave", (event) => { this.mouseleave() })
                    .on("click", (event, d) => { this.clicked(event, d) })
                ,
                update => update
                    .attr("x", d => this.getX(d.idx))
                    .attr("fill", d => `rgba(${d.color[0] * 256}, ${d.color[1] * 256}, ${d.color[2] * 256})`),
                exit => exit
                    .remove()
            );


        this.lines
            .selectAll("foreignObject")
            .data(this.signatures.map((d, i) => {
                return { ...d, i: i };
            }))
            .join(
                enter =>
                enter
                    .append("foreignObject")
                    .attr("x", d => this.width / 2 - d.name.length / 2)
                    .attr("y", (d, i) => this.getYText(i))
                    .attr("width", "10rem")
                    .attr("height", "2rem")
                    .append('xhtml:span')
                    .on("keyup", (event, d) => this.changeLabel(event, d))
                    .attr("contentEditable", true)
                    .text(d => d.name)
                ,
                update => update
                .attr("x", d => this.width / 2 - d.name.length / 2)
                .attr("y", (d, i) => this.getYText(i))
                ,
                exit => exit
                    .remove()
            );

        let text = `Press <Enter> to update the values\nname, isEmission, r, g, b, wavelength\n`;
        this.signatures.forEach(signature => {
            let wl_label = signature.indicies.map((idx, i) => `${this.IdxToWl(idx)}${signature.labels[i] == "" ? "" : "-" + signature.labels[i]}`);
            text += `${signature.name}, ${signature.isEmission}, ${signature.color}, ${wl_label}\n`;
        })

        this.textarea.value = text;
    }


    clicked(event, d) {
        if (event.defaultPrevented) return; // dragged 
        this.settings.color = d.color;
        this.selectedIndex = d.i;
        this.isUpdated = true;
        this.updateData();
    }

    addNew(event) {
        if (event.defaultPrevented) return; // dragged
        let i = Math.floor(event.offsetY / (this.pointsHeight + this.margin.outer));
        let dx = this.getIdx(event.offsetX);
        this.signatures[i].indicies.push(dx);
        this.isUpdated = true;
        this.updateData();
    }

    rightClick(event, d) {
        event.preventDefault();
        this.signatures[d.i].indicies.splice(d.j, 1);
        this.isUpdated = true;
        this.updateData();
    }

    changeLabel(event, d) {
        this.signatures[d.i].name = event.srcElement.innerText.replace(/\s+/g, ' ').trim();
        this.isUpdated = true;
        this.updateData();
    }
    rightClickName(event, d) {
        event.preventDefault();
        this.signatures.splice(d.i, 1);
        this.isUpdated = true;
        this.updateData();
    }

    dragStart() {
        d3.select(this).attr("class", "circle-focus");
    }

    dragging(event, d) {
        let dx = this.getIdx(event.x);
        this.signatures[d.i].indicies[d.j] = Math.max(0, Math.min(this.binSize, dx));
        this.mousemove(event, { ...d, idx: this.signatures[d.i].indicies[d.j] });
        this.isUpdated = true;
        this.updateData();
    }

    dragEnd() {
        d3.select(this).attr("class", "circle");
    }

    mouseover() {
        this.tooltip
            .style("opacity", 1)
    }
    mousemove(event, d) {
        this.tooltip
            .html(this.tooltipText(d.idx))
            .style("left", (event.x) + "px")
            .style("top", (event.pageY + 10) + "px")
    }
    mouseleave() {
        this.tooltip
            .style("opacity", 0)
    }
}