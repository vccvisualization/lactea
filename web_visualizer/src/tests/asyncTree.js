import {StarTree} from "../lactea/StarTree.js";
import {ViewBound} from '../lactea/ViewBound.js';
import { RollingAverage } from "../visualizer/utils/RollingAverage.js";

// const vb = [new ViewBound(400, 100, 450, 120)];
const vb = [new ViewBound(0, -90, 360, 90)];

const nodeAddCondition = (a, b) => false;
const tree = new StarTree("../");
await tree.loadTree().then(res => {
    console.log("loading tree..done");
    console.log(tree);
    // const [result, isLeaf] = tree.chunksQuery(vb, nodeAddCondition);
    // console.log([result, isLeaf]);
});

let query = [];
let patches = [];
let queue = [[0, 0]];
do {
    let res = tree.chunksQuery(vb, nodeAddCondition, queue, 2);
    queue = res[2];
    query.push(...res[0]);
    patches.push(...res[1]);
    console.log(res);
    query.shift();
}while(queue.length > 0);
console.log(query, patches)
// tree.asyncChunksQuery(vb, nodeAddCondition);

// let query = [];
// let i = 0;
// while(i < 3) {
//     query = await tree.query.next();
//     console.log(`more work ${query.value[0]}`);
//     i++;
// }
// console.log(`${i} work ${query.value[0]}`);
// console.log("take 2");
// for await(const x of tree.query) {
//     query = x[0];
//     console.log(`more ${i} work ${query}`);
// }
// console.log(`${i} work ${query}`);
// let query = await tree.query.next();
// console.log(`more work ${query.value[0]}`);
// query = await tree.query.next();
// console.log(`more work ${query.value[0]}`);
// query.value[0].splice(0, 1);
// query = await tree.query.next();
// console.log(`more work ${query.value[0]}`);
// query = await tree.query.next();
// console.log(`more work ${query.value[0]}`);
// let query = [];
// let patches = [];
// let i = 0;
// let j = 0;
// while (j < 5) {
//     for await (const res of tree.query) {
//         console.log(res);
//         // res[0][0] = "hi"
//         query = res[0];
//         // patches = res;
//         // if(query.length) {
//         //     console.log(`before ${res}`)
//         //     query.shift();
//         //     console.log(`after ${res}`)
//         // }
//         i++;
//         if(i > 2) {break;}
//     }
//     console.log("query", query, patches);
//     j++;
// }
// console.log("query", query, patches);
// console.log(`${query}`)

// // Mock of asynchronous DB
// const findGroup = (level, index) => {
//     return {node: tree.tree[level][index], level: level};
// }

// // Make an async generator
// async function * tr(level, index) {
//     let result = [findGroup(level, index)];
//     let starQuery = [];
//     let nodeQuery = [];

//     while (result.length) {
//         yield [result, starQuery, nodeQuery];

//         result = await Promise.all(result.flatMap(group => { 
//             let intersect = false;
//             vb.forEach(lim => {
//                 intersect = intersect || tree.intersect(group.node.boundingBox[0], group.node.boundingBox[1], group.node.boundingBox[2], group.node.boundingBox[3], lim.l, lim.b, lim.r, lim.t);
//             });
//             if (!intersect) {
//                 return [];
//             } 
//             else {
//                 if(nodeAddCondition(group.node.boundingBox, group.level)) {
//                     nodeQuery.push(group.node.id);
//                     // return [];
//                 } else {
//                     starQuery.push(group.node.id);
//                 }
//             }
//             if(group.node.children[0] === group.node.children[1]) {
//                 return [];
//             }
            
//             return [...group.node.children].flatMap( index => findGroup(group.level + 1, index));
//         }));
//     }
// };

// // Consume the async iterator you get from the above function. The call starts with the id of the tree's root:
// (async () => {
//     for await (let result of tr(0, 0)) {
//         result[1].shift();
//         console.log(result[1]);
//     }
// })();