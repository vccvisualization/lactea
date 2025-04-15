export class SpectrumViewer {
    constructor({
        canvasId = "#bar-chart",
        gui = new lil.GUI(),
        bins = 200,
        indxToWl = (idx) => idx,
        wlToIndx = (wl) => wl,
        tooltipText = (idx, e) => `bin ${idx} energy ${e}`
    }) {
        this.size = {height: 0, width: 0};
        this.bins = bins;
        this.plank = (T, w) => {
            return 1.1910429723971884e-25 * Math.pow(w * 1e-9, -5.0) / (Math.exp(0.014387768775039337 / (1e-9 * w * T)) - 1.);
        }
        this.indxToWl = indxToWl;
        this.wlToindx = wlToIndx;
        this.tooltipText = tooltipText;
        const labels = Array(bins).fill(0).map((x, idx) => indxToWl(idx));
        this.element = document.querySelector(canvasId);
        this.chart = new Chart(this.element, {
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Flux',
                        type: 'bar',
                        order: 4,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Extinction-Corrected Flux',
                        type: 'bar',
                        order: 5,
                        yAxisID: 'y',
                    },
                    // {
                    //     label: 'Blackbody (temperature)',
                    //     type: 'line',
                    //     order: 9,
                    //     yAxisID: 'y2',
                    //     pointRadius: 0
                    // },
                    // {
                    //     label: 'Blackbody (BP-RP temperature)',
                    //     type: 'line',
                    //     order: 10,
                    //     yAxisID: 'y3',
                    //     pointRadius: 0
                    // },
                    {
                        label: 'Hα',
                        type: 'line',
                        order: 1,
                        yAxisID: 'y',
                        pointRadius: 1,
                        borderWidth: 5,
                        // borderColor: '#66c2a5'
                    },
                    {
                        label: 'SII',
                        type: 'line',
                        order: 0,
                        yAxisID: 'y',
                        pointRadius: 1,
                        borderWidth: 5,
                        // borderColor: '#fc8d62'
                    },
                    {
                        label: 'OIII',
                        type: 'line',
                        order: 2,
                        yAxisID: 'y',
                        pointRadius: 1,
                        borderWidth: 5,
                        // strokeColor: '#8da0cb'
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onResize: this.resize.bind(this),
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                return tooltipText(tooltipItem.dataIndex, tooltipItem.raw);
                            }
                        }
                    },
                    zoom: {
                        enabled: true,
                        mode: 'xy',
                        zoom: {
                            drag: {
                                enabled: true,
                                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                                borderColor: 'rgb(255, 99, 132)',
                                borderWidth: 1,
                                modifierKey: 'shift'
                            },
                        },
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Wavelength (nm)'
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        // stacked: true,
                        title: {
                            display: true,
                            text: 'Energy (W / (m^2 nm))'
                        },
                        ticks: {
                            callback: function (label, index, labels) {
                                return label.toExponential(2);
                            }
                        }
                    },
                    y2: {
                        type: 'linear',
                        position: 'right',
                        display: false,
                    },
                    y3: {
                        type: 'linear',
                        position: 'right',
                        display: false,
                    }
                },
            }
        });

        this.chart.data.datasets[2].borderColor = '#66c2a5';
        this.chart.data.datasets[2].backgroundColor = 'transparent';
        this.chart.data.datasets[3].borderColor = '#fc8d62';
        this.chart.data.datasets[3].backgroundColor = 'transparent';
        this.chart.data.datasets[4].borderColor = '#8da0cb';
        this.chart.data.datasets[4].backgroundColor = 'transparent';

        // this.chart.options.animation = false; // disables all animations
        // // this.chart.options.animations.colors = false; // disables animation defined by the collection of 'colors' properties
        // // this.chart.options.animations.x = false; // disables animation defined by the 'x' property
        // this.chart.options.transitions.active.animation.duration = 0; // disables the animation for 'active' mode

        this.reset();
        this.element.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.chart.resetZoom();
            
        }, false);


        this.gui = gui.addFolder('Spectrum Viewer');
        this.gui.add(this.size, 'height')
            .onChange(value => {
                this.size.height = value;
                this.resize(this.chart, this.size);
                this.draw();
            })
            .listen();

    }

    resize(chart, size) {
        this.size.height = size.height;
        this.size.width = size.width;

        chart.resize(size.width, size.height);
    }

    resetZoom() {
        this.chart.resetZoom();
    }

    store() {
        return this.chart.canvas;
    }

    updateTemp(temp) {
        // const data = Array(this.bins).fill().map((v, i) => {
        //     let wl = this.indxToWl(i);
        //     return this.plank(temp, wl);
        // });
        // this.chart.data.datasets[2].data = data;
        // this.draw();
    }

    transmission(wl, centra_wl, width) {
        return Math.exp(-.5 * Math.pow((wl - centra_wl) / (width), 2))
    }

    updateBpRpTemp(temp) {
        // const data = Array(this.bins).fill().map((v, i) => {
        //     let wl = this.indxToWl(i);
        //     return this.plank(temp, wl);
        // });
        // this.chart.data.datasets[3].data = data;
        // this.draw();
    }

    integrateSpectra(wl_c, width, isExtinction) {
        let sum = 0;
        let data = Array(this.bins).fill().map((v, i) => {
            let wl = this.indxToWl(i);
            let energy; 
            if(isExtinction === true) {
                energy = this.chart.data.datasets[1].data[i];
            } else {
                energy = this.chart.data.datasets[0].data[i];
            }
            let filter = this.transmission(wl, wl_c, width);
            sum += filter;
            return filter * energy;
        });

        return data.map(v=> v / sum);
    }
    updateNarrowband(width = 1, isExtinction = false) {
        this.width = width;
        this.isExtinction = isExtinction;
        const h_alpha = this.integrateSpectra(656, width, isExtinction);
        const sii = this.integrateSpectra(673, width, isExtinction);
        const oii = this.integrateSpectra(500.7, width, isExtinction);
        this.chart.data.datasets[2].data = h_alpha;
        this.chart.data.datasets[3].data = sii;
        this.chart.data.datasets[4].data = oii;
        this.draw();
    }

    updateData(newData, corrFlux, width=this.width, isExtinction=this.isExtinction) {
        this.chart.data.datasets[0].data = newData;
        this.chart.data.datasets[1].data = corrFlux;
        this.updateNarrowband(width, isExtinction);
        // this.draw();
    }

    updateSpectralLines(data, errorRange) {
        if (this.chart.data.datasets.length > 4) {
            this.chart.data.datasets.splice(4)
        }
        data.forEach((group, k) => {

            let color = alpha => `rgba(${group.color[0] * 255}, ${group.color[1] * 255}, ${group.color[2] * 255}, ${alpha})`;
            let lines = group.indicies.map((line, i) => {
                return {
                    idx: line,
                    color: color(1),
                    name: group.labels[i],
                    isEmission: group.isEmission,
                    errorRange: Math.ceil(errorRange)
                }
            });
            const newDataset = {
                label: group.name,
                order: 5 + k,
                type: "VerticalLine",
                data: lines,
                backgroundColor: color(.7),
                borderColor: color(1)
            }
            this.chart.data.datasets.push(newDataset);
        });
        this.draw();
    }

    draw() {
        this.chart.update();
    }

    reset() {
        this.chart.data.datasets[0].data = Array(this.bins).fill(0);
        this.chart.data.datasets[1].data = Array(this.bins).fill(0);
        // this.chart.data.datasets[2].data = [];
        // this.chart.data.datasets[3].data = [];
        this.chart.update();
    }
}

