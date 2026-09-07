/**
 * High-performance circular ring buffer for queuing streaming events.
 */

export class EventRingBuffer {
  /**
   * @param {number} capacity Maximum capacity of the ring buffer
   */
  constructor(capacity = 1024) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
    this.droppedEventsCount = 0;
  }

  /**
   * Push a new event to the buffer.
   * If buffer is full, oldest event is overwritten and dropped counter incremented.
   * @param {any} event Event item
   * @returns {boolean} True if appended without drop, false if dropped
   */
  push(event) {
    let dropped = false;
    if (this.size === this.capacity) {
      // Overwrite oldest item at head
      this.head = (this.head + 1) % this.capacity;
      this.droppedEventsCount++;
      dropped = true;
    } else {
      this.size++;
    }

    this.buffer[this.tail] = event;
    this.tail = (this.tail + 1) % this.capacity;
    return !dropped;
  }

  /**
   * Pop oldest item from buffer.
   * @returns {any|null} Oldest item or null if empty
   */
  pop() {
    if (this.size === 0) {
      return null;
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = null; // Free reference
    this.head = (this.head + 1) % this.capacity;
    this.size--;
    return item;
  }

  /**
   * Drain up to maxCount items into an array.
   * @param {number} maxCount Maximum batch size
   * @returns {any[]} Array of items
   */
  drain(maxCount = 100) {
    const count = Math.min(this.size, maxCount);
    const batch = new Array(count);

    for (let i = 0; i < count; i++) {
      batch[i] = this.buffer[this.head];
      this.buffer[this.head] = null;
      this.head = (this.head + 1) % this.capacity;
    }

    this.size -= count;
    return batch;
  }

  /**
   * Clear all elements.
   */
  clear() {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  /**
   * Get current occupancy percentage (0.0 to 1.0).
   * @returns {number}
   */
  getOccupancyRate() {
    return this.size / this.capacity;
  }

  /**
   * Drain items matching filter predicate up to maxCount.
   * @param {Function} filterFn
   * @param {number} maxCount
   * @returns {any[]}
   */
  drainFiltered(filterFn, maxCount = 50) {
    const matched = [];
    const remaining = [];

    while (this.size > 0) {
      const item = this.pop();
      if (item && filterFn(item) && matched.length < maxCount) {
        matched.push(item);
      } else if (item) {
        remaining.push(item);
      }
    }

    // Re-queue remaining items
    for (let i = 0; i < remaining.length; i++) {
      this.push(remaining[i]);
    }

    return matched;
  }

  /**
   * Produce immutable snapshot array of current buffer.
   * @returns {any[]}
   */
  toSnapshot() {
    const snapshot = [];
    let idx = this.head;
    for (let i = 0; i < this.size; i++) {
      snapshot.push(this.buffer[idx]);
      idx = (idx + 1) % this.capacity;
    }
    return snapshot;
  }
}
