export class Settings {
    constructor() {
        // time
        this.then = 0;

        // render loop
        this.update = true;
        this.cacheLoad = true;
        this.updateCanvas = true;
        this.userUpdate = true;
        this.spectrumUpdate = true;
        this._pause = false;
        this.spectrumUpdateCPU = 0;
        this.currentSpectrumCpuUpdate = 0;
        this.lastUpdateSpectrum = 0;
        this.mouseMoving = false;

        // tasks
        this.taskUpdate = true;
        this.starTasks = [];
        this.nodeTasks = [];

        this.load({});

        // profiles
        this.profiles = [
            "fig9.json",
            "fig10.json",
            "fig11.json",
            "showcase.json"
        ];
        this.profile = -1;
    }


    load(settings) {
        this.infoWidth = settings?.infoWidth ?? 500;
        // time
        this.deltaTime = settings?.deltaTime ?? 0;
        this.performance = settings?.performance ?? true;

        // tasks
        this.starTaskSize = settings?.starTaskSize ?? 50000; // how many stars to process at once
        this.nodeTaskSize = settings?.nodeTaskSize ?? 1000; // how many nodes to process at once
        this.taskDepthStages = settings?.taskDepthStages ?? 16; // how many chunks the depth will be proccessed at

        // minimap        
        this.showMinimap = settings?.showMinimap ?? true;
        this.showNodeLayout = settings?.showNodeLayout ?? true;
        this.showTwoScreens = settings?.showTwoScreens ?? false;

        // selection
        this.selectionColor = {
            r: settings?.selectionColor?.r ?? 1,
            g: settings?.selectionColor?.g ?? 0,
            b: settings?.selectionColor?.b ?? 0
        };
        this.showSelection = settings?.showSelection ?? true;

        // spectra
        this.showPatches = settings?.showPatches ?? true;
        this.showStars = settings?.showStars ?? true;
    }

    store() {
        let settings = {};
        settings.infoWidth = this.infoWidth;
        // time
        settings.deltaTime = this.deltaTime;
        settings.performance = this.performance;
        // tasks
        settings.starTaskSize = this.starTaskSize;
        settings.nodeTaskSize = this.nodeTaskSize;
        settings.taskDepthStages = this.taskDepthStages;
        // minimap        
        settings.showMinimap = this.showMinimap;
        settings.showNodeLayout = this.showNodeLayout;
        settings.showTwoScreens = this.showTwoScreens;
        // selection
        settings.selectionColor = this.selectionColor;
        settings.showSelection = this.showSelection;
        // spectra
        settings.showPatches = this.showPatches;
        settings.showStars = this.showStars;
        return settings;
    }

    ui(gui) {
        const general = gui.addFolder('General settings');
        general.add(this, "stop");
        general.add(this, "pause");
        general.add(this, "resume");
        general.add(this, "reloadEverything");
        general.add(this, "updateSpectrum");
        general.add(this, "updateCpuSpectrum");
        general.add(this, "showTwoScreens")
            .onChange(value => {
                this.updateUser();
            })
            .listen();
        general.add(this, "showNodeLayout")
            .onChange(value => {
                this.updateUser();
            }).listen();
        general.add(this, "showMinimap")
            .onChange(value => {
                this.updateUser();
            }).listen();
        general.add(this, "showSelection")
            .onChange(value => {
                this.updateUser();
            }).listen();
        general.addColor(this, 'selectionColor')
            .onChange(value => {
                this.updateUser();
            }).listen();
        general.add(this, 'infoWidth')
            .name("information width")
            .onChange(value => {
                d3.selectAll("#info-container.absolute").style("width", `${value}px`);
                d3.selectAll("#figures.absolute").style("width", `${value}px`);
            })
            .listen();
        general.add(this, "starTaskSize")
            .listen();
        general.add(this, "nodeTaskSize")
            .listen();
        general.add(this, "taskDepthStages")
            .listen();
        general.add(this, "showPatches")
            .onChange(value => {
                this.updateUser();
            }).listen();
        general.add(this, "showStars")
            .onChange(value => {
                this.updateUser();
            }).listen();
    }


    startTasks() {
        this.taskUpdate = true;
        this.starTasks = [];
        this.nodeTasks = [];
    }

    endTasks() {
        this.taskUpdate = false;
        this.starTasks = [];
        this.nodeTasks = [];
    }

    areTasksCompleted() {
        return (this.starTasks.length === 0) && (this.nodeTasks.length === 0);
    }

    updateSpectrum() {
        this.spectrumUpdate = true;
    }

    isUpdateSpectrum() {
        return this.spectrumUpdate;
    }

    resetUpdateSpectrum() {
        this.spectrumUpdate = false;
    }

    updateCpuSpectrum() {
        this.spectrumUpdateCPU += 1;
    }

    isUpdateCpuSpectrum() {
        return this.spectrumUpdateCPU != this.currentSpectrumCpuUpdate;
    }

    resetUpdateCpuSpectrum() {
        if (this.spectrumUpdateCPU > 1) {
            this.spectrumUpdateCPU = 1;
            this.currentSpectrumCpuUpdate = 0;
        } else {
            this.spectrumUpdateCPU = 0;
            this.currentSpectrumCpuUpdate = 0;
        }
    }

    reloadEverything() {
        this.update = true;
        this.cacheLoad = true;
        this.userUpdate = true;
        this.updateSpectrum();
        this.startTasks();
    }

    reloadNoSpectrum() {
        this.update = true;
        this.cacheLoad = true;
        this.userUpdate = true;
        this.startTasks();
    }

    updateUser() {
        this.userUpdate = true;
    }

    pause() {
        this._pause = true;
    }

    resume() {
        this._pause = false;
    }

    isPaused() {
        return this._pause;
    }
    stop() {
        this.update = false;
        this.cacheLoad = false;
        this.userUpdate = false;
        this.updateCanvas = false;
        this.resetUpdateCpuSpectrum();
        this.resetUpdateSpectrum();
        this.endTasks();
    }

    isRedraw() {
        return this.update ||
            this.cacheLoad ||
            !this.areTasksCompleted() ||
            this.taskUpdate ||
            this.userUpdate ||
            this.updateCanvas;
    }

}