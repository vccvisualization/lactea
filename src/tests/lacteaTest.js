import {StarTree} from "../lactea/StarTree.js";
import {ViewBound} from '../lactea/ViewBound.js';
import { RollingAverage } from "../visualizer/utils/RollingAverage.js";

export const lacteaTest = () => {
    console.log("lacteaTest");
    const tree = new StarTree("../");
    tree.loadTree().then(res => {
        console.log("loading tree..done");
        console.log(tree);
        const vb = [new ViewBound(0, -180, 360, 180)];
        console.log(tree.chunksQuery(vb, (a, b, c) => false, [[0, 0, -1]], 20));
        console.log(tree.priorityQuery(vb));
        

        // tree.loadStarList(0).then((minStar) => {
        //     console.log("loaidng star list..done");
        //     console.log(minStar);
        //     console.log(tree.tree[0][0].ownEnergy, tree.tree[0][0].subtreeEnergy)
        //     // console.log([...node.ownSpectrum.add(node.subtreeSpectrum)]);
        //     // console.log([...tree.tree[0][0].ownSpectrum.add(tree.tree[0][0].subtreeSpectrum)]);
        // });
    });

    

}

lacteaTest();