/**
 * JavaScript Background Worker Entry Point.
 * Coordinates continuous event processing, timer loops, and pipeline dispatch.
 */

import { EventPipeline } from './pipeline.js';

export class BackgroundWorker {
  /**
   * @param {object} [config]
   */
  constructor(config = {}) {
    this.name = config.name || 'default-worker';
    this.pollIntervalMs = config.pollIntervalMs || 50;
    this.pipeline = new EventPipeline(config);
    this.timerId = null;
    this.active = false;
  }

  /**
   * Start worker processing loop.
   */
  start() {
    if (this.active) return;
    this.active = true;

    this.timerId = setInterval(async () => {
      try {
        await this.pipeline.flush();
      } catch (err) {
        console.error(`[${this.name}] Pipeline flush error:`, err);
      }
    }, this.pollIntervalMs);
  }

  /**
   * Stop processing and drain remaining events.
   */
  async stop() {
    if (!this.active) return;
    this.active = false;

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Final drain
    await this.pipeline.flush();
  }

  /**
   * Submit an event to the background worker pipeline.
   * @param {string} topic
   * @param {any} payload
   */
  submitEvent(topic, payload) {
    return this.pipeline.enqueue({
      topic,
      payload,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    });
  }

  /**
   * Register handler for a topic.
   * @param {string} topic
   * @param {Function} handler
   */
  on(topic, handler) {
    this.pipeline.registerHandler(topic, handler);
  }

  getStatus() {
    return {
      name: this.name,
      active: this.active,
      metrics: this.pipeline.getMetrics(),
      deadLetters: this.pipeline.getDeadLetterCount(),
      backpressure: this.pipeline.isUnderBackpressure()
    };
  }
}

export default BackgroundWorker;
