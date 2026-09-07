/**
 * Latency metrics and percentile calculations using reservoir sampling.
 */

export class MetricsCollector {
  /**
   * @param {number} reservoirSize Maximum sample size for reservoir
   */
  constructor(reservoirSize = 5000) {
    this.reservoirSize = reservoirSize;
    this.samples = [];
    this.totalEventsProcessed = 0;
    this.totalDurationMs = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Record a latency measurement in milliseconds.
   * Uses Algorithm R for uniform random reservoir sampling.
   * @param {number} durationMs Latency in milliseconds
   * @param {boolean} isError Whether the event resulted in error
   */
  recordLatency(durationMs, isError = false) {
    this.totalEventsProcessed++;
    this.totalDurationMs += durationMs;

    if (isError) {
      this.errorCount++;
    }

    if (this.samples.length < this.reservoirSize) {
      this.samples.push(durationMs);
    } else {
      // Uniform random replacement
      const randomIndex = Math.floor(Math.random() * this.totalEventsProcessed);
      if (randomIndex < this.reservoirSize) {
        this.samples[randomIndex] = durationMs;
      }
    }
  }

  /**
   * Calculate percentile from current reservoir samples.
   * @param {number} p Percentile between 0 and 100
   * @returns {number} Value at percentile
   */
  getPercentile(p) {
    if (this.samples.length === 0) return 0;

    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Calculate standard deviation across reservoir samples.
   * @returns {number}
   */
  getStandardDeviation() {
    if (this.samples.length < 2) return 0;
    const mean = this.totalDurationMs / Math.max(1, this.totalEventsProcessed);
    let varianceSum = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const diff = this.samples[i] - mean;
      varianceSum += diff * diff;
    }
    return Math.sqrt(varianceSum / (this.samples.length - 1));
  }

  /**
   * Generate comprehensive metrics snapshot.
   * @returns {object}
   */
  getSnapshot() {
    const elapsedSeconds = Math.max(1, (Date.now() - this.startTime) / 1000);
    const throughputPerSec = this.totalEventsProcessed / elapsedSeconds;
    const avgLatencyMs =
      this.totalEventsProcessed > 0 ? this.totalDurationMs / this.totalEventsProcessed : 0;
    const stdDev = this.getStandardDeviation();

    // Compute distribution buckets
    const histogramBuckets = {
      under10ms: 0,
      under50ms: 0,
      under100ms: 0,
      over100ms: 0
    };

    for (let i = 0; i < this.samples.length; i++) {
      const val = this.samples[i];
      if (val < 10) histogramBuckets.under10ms++;
      else if (val < 50) histogramBuckets.under50ms++;
      else if (val < 100) histogramBuckets.under100ms++;
      else histogramBuckets.over100ms++;
    }

    return {
      totalEvents: this.totalEventsProcessed,
      errorCount: this.errorCount,
      errorRate:
        this.totalEventsProcessed > 0 ? (this.errorCount / this.totalEventsProcessed) * 100 : 0,
      throughputPerSec: Math.round(throughputPerSec * 100) / 100,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      stdDevMs: Math.round(stdDev * 100) / 100,
      p50LatencyMs: this.getPercentile(50),
      p75LatencyMs: this.getPercentile(75),
      p90LatencyMs: this.getPercentile(90),
      p95LatencyMs: this.getPercentile(95),
      p99LatencyMs: this.getPercentile(99),
      histogram: histogramBuckets
    };
  }

  /**
   * Reset collector counters.
   */
  reset() {
    this.samples = [];
    this.totalEventsProcessed = 0;
    this.totalDurationMs = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }
}
