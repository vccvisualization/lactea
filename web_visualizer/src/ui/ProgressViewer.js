export class ProgressViewer {
    constructor({
        title = "Progress bar",
        margin = 40,
        containerId = "#container",
        width = 512,
        pointsHeight = 50,
        rectWidth = 10
    }) {
        this.rectWidth = rectWidth;

        // set the dimensions and margins of the graph
        this.margin = margin;
        this.ogWidth = width;
        this.width = width + this.margin * 2;
        this.pointsHeight = pointsHeight; // - this.margin.top - this.margin.bottom;

        this.chart = d3.select(containerId);
        const container = this.chart.append("div").attr("class", "progress");

        this.svg = container
            .append('svg')
            .attr("width", this.width)
            .attr("height", this.pointsHeight + 2 * this.margin)
            ;
        this.label = this.svg
            .append("text")
            .text(title)
            .attr("y", this.margin * 0.5)
            .attr("x", this.width * 0.5)
            .attr("text-anchor", "middle")
            .attr("class", "text-progress");
        this.bar = this.svg
            .append('g');
        this.text = this.svg
            .append("text")
            .text(`No data`)
            .attr("y", this.pointsHeight + this.margin * 0.5)
            .attr("x", this.margin + 15)
            .attr("class", "text-progress");

        this.resize(container);
    }

    resize(container) {
        const resizeObserver = new ResizeObserver((entries) => {
            let entry = entries[0];
            let width = 0;
            width = entry.borderBoxSize[0].inlineSize;
            this.updateWidth(width);
            this.updateData();
        });

        resizeObserver.observe(container.node());
    }


    reset(total) {
        this.total = total;
        this.current = 0;
    }

    update(current) {
        this.current = current;
    }

    minus(current) {
        this.current = this.total - current;
    }

    updateWidth(width = parseInt(this.chart.style('width'), 10)) {
        this.ogWidth = width - this.margin * 2;
        this.width = this.ogWidth + this.margin * 2;
    }

    updateData() {
        let t = this.svg.transition().duration(500);

        // update width & height
        this.updateWidth();


        this.svg
            .attr("width", this.width);

        this.label
            .transition(t)

            .attr("x", this.width * 0.5);
        if (this.total > 0) {

            let data = [
                {
                    x: this.margin,
                    width: this.ogWidth * this.current / this.total,
                    c: "current-progress",
                },
                {
                    x: this.margin + this.ogWidth * this.current / this.total,
                    width: this.ogWidth * (1 - this.current / this.total),
                    c: "total-progress"
                }
            ]
            // draw
            this.bar
                .selectAll("rect")
                .data(data)
                .join(
                    enter => enter
                        .append("rect")
                        .attr("y", this.margin)
                        .attr("x", d => d.x)
                        .attr("height", this.pointsHeight)
                        .attr("width", d => d.width)
                        .attr("class", d => d.c)
                    ,
                    update => update.call(update => update.transition(t)
                        .attr("y", this.margin)
                        .attr("x", d => d.x)
                        .attr("height", this.pointsHeight)
                        .attr("width", d => d.width))
                    ,
                    exit => exit.call(exit => exit.transition(t)
                        .remove())
                );

            this.text
                .transition(t)
                .text(`${this.current}/${this.total} (${(this.current / this.total * 100).toFixed(2)} %)`)
                .attr("y", this.pointsHeight + this.margin * 0.5)
                .attr("x", this.margin + 15);
        }
    }
}