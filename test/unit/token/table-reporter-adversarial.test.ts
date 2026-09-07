import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderComparisonTable } from '../../../src/token/table-reporter.js';
import type { ContextPackAudit } from '../../../src/token/types.js';

describe('Adversarial Stress-Testing: Table Reporter', () => {
  const originalEnvNoColor = process.env.NO_COLOR;

  afterEach(() => {
    if (originalEnvNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = originalEnvNoColor;
    }
  });

  const sampleAudit: ContextPackAudit = {
    files: [
      {
        path: 'src/modules/core/very/deeply/nested/service/implementation/component-factory-adapter.ts',
        status: 'FOCUS',
        originalTokens: 12500,
        packedTokens: 12500,
        savedTokens: 0,
        reductionPercentage: 0
      },
      {
        path: 'src/utils.ts',
        status: 'SKELETON',
        originalTokens: 5000000,
        packedTokens: 1500000,
        savedTokens: 3500000,
        reductionPercentage: 70.0
      }
    ],
    totalOriginalTokens: 5012500,
    totalPackedTokens: 1512500,
    totalSavedTokens: 3500000,
    overallReductionPercentage: 69.8
  };

  describe('ANSI Colors and NO_COLOR Flag Handling', () => {
    it('produces zero ANSI escape codes when options.noColor is true', () => {
      delete process.env.NO_COLOR;
      const table = renderComparisonTable(sampleAudit, { noColor: true });
      const ansiRegex = /\x1b\[[0-9;]*m/;
      expect(table).not.toMatch(ansiRegex);
    });

    it('respects process.env.NO_COLOR when options.noColor is not explicitly provided', () => {
      process.env.NO_COLOR = '1';
      const table = renderComparisonTable(sampleAudit);
      const ansiRegex = /\x1b\[[0-9;]*m/;
      expect(table).not.toMatch(ansiRegex);
    });

    it('emits ANSI escape codes when noColor is false', () => {
      delete process.env.NO_COLOR;
      const table = renderComparisonTable(sampleAudit, { noColor: false });
      const ansiRegex = /\x1b\[[0-9;]*m/;
      expect(table).toMatch(ansiRegex);
    });
  });

  describe('Geometric Alignment and Line Width Consistency', () => {
    it('guarantees identical line length across all borders, headers, body rows, and totals (uncolored)', () => {
      const table = renderComparisonTable(sampleAudit, { noColor: true });
      const lines = table.split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(6);
      const expectedWidth = lines[0].length;

      for (let i = 0; i < lines.length; i++) {
        expect(
          lines[i].length,
          `Line ${i} width (${lines[i].length}) does not match expected table width (${expectedWidth}): "${lines[i]}"`
        ).toBe(expectedWidth);
      }
    });

    it('handles extreme filename lengths (150+ characters) without border misalignment', () => {
      const longPathAudit: ContextPackAudit = {
        files: [
          {
            path: 'a'.repeat(160) + '.ts',
            status: 'SKELETON',
            originalTokens: 100,
            packedTokens: 20,
            savedTokens: 80,
            reductionPercentage: 80.0
          }
        ],
        totalOriginalTokens: 100,
        totalPackedTokens: 20,
        totalSavedTokens: 80,
        overallReductionPercentage: 80.0
      };

      const table = renderComparisonTable(longPathAudit, { noColor: true });
      const lines = table.split('\n');
      const expectedWidth = lines[0].length;
      expect(expectedWidth).toBeGreaterThan(170);

      for (const line of lines) {
        expect(line.length).toBe(expectedWidth);
      }
    });

    it('handles Unicode and emoji in file paths with proper row rendering', () => {
      const unicodeAudit: ContextPackAudit = {
        files: [
          {
            path: 'src/🚀-services/日本語/компонент.ts',
            status: 'FOCUS',
            originalTokens: 300,
            packedTokens: 300,
            savedTokens: 0,
            reductionPercentage: 0.0
          }
        ],
        totalOriginalTokens: 300,
        totalPackedTokens: 300,
        totalSavedTokens: 0,
        overallReductionPercentage: 0.0
      };

      expect(() => renderComparisonTable(unicodeAudit, { noColor: true })).not.toThrow();
      const table = renderComparisonTable(unicodeAudit, { noColor: true });
      expect(table).toContain('src/🚀-services/日本語/компонент.ts');
    });
  });

  describe('Degenerate and Edge Case Audits', () => {
    it('handles empty audit with zero files gracefully', () => {
      const emptyAudit: ContextPackAudit = {
        files: [],
        totalOriginalTokens: 0,
        totalPackedTokens: 0,
        totalSavedTokens: 0,
        overallReductionPercentage: 0.0
      };

      const table = renderComparisonTable(emptyAudit, { noColor: true });
      expect(table).toContain('Total (0 files)');
      expect(table).toContain('0.0%');

      const lines = table.split('\n');
      const expectedWidth = lines[0].length;
      for (const line of lines) {
        expect(line.length).toBe(expectedWidth);
      }
    });

    it('formats singular vs plural file labels correctly', () => {
      const singleAudit: ContextPackAudit = {
        files: [
          {
            path: 'single.ts',
            status: 'FOCUS',
            originalTokens: 10,
            packedTokens: 10,
            savedTokens: 0,
            reductionPercentage: 0
          }
        ],
        totalOriginalTokens: 10,
        totalPackedTokens: 10,
        totalSavedTokens: 0,
        overallReductionPercentage: 0
      };

      const table = renderComparisonTable(singleAudit, { noColor: true });
      expect(table).toContain('Total (1 file)');
      expect(table).not.toContain('Total (1 files)');
    });

    it('handles negative token savings and negative percentages cleanly', () => {
      const negativeAudit: ContextPackAudit = {
        files: [
          {
            path: 'bloated.ts',
            status: 'SKELETON',
            originalTokens: 100,
            packedTokens: 200,
            savedTokens: -100,
            reductionPercentage: -100.0
          }
        ],
        totalOriginalTokens: 100,
        totalPackedTokens: 200,
        totalSavedTokens: -100,
        overallReductionPercentage: -100.0
      };

      const table = renderComparisonTable(negativeAudit, { noColor: true });
      expect(table).toContain('-100');
      expect(table).toContain('-100.0%');

      const lines = table.split('\n');
      const expectedWidth = lines[0].length;
      for (const line of lines) {
        expect(line.length).toBe(expectedWidth);
      }
    });

    it('handles missing or undefined fields in audit object', () => {
      const sparseAudit = {
        files: undefined as any,
        totalOriginalTokens: undefined as any,
        totalPackedTokens: undefined as any,
        totalSavedTokens: undefined as any,
        overallReductionPercentage: undefined as any
      };

      expect(() => renderComparisonTable(sparseAudit as any, { noColor: true })).not.toThrow();
      const table = renderComparisonTable(sparseAudit as any, { noColor: true });
      expect(table).toContain('Total (0 files)');
    });
  });
});
