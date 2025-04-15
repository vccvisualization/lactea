export class InfoViewer {
    constructor({
        title = "Info",
        containerId = "#container",
        sorted = false,
        className = ""
    }) {
        let container = d3.select(containerId).append("div").attr("class", `info ${className}`);
        container.append("h1").html(title);
        this.content = container.append("div");

        this.data = new Map();
        this.sort = sorted;
    }

    reset() {
        this.data.clear();
        this.updateData();
    }

    update(key, value) {
        this.data.set(key, value);
    }

    updateData() {
        let data = [...this.data.entries()];
        if(this.sort) { data = data.sort((a, b) => a[1] - b[1]); }
        this.content
            .selectAll("p")
            .data(data)
            .join(
                enter => enter
                    .append("p")
                ,
                update => update
                ,
                exit => exit
                    .remove()
            )
            .selectAll("span")
            .data(d => d)
            .join(
                enter => enter
                    .append("span")
                    .attr("class", (d, i) => i == 0 ? "info-key" : "info-val")
                    .html(d => d)
                ,
                update => update
                    .html(d => d)
                ,
                exit => exit
                    .remove()
            )
    }
}