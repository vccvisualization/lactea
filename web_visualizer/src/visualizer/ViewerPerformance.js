
import { InfoViewer } from "../ui/InfoViewer.js";
import { RollingAverage } from "./utils/RollingAverage.js";

export class PerformanceViewer {
    constructor(sorted=false) {

        this.infoViewer = new InfoViewer({
            containerId: "#info",
            title: "Performance",
            sorted: sorted
        });

        this.fpsAverage = new RollingAverage("fps");
        this.jsAverage = new RollingAverage("jstime");
        this.rAFAverage = new RollingAverage("rAF");
        this.rAFfpsAverage = new RollingAverage("rAF fps");
        this.timeToConvergenceAverage = new RollingAverage("TimeToConvergence");
        this.times = new Map();
 
    }

    store() {
        let times = {
            ...this.rAFAverage.store(),
            ...this.rAFfpsAverage.store(),
            ...this.jsAverage.store(),
            ...this.fpsAverage.store(),
            ...this.timeToConvergenceAverage.store(),
        };

        this.times.forEach((value, k) => {
            times = {...times, 
                ...value.store(),
            };
        });
        return times;
    }

    addGpu(key, time) {
        this.add(key, time * 1e-6);
    }

    add(key, time) {
        if(!this.times.has(key)) {
            this.times.set(key, new RollingAverage(key));
        }
        this.times.get(key).addSample(time);

        this.infoViewer.update(key, this.times.get(key).toString());
        this.infoViewer.updateData();

    }

    start(now=performance.now(), add=true) {
        now *= 0.001;  // convert to seconds
        if(add && this.then !== undefined) {
            const deltaTime = now - this.then;
            this.rAFAverage.addSample(deltaTime * 1000);
            this.rAFfpsAverage.addSample(1 / (deltaTime) || 0);
        }
        this.then = now;
        this.infoViewer.update(this.rAFAverage.label, this.rAFAverage.toString());
        this.infoViewer.update(this.rAFfpsAverage.label, this.rAFfpsAverage.toString());
        this.infoViewer.update(this.jsAverage.label, this.jsAverage.toString());
        // this.infoViewer.update(this.fpsAverage.label, this.fpsAverage.toString());
        this.infoViewer.updateData();
        this.startTime = performance.now();
    }

    startConvergence() {
        this.timeToConvergence = performance.now();
    }
    endConvergence() {
        const jsTime = performance.now() - this.timeToConvergence;
        this.timeToConvergenceAverage.addSample(jsTime);
        this.infoViewer.update(this.timeToConvergenceAverage.label, this.timeToConvergenceAverage.toString()); 
        this.infoViewer.updateData();
    }

    end() {
        const jsTime = performance.now() - this.startTime;
        this.jsAverage.addSample(jsTime);
        this.fpsAverage.addSample(1000 / (jsTime) || 0);
        this.infoViewer.update(this.jsAverage.label, this.jsAverage.toString());
        // this.infoViewer.update(this.fpsAverage.label, this.fpsAverage.toString());
        this.infoViewer.updateData();
    }

}