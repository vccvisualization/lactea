export class ConvergenceViewer {
    constructor({
        canvasId = "#container",
    }) {
        this.element = document.querySelector(canvasId);
        this.chart = new Chart(this.element, {
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Flux',
                        type: 'line',
                        order: 0,
                        yAxisID: 'y',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                onResize: (chart, size) => {
                    chart.resize(size.width, size.height)
                },
                plugins: {
                    legend: {
                        display: false
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Stars Loaded'
                        }
                    },
                    y: {
                        type: 'logarithmic',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Energy'
                        },
                        ticks: {
                            callback: function (label, index, labels) {
                                return label.toExponential(2);
                            }
                        }
                    }
                },
            }
        });

    }


    done() {
        const newDataset = {
            label: "Truth",
            order: 4,
            type: "HorizontalLine"
        }
        this.chart.data.datasets.push(newDataset);
        this.draw();
    }

    addPoint(x, y) {
        if(this.chart.data.labels[this.chart.data.labels.length-1] === x) {
            return;
        }
        this.chart.data.labels.push(x);
        this.chart.data.datasets[0].data.push(y);
        this.draw();
    }

    setPoints(x, y) {
        this.chart.data.labels = x;
        this.chart.data.datasets[0].data = y;
        this.draw();
    }


    draw() {
        this.chart.update();
    }

    reset() {
        if(this.chart.data.datasets.length >= 2) {
            this.chart.data.datasets.pop();
        }
        this.chart.data.labels = [];
        this.chart.data.datasets[0].data = [];
        this.chart.update();
    }
}

class HorizontalLine extends Chart.LineController {

    renderHorizontalLine(chart, pointIndex) {
        const meta = chart.getDatasetMeta(0); // first dataset is used to discover X coordinate of a point
        const data = meta.data;
        const lineLeftOffset = data[data.length - 1].y;
        const scale = chart.scales.x;

        const ctx = chart.ctx;
        // render vertical line
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.moveTo(scale.left, lineLeftOffset);
        ctx.lineTo(scale.right, lineLeftOffset);
        ctx.stroke();

        // write label
        ctx.fillStyle = "red";
        ctx.fillText("Truth", scale.left + 10, lineLeftOffset + 15);
    }

    draw() {
        // super.draw(arguments);
        // console.log(this.index, this.chart.data.datasets)
        let hLine = this.chart.data.datasets[0].data[this.chart.data.datasets[0].data.length - 1];
        if (hLine) {
            this.renderHorizontalLine(this.chart, hLine);
        }
    }

};
HorizontalLine.id = 'HorizontalLine';
HorizontalLine.defaults = Chart.LineController.defaults;

// Stores the controller so that the chart initialization routine can look it up
Chart.register(HorizontalLine);