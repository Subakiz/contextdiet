import { getEncoding } from 'js-tiktoken';

const enc = getEncoding("cl100k_base");

export interface TokenStats {
  originalTokens: number;
  skeletonizedTokens: number;
  savings: number;
  savingsPercentage: number;
}

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function calculateSavings(originalText: string, skeletonizedText: string): TokenStats {
  const originalTokens = countTokens(originalText);
  const skeletonizedTokens = countTokens(skeletonizedText);
  const savings = originalTokens - skeletonizedTokens;
  const savingsPercentage = originalTokens > 0 ? (savings / originalTokens) * 100 : 0;

  return {
    originalTokens,
    skeletonizedTokens,
    savings,
    savingsPercentage
  };
}
