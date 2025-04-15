export class PriorityQueue {
    constructor() {
        this.queue = [];
    }

    enqueue(value, priority) {
        this.queue.push({ value, priority });
        this.queue.sort((a, b) => b.priority - a.priority); // O(n log n)
    }

    dequeue() {
        return this.queue.shift(); // O(1)
    }

    peek() {
        return this.queue[0];
    }

    isEmpty() {
        return this.queue.length === 0;
    }
}
