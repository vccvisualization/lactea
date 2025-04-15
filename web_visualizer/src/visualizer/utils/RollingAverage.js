export class RollingAverage {
    #total = 0;
    #samples = [];
    #cursor = 0;
    #v = 0;
    #numSamples;
    constructor(label, numSamples = 30) {
        this.#numSamples = numSamples;
        this.label = label;
    }

    store() {
        this.roll = {};
        this.roll[this.label] = {
            "str": this.toString(),
            "samples": this.#samples
        };
        return this.roll;
    }

    addSample(v) {
        // this.#samples.push(v);
        this.#total += v - (this.#samples[this.#cursor] || 0);
        this.#samples[this.#cursor] = v;
        this.#v = v;
        this.#cursor = (this.#cursor + 1) % this.#numSamples;
    }
    get() {
        // return this.#samples.join(", ");
        // return (this.#samples.reduce((partialSum, a) => partialSum + a, 0) / this.#samples.length).toFixed(2) + " => " + this.#samples.map(x=> x.toFixed(2)).join(", ");
        return (this.#total / this.#samples.length).toFixed(2);
    }
    last() {
        return this.#v.toFixed(2);
    }

    confidenceInterval(alpha = 0.95) {
        let n = this.#samples.length;
        if (n > 0) {
            let sigma = Math.sqrt(this.#samples.map(x => Math.pow(x - this.#samples.reduce((a, b) => a + b) / n, 2)).reduce((a, b) => a + b) / n);
            return 2.042 * sigma / Math.sqrt(n);
        }
        return 0;
    }

    toString() {
        return `${this.last()} (avg: ${this.get()}±${this.confidenceInterval().toFixed(2)})`
    }
}