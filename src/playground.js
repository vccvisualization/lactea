import { InfoViewer } from "./ui/InfoViewer.js";
import { SpectrumViewer } from "./ui/SpectrumViewer.js";
import { SignatureViewer } from "./ui/SignatureViewer.js";
import { LightSpectrum } from "./lactea/LightSpectrum.js";
import { TransferFunction } from "./ui/TransferFunction.js";
import { ConvergenceViewer } from "./ui/ConvergenceViewer.js";
import { StarTree } from "./lactea/StarTree.js";
import { ViewBound } from "./lactea/ViewBound.js";
import { MinStar } from "./lactea/MinStar.js";
import { floatToSoft, softFloatAdd, softTofloat } from "./lactea/utils.js";

const gui = new lil.GUI();

// const convergenceViewer = new ConvergenceViewer({canvasId: "#convergence"});
// convergenceViewer.addPoint(2, 1e-16);
// convergenceViewer.addPoint(16, 2e-16);
// convergenceViewer.addPoint(32, 3e-16);
// convergenceViewer.done();
// convergenceViewer.reset();
// convergenceViewer.addPoint(32, 3e-16);


const spectrumViewer = new SpectrumViewer({
    canvasId: "#spectrum", bins: 343, gui: gui,
    wlToIndx: LightSpectrum.mapWavelengthToIdx,
    indxToWl: idx => {
        let [wl_min, wl_max] = LightSpectrum.mapIdxToWavelength(idx);
        return wl_min;
        // return `[${formatWl(wl_min)}, ${formatWl(wl_max)})`;
    }
});

let data = [];
let corr = [];
// console.log(data.length, corr.length);
// console.log(data.reduce((a, b) => a + b), 0);
// console.log(corr.reduce((a, b) => a + b), 0);
// spectrumViewer.updateData(data, corr);
spectrumViewer.updateTemp(5388.943475664384);
spectrumViewer.updateBpRpTemp(4497.741173302649);

// const footprint = new SignatureViewer({
//     gui: gui,
//     binSize: LightSpectrum.NUM_BINS_BASE,
//     WlToIdx: LightSpectrum.mapWavelengthToIdx,
//     IdxToWl: idx => LightSpectrum.mapIdxToWavelength(idx)[0]

// });
// footprint.updateData();

// spectrumViewer.updateSpectralLines(footprint.signatures, footprint.errorRange);

const colormap = new TransferFunction({
    gui: gui,
    containerId: "#figures",
    binSize: 20,
});
colormap.updateData();

spectrumViewer.store();



console.log("lacteaTest");
const tree = new StarTree("");
const query = await tree.loadTree().then(res => {
    console.log("loading tree..done");
    console.log(tree);
    const vb = [new ViewBound(0, -180, 360, 180)];
    const [result, isLeaf] = tree.chunksQuery(vb, (a, b, c) => false);
   return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
});

const starsSpectra = await Promise.all(query.map(async element => {
    return await tree.loadStarList(element).then((minStar) => {
        let hist = new LightSpectrum();
        for(let i = 0; i < minStar.s; i++) {
            for(let wl = 0; wl < LightSpectrum.NUM_BINS_TOTAL; wl++) {
                hist.histogram[wl] += minStar.floatView[i * MinStar.NUM_ATTR + 4 + wl];
            }
        }
        return hist;
    });    
})
);
console.log(starsSpectra);
let initVal = new LightSpectrum();
const totalSpectra = starsSpectra.reduce((a, b) => {
    let val = new LightSpectrum();
    for(let wl = 0; wl < LightSpectrum.NUM_BINS_TOTAL; wl++) {
        val.histogram[wl] = a.histogram[wl] + b.histogram[wl];
    }
    return val;
},
initVal
);
data = totalSpectra.histogram.slice(0, LightSpectrum.NUM_BINS_BASE);
corr = totalSpectra.histogram.slice(LightSpectrum.NUM_BINS_BASE, LightSpectrum.NUM_BINS_BASE*2);
console.log(data.length, corr.length);
console.log(data.reduce((a, b) => a + b), 0);
console.log(corr.reduce((a, b) => a + b), 0);
spectrumViewer.updateData(data, corr);
spectrumViewer.draw();