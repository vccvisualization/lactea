class SoftFloat {
    // for positive and negative exponent
    static BIAS = 127;
    // make number 1.mantissa
    static IMPLICIT_LEADING_ONE = 1 << 23;

    constructor(sign, exponent, mantissa) {
        // 1 bit
        this.sign = sign;
        // 8 bits
        this.exponent = exponent;
        // 23 bits
        this.mantissa = mantissa;
    }

}


const pack = (soft) => {
    // take a softfloat and pack it into a u32
    let exponent = (soft.exponent + SoftFloat.BIAS) >>> 0;
    let mantissa = soft.mantissa;
    if (soft.exponent !== -SoftFloat.BIAS) {
        mantissa |= SoftFloat.IMPLICIT_LEADING_ONE;
    }

    return (soft.sign << 31) | (exponent << 23) | (mantissa & 0x7FFFFF);
}

const unpack = (packed) => {
    // take a packed u32 and return softfloat
    const sign = (packed >>> 31) & 0x1;
    const exponent = (packed >>> 23) & 0xFF;
    let mantissa = packed & 0x7FFFFF;

    if (exponent !== 0) {
        mantissa |= SoftFloat.IMPLICIT_LEADING_ONE;
    }
    return new SoftFloat(sign, exponent - SoftFloat.BIAS, mantissa);

}


const softTofloat = (soft) => {
    // pack
    const packed = pack(soft);
    // to bits
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, packed);
    return view.getFloat32(0);
}

const floatToSoft = (float) => {
    // float to bits
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, float);
    const packed = view.getUint32(0);
    // make softfloat
    return unpack(packed);
}

const packedToFloat = (packed) => softTofloat(unpack(packed));


const softFloatAdd = (a, b) => {
    
    if (a.exponent > b.exponent) {
        const expDiff = a.exponent - b.exponent;
        b.mantissa >>= expDiff;
        b.exponent = a.exponent;
    } else if (a.exponent < b.exponent) {
        const expDiff = b.exponent - a.exponent;
        a.mantissa >>= expDiff;
        a.exponent = b.exponent;
    }

    let resultMantissa;
    let resultSign;
    if (a.sign === b.sign) {
        resultMantissa = a.mantissa + b.mantissa;
        resultSign = a.sign;
    } else {
        if (a.mantissa > b.mantissa) {
            resultMantissa = a.mantissa - b.mantissa;
            resultSign = a.sign;
        } else {
            resultMantissa = b.mantissa - a.mantissa;
            resultSign = b.sign;
        }
    }

    let resultExponent = a.exponent;
    if (resultMantissa >= (1 << 24)) {
        resultMantissa >>= 1;
        resultExponent++;
    } else if (resultMantissa < (1 << 23) && resultMantissa !== 0) {
        while (resultMantissa < (1 << 23)) {
            resultMantissa <<= 1;
            resultExponent--;
        }
    }

    return new SoftFloat(resultSign, resultExponent, resultMantissa);
}

export { packedToFloat, SoftFloat, pack, unpack, softTofloat, floatToSoft, softFloatAdd  };
