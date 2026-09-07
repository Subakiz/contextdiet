import { describe, it, expect } from 'vitest';
import {
  TiktokenEstimator,
  countTokens,
  calculateFileMetric,
  calculateAudit,
  renderComparisonTable
} from '../../../src/token/index.js';
import type { PackedFile } from '../../../src/types.js';

describe('Token Estimation Engine (src/token/)', () => {
  describe('TiktokenEstimator', () => {
    it('instantiates and counts tokens for natural language', () => {
      const estimator = new TiktokenEstimator();
      const count = estimator.countTokens('ContextDiet reduces repository token load for LLMs.');
      expect(count).toBeGreaterThan(5);
      expect(count).toBeLessThan(20);
    });

    it('counts tokens for code snippets accurately', () => {
      const estimator = new TiktokenEstimator();
      const rawCode = `
        function calculateTotal(price: number, quantity: number): number {
          const subtotal = price * quantity;
          const tax = subtotal * 0.08;
          return subtotal + tax;
        }
      `;
      const skeletonCode = 'function calculateTotal(price: number, quantity: number): number { /* ... */ }';
      const rawTokens = estimator.countTokens(rawCode);
      const skelTokens = estimator.countTokens(skeletonCode);

      expect(rawTokens).toBeGreaterThan(skelTokens);
      expect(skelTokens).toBeGreaterThan(0);
    });

    it('safely handles empty, null, and non-string inputs', () => {
      const estimator = new TiktokenEstimator();
      expect(estimator.countTokens('')).toBe(0);
      expect(estimator.countTokens(null as any)).toBe(0);
      expect(estimator.countTokens(undefined as any)).toBe(0);
      expect(estimator.countTokens(123 as any)).toBe(0);
    });

    it('safely handles OpenAI special tokens without throwing', () => {
      const estimator = new TiktokenEstimator();
      const specialText = 'This contains <|endoftext|> and <|fim_prefix|> inside comments.';
      expect(() => estimator.countTokens(specialText)).not.toThrow();
      const count = estimator.countTokens(specialText);
      expect(count).toBeGreaterThan(0);
    });

    it('standalone countTokens matches estimator', () => {
      const text = 'export interface ServiceConfig { port: number; host: string; }';
      const estimator = new TiktokenEstimator();
      expect(countTokens(text)).toBe(estimator.countTokens(text));
    });
  });

  describe('calculateFileMetric', () => {
    it('computes saved tokens and reduction percentage correctly', () => {
      const metric = calculateFileMetric('src/service.ts', 'SKELETON', 1000, 200);
      expect(metric.path).toBe('src/service.ts');
      expect(metric.status).toBe('SKELETON');
      expect(metric.originalTokens).toBe(1000);
      expect(metric.packedTokens).toBe(200);
      expect(metric.savedTokens).toBe(800);
      expect(metric.reductionPercentage).toBe(80.0);
    });

    it('safely handles 0 original tokens without division by zero', () => {
      const metric = calculateFileMetric('src/empty.ts', 'SKELETON', 0, 0);
      expect(metric.originalTokens).toBe(0);
      expect(metric.packedTokens).toBe(0);
      expect(metric.savedTokens).toBe(0);
      expect(metric.reductionPercentage).toBe(0.0);
    });

    it('handles FOCUS file where original equals packed', () => {
      const metric = calculateFileMetric('src/main.ts', 'FOCUS', 450, 450);
      expect(metric.status).toBe('FOCUS');
      expect(metric.savedTokens).toBe(0);
      expect(metric.reductionPercentage).toBe(0.0);
    });

    it('handles negative or invalid number inputs gracefully', () => {
      const metric = calculateFileMetric('src/invalid.ts', 'SKELETON', -50, NaN);
      expect(metric.originalTokens).toBe(0);
      expect(metric.packedTokens).toBe(0);
      expect(metric.savedTokens).toBe(0);
      expect(metric.reductionPercentage).toBe(0.0);
    });
  });

  describe('calculateAudit', () => {
    it('aggregates file metrics across an array of PackedFiles', () => {
      const files: PackedFile[] = [
        {
          filePath: '/repo/src/index.ts',
          relativePath: 'src/index.ts',
          language: 'typescript',
          status: 'FOCUS',
          content: 'export class App {}',
          rawContent: 'export class App {}',
          rawTokens: 100,
          packedTokens: 100
        },
        {
          filePath: '/repo/src/util.ts',
          relativePath: 'src/util.ts',
          language: 'typescript',
          status: 'SKELETON',
          content: 'export function util(): void { /* ... */ }',
          rawContent: 'export function util(): void {\n  const x = 1;\n  const y = 2;\n  return x + y;\n}',
          rawTokens: 500,
          packedTokens: 100
        }
      ];

      const audit = calculateAudit(files);
      expect(audit.files).toHaveLength(2);
      expect(audit.totalOriginalTokens).toBe(600);
      expect(audit.totalPackedTokens).toBe(200);
      expect(audit.totalSavedTokens).toBe(400);
      expect(audit.overallReductionPercentage).toBe(66.67);
    });

    it('computes tokens automatically when rawTokens/packedTokens are undefined', () => {
      const files: PackedFile[] = [
        {
          filePath: '/repo/src/a.ts',
          relativePath: 'src/a.ts',
          language: 'typescript',
          status: 'SKELETON',
          content: 'export const a: number = 1;',
          rawContent: 'export const a: number = 1;\nexport const b: number = 2;\nexport const c: number = 3;'
        }
      ];

      const audit = calculateAudit(files);
      expect(files[0].rawTokens).toBeDefined();
      expect(files[0].packedTokens).toBeDefined();
      expect(audit.totalOriginalTokens).toBeGreaterThan(audit.totalPackedTokens);
      expect(audit.totalSavedTokens).toBeGreaterThan(0);
    });

    it('handles empty file list without error', () => {
      const audit = calculateAudit([]);
      expect(audit.files).toEqual([]);
      expect(audit.totalOriginalTokens).toBe(0);
      expect(audit.totalPackedTokens).toBe(0);
      expect(audit.totalSavedTokens).toBe(0);
      expect(audit.overallReductionPercentage).toBe(0.0);
    });
  });

  describe('renderComparisonTable', () => {
    it('renders a formatted Unicode box table with all required columns and values', () => {
      const audit = {
        files: [
          { path: 'src/app.ts', status: 'FOCUS' as const, originalTokens: 500, packedTokens: 500, savedTokens: 0, reductionPercentage: 0 },
          { path: 'src/util.ts', status: 'SKELETON' as const, originalTokens: 1000, packedTokens: 200, savedTokens: 800, reductionPercentage: 80 }
        ],
        totalOriginalTokens: 1500,
        totalPackedTokens: 700,
        totalSavedTokens: 800,
        overallReductionPercentage: 53.33
      };

      const table = renderComparisonTable(audit, { noColor: true });
      expect(table).toContain('File Path');
      expect(table).toContain('Status');
      expect(table).toContain('Original Tokens');
      expect(table).toContain('Packed Tokens');
      expect(table).toContain('Tokens Saved');
      expect(table).toContain('Savings %');
      expect(table).toContain('src/app.ts');
      expect(table).toContain('src/util.ts');
      expect(table).toContain('1,500');
      expect(table).toContain('700');
      expect(table).toContain('800');
      expect(table).toContain('53.3%');
      expect(table).toContain('Total (2 files)');
    });

    it('renders clean table when noColor is false or default', () => {
      const audit = {
        files: [
          { path: 'src/main.ts', status: 'FOCUS' as const, originalTokens: 100, packedTokens: 100, savedTokens: 0, reductionPercentage: 0 }
        ],
        totalOriginalTokens: 100,
        totalPackedTokens: 100,
        totalSavedTokens: 0,
        overallReductionPercentage: 0
      };

      const coloredTable = renderComparisonTable(audit, { noColor: false });
      expect(coloredTable).toContain('src/main.ts');
      expect(coloredTable).toContain('Total (1 file)');
    });
  });
});
