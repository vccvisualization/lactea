import { LacteaCache } from '../visualizer/LacteaCache.js';

const adapter = await navigator?.gpu?.requestAdapter();
if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
}
console.log(adapter.limits);
// limits
const requiredLimits = {};
requiredLimits.maxBufferSize = adapter.limits.maxBufferSize;
requiredLimits.maxStorageBufferBindingSize = adapter.limits.maxStorageBufferBindingSize;
const canTimestamp = adapter.features.has('timestamp-query');

const device = await adapter.requestDevice({
    requiredLimits,
    requiredFeatures: [
        ...(canTimestamp ? ['timestamp-query'] : []),
    ],
});


let lacteaCache = new LacteaCache(adapter.limits.maxComputeWorkgroupsPerDimension, "../");
await lacteaCache.init(device);


let update = true;
let cacheLoad = true;
let i = 0;

const queryE = d3.select("#query");
const remainingE = d3.select("#remaining");
const loadingE = d3.select("#loading");
const cacheE = d3.select("#cache");

const timeE = d3.select("#time");

const time = [];

function ui(timeStep) {
    // console.log(timeStep, time);
    timeE.html(`Step: ${timeStep + 1}/${time.length}`);

    queryE
        .selectAll("li")
        .data(time[0].query)
        .join(
            enter => enter
                .append("li")
                .html(d => d)
            ,
            update => update
                .html(d => d),
            exit => exit
                .remove()
        );

    loadingE
        .selectAll("li")
        .data(time[timeStep].loading)
        .join(
            enter => enter
                .append("li")
                .html(d => d)
            ,
            update => update
                .html(d => d),
            exit => exit
                .remove()
        );

    remainingE
        .selectAll("li")
        .data(time[timeStep].query)
        .join(
            enter => enter
                .append("li")
                .html(d => d)
            ,
            update => update
                .html(d => d),
            exit => exit
                .remove()
        );

    cacheE
        .selectAll("li")
        .data(time[timeStep].cache)
        .join(
            enter => enter
                .append("li")
                .html(d => d)
            ,
            update => update
                .html(d => d),
            exit => exit
                .remove()
        );
}


document.querySelector('#previous')
    .addEventListener("click", () => {
        i--;
        if (i >= 0 && i < time.length) {
            ui(i);
        }
    });
document.querySelector('#next')
    .addEventListener("click", () => {
        i++;
        if (i >= 0 && i < time.length) {
            ui(i);
        }
    });

const render = setInterval(() => {
    // get data
    if (update) {
        i = 0;
        // console.log(i, lacteaCache.query, lacteaCache.starLoading);
        // buffer update
        lacteaCache.moveCamera({
            proj: 0,
            offset: glMatrix.vec2.fromValues(0.5, 0.5),
            zoom: 1,
        }, 600, 400, 5, 0, false, false);
        update = false;
        time.push({ query: [...lacteaCache.query], loading: [...lacteaCache.starLoading], cache: [...lacteaCache.starGpuCache.cache.keys()] })
    }

    if (cacheLoad) {
        lacteaCache.cacheLoad();
        time.push({ query: [...lacteaCache.query], loading: [...lacteaCache.starLoading], cache: [...lacteaCache.starGpuCache.cache.keys()] })
        // console.log(i, time[i]);
        i++;
        ui(i);
    }

    if (lacteaCache.done()) {
        cacheLoad = false;
        clearInterval(render);
    }
}, 300);
