/**
 * Event processing pipeline with batching, retries, and backpressure management.
 */

import { EventRingBuffer } from './utils/event-buffer.js';
import { MetricsCollector } from './metrics.js';

export class EventPipeline {
  /**
   * @param {object} options
   * @param {number} [options.batchSize=50]
   * @param {number} [options.flushIntervalMs=100]
   * @param {number} [options.maxRetries=3]
   */
  constructor(options = {}) {
    this.batchSize = options.batchSize || 50;
    this.flushIntervalMs = options.flushIntervalMs || 100;
    this.maxRetries = options.maxRetries || 3;

    this.buffer = new EventRingBuffer(2048);
    this.metrics = new MetricsCollector(10000);
    this.deadLetterQueue = [];
    this.isProcessing = false;
    this.handlers = new Map();
  }

  /**
   * Register a topic-specific handler.
   * @param {string} topic
   * @param {Function} handlerAsync
   */
  registerHandler(topic, handlerAsync) {
    this.handlers.set(topic, handlerAsync);
  }

  /**
   * Enqueue event for downstream processing.
   * @param {object} event
   * @returns {boolean} True if accepted
   */
  enqueue(event) {
    if (!event || !event.topic) {
      throw new Error('Event must have a defined topic property');
    }

    event.enqueuedAt = Date.now();
    event.retryCount = 0;
    return this.buffer.push(event);
  }

  /**
   * Flush and process pending batch of events.
   * @returns {Promise<{ processed: number, failed: number }>}
   */
  async flush() {
    if (this.isProcessing) {
      return { processed: 0, failed: 0 };
    }

    this.isProcessing = true;
    const batch = this.buffer.drain(this.batchSize);
    let processed = 0;
    let failed = 0;

    for (const event of batch) {
      const startTime = Date.now();
      const handler = this.handlers.get(event.topic);

      if (!handler) {
        this.deadLetterQueue.push({ event, reason: `No handler registered for topic: ${event.topic}` });
        this.metrics.recordLatency(Date.now() - startTime, true);
        failed++;
        continue;
      }

      const success = await this.executeWithRetry(handler, event);
      const duration = Date.now() - startTime;
      this.metrics.recordLatency(duration, !success);

      if (success) {
        processed++;
      } else {
        failed++;
      }
    }

    this.isProcessing = false;
    return { processed, failed };
  }

  /**
   * Execute handler with exponential backoff retry and full jitter algorithm.
   * @param {Function} handler
   * @param {object} event
   * @returns {Promise<boolean>}
   */
  async executeWithRetry(handler, event) {
    while (event.retryCount <= this.maxRetries) {
      try {
        await handler(event.payload);
        return true;
      } catch (err) {
        event.retryCount++;
        if (event.retryCount > this.maxRetries) {
          this.deadLetterQueue.push({
            event,
            error: err.message,
            stack: err.stack,
            failedAt: Date.now(),
            totalAttempts: event.retryCount
          });
          return false;
        }

        // Full jitter exponential backoff: sleep = rand(0, min(cap, base * 2^attempt))
        const baseMs = 50;
        const capMs = 2000;
        const temp = Math.min(capMs, baseMs * Math.pow(2, event.retryCount));
        const sleepMs = Math.floor(Math.random() * temp);

        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    }
    return false;
  }

  /**
   * Partition events into topic clusters for parallel dispatch.
   * @param {any[]} events
   * @returns {Map<string, any[]>}
   */
  partitionByTopic(events) {
    const partitioned = new Map();
    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      const topic = evt.topic || 'default';
      let group = partitioned.get(topic);
      if (!group) {
        group = [];
        partitioned.set(topic, group);
      }
      group.push(evt);
    }
    return partitioned;
  }

  /**
   * Check if pipeline is under backpressure.
   * @returns {boolean}
   */
  isUnderBackpressure() {
    return this.buffer.getOccupancyRate() > 0.8;
  }

  getMetrics() {
    return this.metrics.getSnapshot();
  }

  getDeadLetterCount() {
    return this.deadLetterQueue.length;
  }
}
