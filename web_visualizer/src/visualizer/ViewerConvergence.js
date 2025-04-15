import { ConvergenceViewer } from "../ui/ConvergenceViewer.js";

export class ViewerConvergence {
    constructor() {
        // this.convergenceViewer = new ConvergenceViewer({
        //     canvasId: "#convergence"
        // });

        this.convergenceData = {
            time: [],
            starCount:[],
            energy: []
        }
        this.isDone = false;
    }

    reset() {
        // this.convergenceViewer.reset();
        this.convergenceData = {
            time: [],
            starCount:[],
            energy: []
        }
    }

    store() {
        return this.convergenceData;
    }
    update(starCount, energy) {
        // this.convergenceViewer.addPoint(starCount, energy);

        if(this.convergenceData.starCount.length > 1 && this.convergenceData.starCount[this.convergenceData.starCount.length-1] === starCount) {
            return;
        }
        this.convergenceData.time.push(performance.now());
        this.convergenceData.starCount.push(starCount);
        this.convergenceData.energy.push(energy);
    }
    done() {
        this.isDone = true;
        // this.convergenceViewer.done();
    }

}