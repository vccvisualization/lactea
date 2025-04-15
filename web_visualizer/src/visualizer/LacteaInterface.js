import { StarTree } from '../lactea/StarTree.js';
import { ViewBound } from '../lactea/ViewBound.js';
import { projections, A_G } from './utils/utils.js';
import { PriorityQueue } from "./utils/PriorityQueue.js";

export class LacteaInterface {
    constructor(BASE = "") {
        this.tree = new StarTree(BASE);
        this.settings = {};
        
        this.m = glMatrix.mat3.fromValues(...A_G);
        this.mt = glMatrix.mat3.create();

        glMatrix.mat3.transpose(this.mt, this.m);

        // let a = this.projectGal(0.4166666666666667, 0.3055555555555556, glMatrix.vec2.fromValues(0.44942132, 0.64262861), 4.3);
        // console.log("a", a);
        this.load({});
    }

    load(settings) {
        this.settings.areaThreshold = settings?.areaThreshold ?? 0.005;
        this.settings.levels = settings?.levels ?? 1;
        this.settings.totalLevels = settings?.totalLevels ?? 1;
        this.settings.maxLength = settings?.maxLength ?? 1000;
        this.settings.patchesCutOff = settings?.patchesCutOff ?? true;
        this.settings.energyTol = settings?.energyTol ?? 0.8;
    }

    store() {
        return this.settings;
    }

    async init() {
        await this.tree.loadTree();
        this.settings.totalLevels = this.tree.getNumLevels();
        this.settings.levels = this.settings.totalLevels;
    }

    ui(gui, mainSettings) {
        const query = gui.addFolder('Query');
        query.add(this.settings, "areaThreshold")
            .onChange(value => {
                mainSettings.reloadEverything();
            }).listen();
        query.add(this.settings, "levels", 0, this.settings.totalLevels, 1)
            .onChange(value => {
                mainSettings.reloadEverything();
            }).listen();
        query.add(this.settings, "patchesCutOff")
            .onChange(value => {
                mainSettings.reloadEverything();
            }).listen();
        query.add(this.settings, "energyTol")
            .onChange(value => {
                mainSettings.reloadEverything();
            }).listen();
    }

