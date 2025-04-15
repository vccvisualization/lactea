import { LacteaVisualizer } from "./visualizer/LacteaVisualizer.js";
import { Draggable } from "./visualizer/utils/Draggable.js";

document.querySelector('#help_button')
    .addEventListener("click", () => {
        d3.select("#help")
        .classed("hide", d3.select("#help").classed("hide") ? false : true);
    });
new Draggable("#figures");
new Draggable("#info-container");

try {
    const visualizer = new LacteaVisualizer("#lactea-canvas");
    await visualizer.init();
    await visualizer.setup();
    // new Draggable(".lil-gui");

    visualizer.render();
}
catch(e){
    console.error(e);
    document.querySelector('#container').innerHTML = `Your device doesn't support WebGPU. Please use latest version of Chrome. <br><br> ${e}`
}