class VerticalLine extends Chart.LineController {

    renderVerticalLine(chart, pointIndex, label, color, isEmission, errorRange=0) {
        const meta = chart.getDatasetMeta(0); // first dataset is used to discover X coordinate of a point
        const data = meta.data;
        const lineLeftOffset = data[pointIndex].x;
        const scale = chart.scales.y;

        const ctx = chart.ctx;
        // render vertical line
        if(errorRange > 0) {
            let a = data[Math.max(0, pointIndex - errorRange)].x;
            let b = data[Math.min(data.length-1, pointIndex + errorRange)].x;
            ctx.fillStyle = color;
            ctx.fillRect(a, scale.top, b - a, scale.bottom);
        } else {
            ctx.beginPath();
            ctx.strokeStyle = color;
            if (isEmission) {
                ctx.setLineDash([]);
            } else {
                ctx.setLineDash([5, 15]);
            }
            ctx.moveTo(lineLeftOffset, scale.top);
            ctx.lineTo(lineLeftOffset, scale.bottom);
            ctx.stroke();
        }


        // write label
        ctx.fillStyle = color;
        ctx.fillText(label, lineLeftOffset + 5, scale.top + 10);
    }

    draw() {
        // super.draw(arguments);
        // console.log(this.index, this.chart.data.datasets)
        let vLines = this.chart.data.datasets[this.index].data;
        
        if (vLines) {
            vLines.forEach(line => {
                this.renderVerticalLine(this.chart,
                    line.idx, line.name, line.color, line.isEmission, line.errorRange)
            });
        }
    }

};
VerticalLine.id = 'VerticalLine';
VerticalLine.defaults = Chart.LineController.defaults;

// Stores the controller so that the chart initialization routine can look it up
Chart.register(VerticalLine);