    moveCamera(cam) {
        this.vb = [];

        if (cam.proj == projections.projection360 || cam.proj == projections.sphere) {
            this.vb = this.getPerspectiveBoundaries(cam.vpMat, cam.proj);
            // console.log("vpMat", cam.vpMat);
            // console.log(vb);
        }
        else if (cam.proj == projections.gal) {
            // vb = [new ViewBound(-1, -1, 1, 1)];
            this.vb = this.getGalBoundaries([-1, -1, 1, 1], cam.offset, cam.zoom);
        }
        else {
            this.vb = this.getIcrsBoundaries(cam.offset, cam.zoom);
        }
        this.vb.forEach(indx => {
            this.toDegrees(indx);
        });
        console.log(this.vb);
        if(this.vb.length === 2) {
            console.log("union boxes")
            this.vb = this.getBoxUnion(this.vb[0], this.vb[1]);
            console.log(this.vb);
        }
        this.nodeAddCondition = (boundingBox, level) => {
            if (!this.settings.patchesCutOff) return false; // traverse whole tree, don't cut off
            if (level > this.settings.levels) return true;
            // normalize: [0, 360] & [-90, 90] -> [0, 1]
            let coordinate = glMatrix.vec4.fromValues(boundingBox[0] / 360.0, boundingBox[1] / 180.0 + 0.5, boundingBox[2] / 360.0, boundingBox[3] / 180.0 + 0.5);
            // project: [0, 1] onject -> [-1, 1] screen
            if (cam.proj == projections.projection360 || cam.proj == projections.sphere) {
                this.objectToScreenPerspective(coordinate, cam.vpMat, cam.proj);
            } else if(cam.proj == projections.gal) {
                coordinate = glMatrix.vec4.fromValues(boundingBox[0] / 180 - 1, boundingBox[1] / 90.0, boundingBox[2] / 180 - 1, boundingBox[3] / 90.0);
                this.getGalBoundaries(coordinate, cam.offset, cam.zoom);
            }
            else {
                this.projectIcrs(coordinate, cam.offset, cam.zoom);
            }
            // normalize: [-1, 1] -> [0, 1]
            glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(0.5, 0.5, 0.5, 0.5));
            glMatrix.vec4.add(coordinate, coordinate, glMatrix.vec4.fromValues(0.5, 0.5, 0.5, 0.5));
            // clamp to 0-1
            coordinate = glMatrix.vec4.fromValues(
                Math.max(Math.min(coordinate[0], 1), 0),
                Math.max(Math.min(coordinate[1], 1), 0),
                Math.max(Math.min(coordinate[2], 1), 0),
                Math.max(Math.min(coordinate[3], 1), 0));
            // screen: [0, 1] -> [w, h]
            // glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(width, height, width, height));

            // calculate node area
            // TODO: fix condition!! not accurate for perspective view
            // https://www.mathopenref.com/coordpolygonarea.html
            let area = this.calcArea(coordinate);
            // console.log("area", area);
            // render patch if dim is smaller than specified patch size
            return area < this.settings.areaThreshold;
        };
        // this.queue = [[0, 0, -1]];
        this.queue = new PriorityQueue();
        this.queue.enqueue([0, 0], this.tree.tree[0][0].getTotalEnergy());
        this.refParents = {
            accumEnergy: {},
            threshold: {},
            level: undefined,
        };    
    }

    traverseTree() {
        // this.queue = [];
        // return [[], [552, 570]];
        let res = this.tree.priorityQuery(this.vb, this.queue, this.settings.levels, this.settings.maxLength, this.settings.areaThreshold, this.settings.energyTol, this.refParents);
        // let res = this.tree.chunksQuery(this.vb, this.nodeAddCondition, this.queue, this.settings.maxLength);
        this.queue = res[2];
        this.refParents = res[3];
        return [res[0], res[1]];
    }

    calcArea(boundingBox) {
        let corners = [
            glMatrix.vec2.fromValues(boundingBox[0], boundingBox[1]),
            glMatrix.vec2.fromValues(boundingBox[2], boundingBox[1]),
            glMatrix.vec2.fromValues(boundingBox[2], boundingBox[3]),
            glMatrix.vec2.fromValues(boundingBox[0], boundingBox[3]),
        ];
        // console.log(corners);
        let s = 0;
        for(let i = 0; i < 4; i++) {
            // console.log(i, (corners[i][0] * corners[(i+1) % 4][1]) - (corners[i][1] * corners[(i+1) % 4][0]));
            s += (corners[i][0] * corners[(i+1) % 4][1]) - (corners[i][1] * corners[(i+1) % 4][0]);
        }
        return 0.5 * Math.abs(s);
    }
    transformPoint(m, x, y) {
        let pos = glMatrix.vec4.fromValues(x, y, 0.0, 1.0);
        let result = glMatrix.vec4.create();
        glMatrix.vec4.transformMat4(result, pos, m);
        glMatrix.vec4.set(result, result[0] / result[3], result[1] / result[3], result[2] / result[3], 1);

        let scaled = glMatrix.vec3.fromValues(result[0], result[1], result[2]);
        let hAngle = Math.atan2(scaled[0], scaled[2]) / Math.PI;
        let vAngle = Math.atan2(scaled[1], glMatrix.vec2.length(glMatrix.vec2.fromValues(scaled[2], scaled[0]))) * 2.0 / Math.PI;
        let out = glMatrix.vec2.fromValues(hAngle, vAngle);
        return out
    }

    getPerspectiveBoundaries(vpMat, proj) {
        let pole = glMatrix.vec4.fromValues(0, 1, 0, 1);
        glMatrix.vec4.transformMat4(pole, pole, vpMat);
        if (proj == projections.projection360) {
            glMatrix.vec4.set(pole, pole[0] / pole[3], pole[1] / pole[3], pole[2] / pole[3], 1);
        }

        let limits = new ViewBound(10, 10, -10, -10);

        let vpMat_inv = glMatrix.mat4.create();
        glMatrix.mat4.invert(vpMat_inv, vpMat);

        let samples = [];
        for (let i = 0; i < 8; i++) {
            samples.push(glMatrix.vec2.create());
        }

        if (Math.abs(pole[1]) <= 1.0) {
            let i = 0;
            for (let yPos = -1.0; yPos <= 1.0; yPos++) {
                for (let xPos = -1.0; xPos <= 1.0; xPos++) {
                    if (xPos == 0.0 && yPos == 0.0) continue;
                    samples[i] = this.transformPoint(vpMat_inv, xPos, yPos);
                    i++;
                }
            }
            limits.l = -1;
            limits.r = 1;
            if (pole[2] < 1) {
                limits.t = 1;
                samples.forEach(s => { limits.b = Math.min(limits.b, s[1]); });
            } else {
                limits.b = -1;
                samples.forEach(s => { limits.t = Math.max(limits.t, s[1]); });
            }
            return [limits];
        } else {
            let center = this.transformPoint(vpMat_inv, 0.0, 0.0);
            let outOfBounds = 0;
            let i = 0;
            for (let yPos = -1.0; yPos <= 1.0; yPos++) {
                for (let xPos = -1.0; xPos <= 1.0; xPos++) {
                    if (xPos == 0.0 && yPos == 0.0) continue;
                    samples[i] = this.transformPoint(vpMat_inv, xPos, yPos);
                    let cDist = (samples[i][0] - center[0]);
                    if (cDist > 1) {
                        outOfBounds = 1;
                        samples[i][0] -= 2.0;
                    }
                    if (cDist < -1) {
                        outOfBounds = -1;
                        samples[i][0] += 2.0;
                    }
                    i++;
                }
            }

            samples.forEach(s => {
                limits.l = Math.min(limits.l, s[0]);
                limits.r = Math.max(limits.r, s[0]);
                limits.b = Math.min(limits.b, s[1]);
                limits.t = Math.max(limits.t, s[1]);
            });
            if (outOfBounds != 0) {
                let offset = outOfBounds * 2.0;
                return [limits, new ViewBound(limits.l + offset, limits.b, limits.r + offset, limits.t)];
            } else {
                return [limits];
            }
        }
    }

    getGalBoundaries(bb, offset, zoom) {
        const N = 20;

        let samples = [];
        for (let i = 0; i < Math.pow(N, 2); i++) {
            samples.push(glMatrix.vec2.create());
        }

        let outOfBounds = 0;
        let i = 0;
        for (let yPos = bb[1]; yPos <= bb[3]; yPos+=1/N) {
            for (let xPos = bb[0]; xPos <= bb[2]; xPos+=1/N) {
                if (xPos == 0.0 && yPos == 0.0) continue;
                samples[i] = this.transformGalPoint(offset, zoom, xPos, yPos);
                if(i > 0) {
                    let cDist = (samples[i][0] - samples[i-1][0]);
                    if (cDist > 1) {
                        outOfBounds = 1;
                        samples[i][0] -= 2.0;
                    }
                    if (cDist < -1) {
                        outOfBounds = -1;
                        samples[i][0] += 2.0;
                    }
                }
                i++;
            }
        }

        let limits = new ViewBound(samples[0][0], samples[0][1], samples[0][0], samples[0][1]);

        samples.forEach(s => {
            limits.l = Math.min(limits.l, s[0]);
            limits.r = Math.max(limits.r, s[0]);
            limits.b = Math.min(limits.b, s[1]);
            limits.t = Math.max(limits.t, s[1]);
        });
        if (outOfBounds != 0) {
            let offset = outOfBounds * 2.0;
            return [limits, new ViewBound(limits.l + offset, limits.b, limits.r + offset, limits.t)];
        } else {
            return [limits];
        }
    }

    transformGalPoint(offset, zoom, x, y) {
        // console.log("x, y", x, y);
        // receive screen pos from -1 to -1
        let coord = glMatrix.vec2.fromValues(x, y);
        // transform to screen pos between 0-1
        glMatrix.vec2.mul(coord, coord, glMatrix.vec2.fromValues(0.5, 0.5));
        glMatrix.vec2.div(coord, coord, glMatrix.vec2.fromValues(zoom, zoom));
        glMatrix.vec2.add(coord, coord, glMatrix.vec2.fromValues(offset[0], offset[1]));

        if(coord[0] < 0.5) {
            glMatrix.vec2.sub(coord, coord, glMatrix.vec2.fromValues(0.5, 0));
        } else {
            glMatrix.vec2.add(coord, coord, glMatrix.vec2.fromValues(0.5, 0));
        }
        // console.log("l/b", coord[0] * 360, coord[1] * 180 - 90);
        let trans = this.gal2icrs(coord[0], coord[1]);
        // console.log("ra, dec", trans[0], trans[1]);
        // if (trans[0] < 0) {
        //     trans[0] += 360;
        // }

        // normalize between 0-1
        trans[0] /= 360;
        trans[1] = trans[1] / 180 + 0.5;
        // console.log("deg (0-1)", trans[0], trans[1]);
        // normalize between -1 and 1
        coord = glMatrix.vec2.fromValues(trans[0], trans[1]);
        glMatrix.vec2.mul(coord, coord, glMatrix.vec2.fromValues(2, 2));
        glMatrix.vec2.sub(coord, coord, glMatrix.vec2.fromValues(1, 1));
        // console.log("norm", coord);
        return coord;
    }

    
    gal2icrs(l, b) {
        let alpha = l * 2 * Math.PI;
        let gamma = (b - 0.5) * Math.PI;
        
        let r_gal = glMatrix.vec3.fromValues(
            Math.cos(alpha) * Math.cos(gamma),
            Math.sin(alpha) * Math.cos(gamma),
            Math.sin(gamma)
        );

        let r_icrs = glMatrix.vec3.create();
        glMatrix.vec3.transformMat3(r_icrs, r_gal, this.mt);

        let alpha_approx = Math.atan2(r_icrs[1], r_icrs[0]);
        let gamma_approx = Math.atan2(r_icrs[2], (Math.sqrt(Math.pow(r_icrs[0], 2) + Math.pow(r_icrs[1], 2))));

        alpha_approx = alpha_approx * 180 / Math.PI;
        if (alpha_approx < 0) {
            alpha_approx += 360;
        }

        gamma_approx = gamma_approx * 180 / Math.PI;

        return [alpha_approx, gamma_approx]
    }

    icrs2gal(ra, dec) {
        let alpha = ra * 2 * Math.PI;
        let gamma = (dec - 0.5) * Math.PI;
        
        let r_icrs = glMatrix.vec3.fromValues(
            Math.cos(alpha) * Math.cos(gamma),
            Math.sin(alpha) * Math.cos(gamma),
            Math.sin(gamma)
        );

        let r_gal = glMatrix.vec3.create();
        glMatrix.vec3.transformMat3(r_gal, r_icrs, this.m);

        let alpha_approx = Math.atan2(r_gal[1], r_gal[0]);
        let gamma_approx = Math.atan2(r_gal[2], (Math.sqrt(Math.pow(r_gal[0], 2) + Math.pow(r_gal[1], 2))));

        if (alpha_approx < 0) {
            alpha_approx += 2 * Math.PI;
        }

        return [alpha_approx, gamma_approx]
    }

    getIcrsBoundaries(offset, zoom) {
        let limit_min = this.transformIcrsPoint(glMatrix.vec2.fromValues(0.0, 0.0), offset, zoom);
        let limit_max = this.transformIcrsPoint(glMatrix.vec2.fromValues(1.0, 1.0), offset, zoom);
        return [new ViewBound(limit_min[0], limit_min[1], limit_max[0], limit_max[1])];
    }

    transformIcrsPoint(coord, offset, zoom) {
        glMatrix.vec4.sub(coord, coord, glMatrix.vec4.fromValues(0.5, 0.5, 0.5, 0.5));
        glMatrix.vec4.div(coord, coord, glMatrix.vec4.fromValues(zoom, zoom, zoom, zoom));
        glMatrix.vec4.add(coord, coord, glMatrix.vec4.fromValues(offset[0], offset[1], offset[0], offset[1]));
        glMatrix.vec4.mul(coord, coord, glMatrix.vec4.fromValues(2, 2, 2, 2));
        glMatrix.vec4.sub(coord, coord, glMatrix.vec4.fromValues(1, 1, 1, 1));
        return coord;
    }

    projectIcrs(coordinate, offset, zoom) {
        glMatrix.vec4.sub(coordinate, coordinate, glMatrix.vec4.fromValues(offset[0], offset[1], offset[0], offset[1]));
        glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(2, 2, 2, 2));
        glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(zoom, zoom, zoom, zoom));
    }

    projectGal(ra, dec, offset, zoom) {
        let pos = this.icrs2gal(ra, dec);
        console.log("pos icrs2gal", pos);
        pos = glMatrix.vec2.fromValues(pos[0], pos[1]);
        glMatrix.vec2.div(pos, pos, glMatrix.vec2.fromValues(2 * Math.PI, Math.PI));
        glMatrix.vec2.add(pos, pos, glMatrix.vec2.fromValues(0.5 * (pos[0] < 0.5? 1: -1), 0.5));
        console.log("pos normalize rad 2 0-1", pos);
        glMatrix.vec2.sub(pos, pos, glMatrix.vec2.fromValues(offset[0], offset[1]));
        glMatrix.vec2.mul(pos, pos, glMatrix.vec2.fromValues(2, 2));
        glMatrix.vec2.mul(pos, pos, glMatrix.vec2.fromValues(zoom, zoom));
    
        console.log("pos offset zoom", pos);
        return pos;
        // glMatrix.vec4.sub(coordinate, coordinate, glMatrix.vec4.fromValues(offset[0], offset[1], offset[0], offset[1]));
        // glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(2, 2, 2, 2));
        // glMatrix.vec4.mul(coordinate, coordinate, glMatrix.vec4.fromValues(zoom, zoom, zoom, zoom));
    }


    objectToScreenPerspective(coordinate, vpMat, proj) {
        let p = glMatrix.vec2.fromValues(coordinate[0] * 2 - 1, coordinate[1] - 0.5);
        glMatrix.vec2.mul(p, p, glMatrix.vec2.fromValues(Math.PI, Math.PI));

        let horizontal = glMatrix.mat2.fromValues(Math.cos(p[0]), Math.sin(p[0]), -Math.sin(p[0]), Math.cos(p[0]));
        let vertical = glMatrix.mat2.fromValues(Math.cos(p[1]), Math.sin(p[1]), -Math.sin(p[1]), Math.cos(p[1]));
        let pos = glMatrix.vec3.fromValues(0, 0, 1);
        let temp = glMatrix.vec2.fromValues(pos[2], pos[1]);

        glMatrix.vec2.transformMat2(temp, temp, vertical);
        glMatrix.vec3.set(pos, pos[0], temp[1], temp[0]);
        glMatrix.vec2.set(temp, pos[2], pos[0]);
        glMatrix.vec2.transformMat2(temp, temp, horizontal);
        glMatrix.vec3.set(pos, temp[1], pos[1], temp[0]);

        let pos_proj = glMatrix.vec4.create();
        glMatrix.vec4.transformMat4(pos_proj, glMatrix.vec4.fromValues(pos[0], pos[1], pos[2], 1), vpMat);
        if (proj == projections.projection360) {
            glMatrix.vec4.set(pos_proj, pos_proj[0] / pos_proj[3], pos_proj[1] / pos_proj[3], pos_proj[2] / pos_proj[3], 1);
        }

        glMatrix.vec2.set(coordinate, -pos_proj[0], pos_proj[1]);
    }

    screenToLoc (coord, cam)  {
        coord = glMatrix.vec2.fromValues(coord[0], coord[1]);
        let pos;
        if(cam.proj == projections.gal) {
            pos = this.transformGalPoint(cam.offset, cam.zoom, coord[0], coord[1]);
        }
        else if (cam.proj == projections.icrs) {
            pos = this.transformIcrsPoint(coord, cam.offset, cam.zoom);
        }
        else {            
            let vpMat_inv = glMatrix.mat4.create();
            glMatrix.mat4.invert(vpMat_inv, cam.vpMat); 
            pos = this.transformPoint(vpMat_inv, coord[0], coord[1]);
        }

        glMatrix.vec2.mul(pos, pos, glMatrix.vec2.fromValues(180, 90));
        glMatrix.vec2.add(pos, pos, glMatrix.vec2.fromValues(180, 0));
        return [pos[0].toFixed(2), pos[1].toFixed(2)];
    }

    toDegrees(bound) {
        bound.l = (bound.l + 1.) * 180.;
        bound.b *= 90.;
        bound.r = (bound.r + 1.) * 180.;
        bound.t *= 90.;

        bound.l = Math.max(Math.min(bound.l, 360), 0);
        bound.b = Math.max(Math.min(bound.b, 90), -90);
        bound.r = Math.max(Math.min(bound.r, 360), 0);
        bound.t = Math.max(Math.min(bound.t, 90), -90);
    }

    getBoxUnion(box1, box2) {
        let { l: l1, r: r1, b: b1, t: t1 } = box1;
        let { l: l2, r: r2, b: b2, t: t2 } = box2;
    
        if (l1 <= l2 && r1 >= r2 && b1 <= b2 && t1 >= t2) {
            return [box1];
        }
    
        if (l2 <= l1 && r2 >= r1 && b2 <= b1 && t2 >= t1) {
            return [box2];
        }
    
        if (r1 <= l2 || r2 <= l1 || t1 <= b2 || t2 <= b1) {
            return [box1, box2];
        }
    
        let result = [box1];
    
        let overlapL = Math.max(l1, l2);
        let overlapR = Math.min(r1, r2);
        let overlapB = Math.max(b1, b2);
        let overlapT = Math.min(t1, t2);
    
        if (l2 < overlapL) {
            result.push({ l: l2, b: b2, r: overlapL, t: t2 });
        }
    
        if (r2 > overlapR) { 
            result.push({ l: overlapR, b: b2, r: r2, t: t2 });
        }
    
        if (b2 < overlapB) {
            result.push({ l: overlapL, b: b2, r: overlapR, t: overlapB });
        }
    
        if (t2 > overlapT) {
            result.push({ l: overlapL, b: overlapT, r: overlapR, t: t2 });
        }
    
        result = result.filter(box => box.l < box.r && box.b < box.t);
        return result;
    }
    
}