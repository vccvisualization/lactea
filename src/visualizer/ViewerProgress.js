import { InfoViewer } from "../ui/InfoViewer.js";

export class ViewerProgress {
    constructor() {

        this.settings = {
            queryTotal: 0,
            queryCurrent: 0,

            patchTotal: 0,
            patchCurrent: 0,

            starTaskTotal: 0,
            starTaskCurrent: 0,

            nodeTaskTotal: 0,
            nodeTaskCuurent: 0,
        }
        this.infoViewer = new InfoViewer({
            containerId: "#query",
            title: "Query",
            className: "query"
        });
    }

    store() {
        return this.settings;
    }
    
    reset(querylength, patcheslength) {
        this.settings.queryTotal = querylength;
        this.settings.queryCurrent = 0;
        this.settings.patchTotal = patcheslength;
        this.settings.patchCurrent = 0;
        this.draw();
    }
    update(querylength, patcheslength) {
        this.settings.queryCurrent = this.settings.queryTotal - querylength;
        this.settings.patchCurrent = this.settings.patchTotal - patcheslength;
        this.draw();
    }

    totalUpdate(querylength, patcheslength) {
        this.settings.queryTotal = querylength;
        this.settings.patchTotal = patcheslength;
        this.draw();
    }
    currentUpdate(querylength, patcheslength) {
        this.settings.queryCurrent = querylength;
        this.settings.patchCurrent = patcheslength;
        this.draw();
    }
    updateTask(starTask, nodeTask) {
        this.settings.starTaskCurrent = this.settings.starTaskTotal - starTask;
        this.settings.nodeTaskCuurent = this.settings.nodeTaskTotal - nodeTask;
        this.draw();
    }
    resetTask(starTask, nodeTask) {
        this.settings.starTaskTotal = starTask;
        this.settings.nodeTaskTotal = nodeTask;
        this.draw();
    }
    
    draw() {
        this.infoViewer.update("Stars", `[${this.settings.queryCurrent}/${this.settings.queryTotal}](${(this.settings.queryCurrent / this.settings.queryTotal * 100).toFixed(2)}%)`);
        this.infoViewer.update("Nodes", `[${this.settings.patchCurrent}/${this.settings.patchTotal}](${(this.settings.patchCurrent / this.settings.patchTotal * 100).toFixed(2)}%)`);
        this.infoViewer.update("Star Task", `[${this.settings.starTaskCurrent}/${this.settings.starTaskTotal}](${(this.settings.starTaskCurrent / this.settings.starTaskTotal * 100).toFixed(2)}%)`);
        this.infoViewer.update("Node Task", `[${this.settings.nodeTaskCuurent}/${this.settings.nodeTaskTotal}](${(this.settings.nodeTaskCuurent / this.settings.nodeTaskTotal * 100).toFixed(2)}%)`);
        this.infoViewer.updateData();
    }

}