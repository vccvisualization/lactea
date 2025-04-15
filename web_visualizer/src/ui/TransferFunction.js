export class TransferFunction {
    constructor({
        gui = new lil.GUI(),
        colorMap = 'viridis',
        margin = {
            top: 40,
            bottom: 40,
            right: 10,
            left: 80
        },
        containerId = "#container",
        binSize = 512,
        width = 512,
        tooltipText = (idx) => `bin ${idx}`,
        canvasHeight = 10,
        pointsHeight = 50,
        circleRadius = 10 }
    ) {
        this.colorMap = [];
        this.circleRadius = circleRadius;
        this.colorMapArray = new Uint8Array(binSize * 4).fill(0);
        this.isUpdated = true;

        // set the dimensions and margins of the graph
        this.margin = margin;
        this.binSize = binSize;
        this.ogWidth = width;
        this.width = width + this.margin.left + this.margin.right;
        this.pointsHeight = circleRadius * 2.2; // - this.margin.top - this.margin.bottom;
        this.canvasHeight = canvasHeight; // - this.margin.top - this.margin.bottom;

        this.interval = this.ogWidth / this.binSize;
        this.getX = (idx) => this.margin.left + (idx + 0.5) * this.interval;
        this.getIdx = (x) => Math.round(this.binSize / this.ogWidth * (x - this.margin.left) - 0.5);
        this.getXCanvas = (idx) => this.margin.left + idx * this.interval;

        this.chart = d3.select(containerId);
        const container = this.chart.append("div").attr("class", "colormap");

        this.canvas = container
            .append('canvas')
            .attr('width', this.width)
            .attr('height', canvasHeight)
            .style('display', 'block');
        this.context = this.canvas.node()
            .getContext('2d');
        this.canvas.style.imageRendering = "pixelated";


        this.svg = container
            .append('svg')
            .attr("width", this.width)
            .attr("height", this.pointsHeight)
            .style('display', 'block')
            .on('dblclick', event => { this.addNew(event, colorMap, this.updateData.bind(this)) });


        this.circles = this.svg
            .append('g');


        // create a tooltip
        this.tooltip = container
            .append("div")
            .style("position", "absolute")
            .style("opacity", 0)
            .attr("class", "tooltip");
        this.tooltipText = tooltipText;

        this.colorMapSettings = {
            color: "#ffffff",
            selectedColormap: '',
            predefined: {
                'viridis': [[0.0, '#440154'], [0.1, '#482475'], [0.2, '#414487'], [0.3, '#355f8d'], [0.4, '#2a788e'], [0.5, '#21918c'], [0.6, '#22a884'], [0.7, '#44bf70'], [0.8, '#7ad151'], [0.9, '#bddf26'], [1.0, '#fde725']], 'hot': [[0.0, '#0b0000'], [0.1, '#4e0000'], [0.2, '#900000'], [0.3, '#d30000'], [0.4, '#ff1700'], [0.5, '#ff5a00'], [0.6, '#ff9d00'], [0.7, '#ffe000'], [0.8, '#ffff36'], [0.9, '#ffff9b'], [1.0, '#ffffff']], 'afmhot': [[0.0, '#000000'], [0.1, '#330000'], [0.2, '#660000'], [0.3, '#991a00'], [0.4, '#cc4d00'], [0.5, '#ff8000'], [0.6, '#ffb333'], [0.7, '#ffe666'], [0.8, '#ffff99'], [0.9, '#ffffcc'], [1.0, '#ffffff']], 'plasma': [[0.0, '#0d0887'], [0.1, '#41049d'], [0.2, '#6a00a8'], [0.3, '#8f0da4'], [0.4, '#b12a90'], [0.5, '#cc4778'], [0.6, '#e16462'], [0.7, '#f2844b'], [0.8, '#fca636'], [0.9, '#fcce25'], [1.0, '#f0f921']], 'inferno': [[0.0, '#000004'], [0.1, '#160b39'], [0.2, '#420a68'], [0.3, '#6a176e'], [0.4, '#932667'], [0.5, '#bc3754'], [0.6, '#dd513a'], [0.7, '#f37819'], [0.8, '#fca50a'], [0.9, '#f6d746'], [1.0, '#fcffa4']], 'magma': [[0.0, '#000004'], [0.1, '#140e36'], [0.2, '#3b0f70'], [0.3, '#641a80'], [0.4, '#8c2981'], [0.5, '#b73779'], [0.6, '#de4968'], [0.7, '#f7705c'], [0.8, '#fe9f6d'], [0.9, '#fecf92'], [1.0, '#fcfdbf']], 'cividis': [[0.0, '#00224e'], [0.1, '#083370'], [0.2, '#35456c'], [0.3, '#4f576c'], [0.4, '#666970'], [0.5, '#7d7c78'], [0.6, '#948e77'], [0.7, '#aea371'], [0.8, '#c8b866'], [0.9, '#e5cf52'], [1.0, '#fee838']], 'Accent_r': [[0.0, '#666666'], [0.1, '#666666'], [0.2, '#bf5b17'], [0.3, '#f0027f'], [0.4, '#386cb0'], [0.5, '#ffff99'], [0.6, '#ffff99'], [0.7, '#fdc086'], [0.8, '#beaed4'], [0.9, '#7fc97f'], [1.0, '#7fc97f']], 'Pastel1_r': [[0.0, '#f2f2f2'], [0.1, '#f2f2f2'], [0.2, '#fddaec'], [0.3, '#e5d8bd'], [0.4, '#ffffcc'], [0.5, '#fed9a6'], [0.6, '#decbe4'], [0.7, '#ccebc5'], [0.8, '#b3cde3'], [0.9, '#fbb4ae'], [1.0, '#fbb4ae']], 'Pastel2_r': [[0.0, '#cccccc'], [0.1, '#cccccc'], [0.2, '#f1e2cc'], [0.3, '#fff2ae'], [0.4, '#e6f5c9'], [0.5, '#f4cae4'], [0.6, '#f4cae4'], [0.7, '#cbd5e8'], [0.8, '#fdcdac'], [0.9, '#b3e2cd'], [1.0, '#b3e2cd']], 'Set3_r': [[0.0, '#ffed6f'], [0.1, '#ccebc5'], [0.2, '#bc80bd'], [0.3, '#d9d9d9'], [0.4, '#fccde5'], [0.5, '#fdb462'], [0.6, '#80b1d3'], [0.7, '#fb8072'], [0.8, '#bebada'], [0.9, '#ffffb3'], [1.0, '#8dd3c7']], 'rainbow_r': [[0.0, '#ff0000'], [0.1, '#ff4f28'], [0.2, '#ff964f'], [0.3, '#e5ce74'], [0.4, '#b2f396'], [0.5, '#80ffb4'], [0.6, '#4cf3ce'], [0.7, '#19cee3'], [0.8, '#1a96f3'], [0.9, '#4d4ffc'], [1.0, '#8000ff']], 'gist_rainbow_r': [[0.0, '#ff00bf'], [0.1, '#b400ff'], [0.2, '#2a00ff'], [0.3, '#0061ff'], [0.4, '#00ecff'], [0.5, '#00ff89'], [0.6, '#00ff00'], [0.7, '#8aff00'], [0.8, '#ffea00'], [0.9, '#ff6000'], [1.0, '#ff0029']], 'terrain_r': [[0.0, '#ffffff'], [0.1, '#ccbebb'], [0.2, '#997c76'], [0.3, '#997c62'], [0.4, '#ccbe7d'], [0.5, '#ffff99'], [0.6, '#99eb85'], [0.7, '#33d670'], [0.8, '#00b2b2'], [0.9, '#1177dd'], [1.0, '#333399']], 'brg_r': [[0.0, '#00ff00'], [0.1, '#33cc00'], [0.2, '#669900'], [0.3, '#996600'], [0.4, '#cc3300'], [0.5, '#ff0000'], [0.6, '#cc0033'], [0.7, '#990066'], [0.8, '#660099'], [0.9, '#3300cc'], [1.0, '#0000ff']], 'cool_r': [[0.0, '#ff00ff'], [0.1, '#e61aff'], [0.2, '#cc33ff'], [0.3, '#b24dff'], [0.4, '#9966ff'], [0.5, '#8080ff'], [0.6, '#6699ff'], [0.7, '#4cb3ff'], [0.8, '#33ccff'], [0.9, '#19e6ff'], [1.0, '#00ffff']], 'gnuplot_r': [[0.0, '#ffff00'], [0.1, '#f2ba00'], [0.2, '#e48300'], [0.3, '#d55700'], [0.4, '#c63700'], [0.5, '#b42000'], [0.6, '#a11096'], [0.7, '#8c07f3'], [0.8, '#7202f3'], [0.9, '#510096'], [1.0, '#000000']],
                "Empty": [],

            }
        }
        this.setcolormap(colorMap);
        this.selectedIndex = -1;
        this.gui = gui.addFolder('Color mapping');
        this.gui.addColor(this.colorMapSettings, 'color')
            .onChange(value => {
                if (this.selectedIndex > -1) {
                    this.colorMap[this.selectedIndex][1] = value;
                    this.isUpdated = true;
                    this.updateData();
                }
            })
            .listen();

        this.gui.add(this.colorMapSettings, "selectedColormap", Object.keys(this.colorMapSettings.predefined))
            .onChange((value) => {
                this.setcolormap(value);
                this.isUpdated = true;
                this.updateData();
            });

        this.resize(container);
    }

    setcolormap(value) {
        let cmap = this.colorMapSettings.predefined[value] || this.colorMapSettings.predefined["viridis"];
        if (this.binSize < cmap.length) {
            this.colorMap = [];
            for (let i = 0; i < this.binSize; i++) {
                let index = Math.round(i * (cmap.length - 1) / (this.binSize - 1));
                let el = [...cmap[index]];

                this.colorMap.push([i, el[1]]);
            }
        } else {
            this.colorMap = cmap.map(el => {
                let pos = Math.floor((this.binSize - 1) * (el[0]));
                return [pos, el[1]];
            });
        }
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
        // update width
        this.width = this.ogWidth + this.margin.left + this.margin.right;
        this.interval = this.ogWidth / this.binSize;
        this.svg
            .attr("width", this.width);
        this.canvas
            .attr("width", this.width);

        this.colorMapArray.fill(0);
        this.colorMap = this.colorMap.sort((a, b) => a[0] - b[0]);
        // this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.colorMap.length - 1; ++i) {
            const color = t => d3.interpolate(this.colorMap[i], this.colorMap[i + 1])(t);
            const denominator = (this.colorMap[i + 1][0] - this.colorMap[i][0]);
            for (let j = this.colorMap[i][0]; j <= this.colorMap[i + 1][0]; j++) {
                const c = d3.color(color((j - this.colorMap[i][0]) / (denominator))[1]);
                this.colorMapArray[j * 4 + 0] = c.r;
                this.colorMapArray[j * 4 + 1] = c.g;
                this.colorMapArray[j * 4 + 2] = c.b;
                this.colorMapArray[j * 4 + 3] = 1;
            }
        }

        for (let i = 0; i < this.binSize; ++i) {
            this.context.fillStyle = `rgb(${this.colorMapArray[i * 4 + 0]}, ${this.colorMapArray[i * 4 + 1]}, ${this.colorMapArray[i * 4 + 2]})`;
            this.context.fillRect(this.getXCanvas(i), 0, Math.ceil(this.interval), this.canvasHeight);

        }

        this.circles
            .selectAll("circle")
            .data(this.colorMap)
            .join(
                enter => enter
                    .append("circle")
                    .attr("r", this.circleRadius)
                    .attr("class", "circle")
                    .attr("cy", this.pointsHeight / 2)
                    .attr("cx", d => this.getX(d[0]))
                    .attr("fill", d => d[1])
                    .call(d3.drag()
                        .on('start', this.dragStart)
                        .on('drag', (event, d) => { this.dragging(event, d) })
                        .on('end', this.dragEnd)
                    )
                    .on("click", (event, d) => { this.clicked(event, d) })
                    .on("contextmenu", (event, d) => { this.rightClick(event, d) })
                    .on("mouseover", (event) => { this.mouseover() })
                    .on("mousemove", (event, d) => { this.mousemove(event, d) })
                    .on("mouseleave", (event) => { this.mouseleave() })
                ,
                update => update
                    .attr("cx", d => this.getX(d[0]))
                    .attr("fill", d => d[1]),
                exit => exit
                    .remove()
            );
    }

    clicked(event, d) {
        if (event.defaultPrevented) return; // dragged   
        let index = this.colorMap.indexOf(d);
        if (index > -1) {
            this.colorMapSettings.color = d[1];
            this.selectedIndex = index;
            this.isUpdated = true;
        }
    }

    addNew(event) {
        this.mouseleave();
        if (event.defaultPrevented) return; // dragged   
        // console.log(colorMap, event);
        let dx = this.getIdx(event.offsetX);// + (-1) ** (event.x > this.getIdx(d[0])) * this.margin.left;
        if (dx >= 0 && dx < this.binSize) {
            this.colorMap.push([dx, "#000000"]);
            this.isUpdated = true;

            // console.log(colorMap);
            this.updateData();
        }
    }

    rightClick(event, d) {
        event.preventDefault();
        let index = this.colorMap.indexOf(d);
        if (index > -1) {
            this.colorMap.splice(index, 1);
            this.isUpdated = true;
            this.updateData();
            this.mousemove(event, d);
        }
    }


    dragStart() {
        d3.select(this).attr("class", "circle-focus");
    }

    dragging(event, d) {
        let dx = this.getIdx(event.x);// + (-1) ** (event.x > this.getIdx(d[0])) * this.margin.left;
        // console.log(d, event.x, dx);
        this.colorMap[this.colorMap.indexOf(d)][0] = Math.max(0, Math.min(this.binSize - 1, dx));
        this.mousemove(event, [Math.max(0, Math.min(this.binSize - 1, dx)), d[1]]);
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
            .html(this.tooltipText(d[0]))
            .style("left", (event.offsetX + 5) + "px")
            .style("top", (event.offsetY + 5) + "px")
    }
    mouseleave() {
        this.tooltip
            .style("opacity", 0)
    }
}