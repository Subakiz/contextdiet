import { getEncoding, type Tiktoken } from 'js-tiktoken';
import type { FileStatus, PackedFile, FileTokenMetric, ContextPackAudit } from '../types.js';

/**
 * Token estimator using js-tiktoken cl100k_base with pure-JS regex fallback.
 */
export class TiktokenEstimator {
  private encoder: Tiktoken | null = null;
  private readonly regexFallback: RegExp;

  constructor() {
    try {
      this.encoder = getEncoding('cl100k_base');
    } catch {
      this.encoder = null;
    }
    // GPT-4 / cl100k BPE word boundary fallback regex
    this.regexFallback =
      /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/giu;
  }

  /**
   * Count tokens for a given text snippet.
   */
  public countTokens(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    if (this.encoder) {
      try {
        // Pass 'all' to safely permit special tokens like <|endoftext|>
        return this.encoder.encode(text, 'all').length;
      } catch {
        // Fall back to regex if any unexpected encoding exception occurs
      }
    }
    return this.fallbackCount(text);
  }

  private fallbackCount(text: string): number {
    const matches = text.match(this.regexFallback);
    return matches ? matches.length : 0;
  }
}

// Global singleton instance for standalone functions
const defaultEstimator = new TiktokenEstimator();

/**
 * Standalone token counting function.
 */
export function countTokens(text: string): number {
  return defaultEstimator.countTokens(text);
}

/**
 * Calculate token metrics for a single file, with division-by-zero protection.
 */
export function calculateFileMetric(
  path: string,
  status: FileStatus,
  originalTokens: number,
  packedTokens: number
): FileTokenMetric {
  const orig = Number.isFinite(originalTokens) && originalTokens > 0 ? originalTokens : 0;
  const packed = Number.isFinite(packedTokens) && packedTokens > 0 ? packedTokens : 0;
  const savedTokens = orig === 0 ? 0 : orig - packed;
  const reductionPercentage =
    orig === 0 ? 0.0 : Math.round(((orig - packed) / orig) * 100 * 100) / 100;

  return {
    path,
    status,
    originalTokens: orig,
    packedTokens: packed,
    savedTokens,
    reductionPercentage
  };
}

/**
 * Calculate token audit across all packed files in a context pack.
 */
export function calculateAudit(
  files: PackedFile[],
  estimator: TiktokenEstimator = defaultEstimator
): ContextPackAudit {
  let totalOriginalTokens = 0;
  let totalPackedTokens = 0;
  let totalSavedTokens = 0;
  const fileMetrics: FileTokenMetric[] = [];

  for (const file of files) {
    const origTokens =
      file.rawTokens !== undefined
        ? file.rawTokens
        : estimator.countTokens(file.rawContent || '');
    const packTokens =
      file.packedTokens !== undefined
        ? file.packedTokens
        : estimator.countTokens(file.content || '');

    // Cache tokens onto file object
    file.rawTokens = origTokens;
    file.packedTokens = packTokens;

    const metric = calculateFileMetric(
      file.relativePath || file.filePath,
      file.status,
      origTokens,
      packTokens
    );

    fileMetrics.push(metric);
    totalOriginalTokens += origTokens;
    totalPackedTokens += packTokens;
    totalSavedTokens += metric.savedTokens;
  }

  const overallReductionPercentage =
    totalOriginalTokens === 0
      ? 0.0
      : Math.round(((totalOriginalTokens - totalPackedTokens) / totalOriginalTokens) * 100 * 100) / 100;

  return {
    files: fileMetrics,
    totalOriginalTokens,
    totalPackedTokens,
    totalSavedTokens,
    overallReductionPercentage
  };
}

export * from './types.js';
export { renderComparisonTable } from './table-reporter.js';
