import { SoftFloat, pack, unpack, softFloatAdd, softTofloat, floatToSoft, packedToFloat } from "../lactea/utils.js";


const testConversion = (float) => {
    console.log("testConversion", float)
    let s = floatToSoft(float);
    let f2 = softTofloat(s);
    let s2 = floatToSoft(f2);
    console.log("float", float, "soft", s);
    console.log("float back", f2, "soft back", s2);
}

const testAdd = (f1, f2) => {
    console.log("add", f1, f2, f1+f2);   
    const sf1 = floatToSoft(f1);
    const sf2 = floatToSoft(f2);
    console.log("f1", f1, sf1);
    console.log("f2", f2, sf2);
    const result = softFloatAdd(sf1, sf2);
    console.log("result", softTofloat(result), result);
    console.log("expect", f1+f2, floatToSoft(f1+f2));

    const packed = pack(result);
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, packed);
    console.log("packed", view.getUint32(0));
    console.log("packedToFloat", packedToFloat(view.getUint32(0)))
}

testConversion(1.345783e-19);
testConversion(-431e3);
testConversion(3.14);

testConversion(0);
testConversion(-0);
testConversion(NaN);
testConversion(Infinity);
testConversion(-Infinity);

testAdd(1.4381e-19, -.0321e19);
// testAdd(3., .14);