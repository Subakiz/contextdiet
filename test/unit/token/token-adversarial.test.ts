import { describe, it, expect } from 'vitest';
import {
  TiktokenEstimator,
  countTokens,
  calculateFileMetric,
  calculateAudit
} from '../../../src/token/index.js';
import type { PackedFile } from '../../../src/types.js';

describe('Adversarial Stress-Testing: Token Estimation Engine', () => {
  const estimator = new TiktokenEstimator();

  describe('Special Tokens Stress-Testing', () => {
    it('handles all standard OpenAI cl100k special tokens safely', () => {
      const specialTokens = [
        '<|endoftext|>',
        '<|fim_prefix|>',
        '<|fim_middle|>',
        '<|fim_suffix|>',
        '<|endofprompt|>'
      ];

      for (const token of specialTokens) {
        expect(() => estimator.countTokens(token)).not.toThrow();
        const count = estimator.countTokens(token);
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });

    it('handles repeated special tokens without memory leak or crash', () => {
      const repeated = '<|endoftext|> '.repeat(200);
      expect(() => estimator.countTokens(repeated)).not.toThrow();
      const count = estimator.countTokens(repeated);
      expect(count).toBeGreaterThanOrEqual(200);
    });

    it('handles non-cl100k special-token syntax (e.g. chatml tags)', () => {
      const text = '<|im_start|>system\nYou are a helpful assistant.<|im_end|>\n<|im_start|>user\nHi!<|im_end|>';
      expect(() => estimator.countTokens(text)).not.toThrow();
      const count = estimator.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });

    it('handles partial / malformed special token delimiters', () => {
      const text = '<| |> <||> <|endof <|fim_ <|fim_prefix |>endoftext|>';
      expect(() => estimator.countTokens(text)).not.toThrow();
      const count = estimator.countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Empty, Boundary, and Degenerate Inputs', () => {
    it('returns 0 for empty string, whitespaces, and falsy/non-string values', () => {
      expect(estimator.countTokens('')).toBe(0);
      expect(estimator.countTokens('   \t\t\r\n\n  ')).toBeGreaterThan(0); // whitespace has tokens in BPE
      expect(estimator.countTokens(null as any)).toBe(0);
      expect(estimator.countTokens(undefined as any)).toBe(0);
      expect(estimator.countTokens(0 as any)).toBe(0);
      expect(estimator.countTokens({} as any)).toBe(0);
      expect(estimator.countTokens([] as any)).toBe(0);
      expect(estimator.countTokens(NaN as any)).toBe(0);
      expect(estimator.countTokens(true as any)).toBe(0);
    });

    it('handles zero-width and invisible Unicode characters', () => {
      const text = '\u200B\u200C\u200D\uFEFF';
      expect(() => estimator.countTokens(text)).not.toThrow();
      const count = estimator.countTokens(text);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Massive Text & Performance Stress-Testing', () => {
    it('processes 10,000 words (50KB) of text rapidly', () => {
      const massive = 'contextdiet repository optimizer token estimation test '.repeat(1000);
      const start = Date.now();
      const count = estimator.countTokens(massive);
      const duration = Date.now() - start;

      expect(count).toBeGreaterThan(5000);
      expect(duration).toBeLessThan(1000);
    });

    it('processes 1,000 lines of typical source code within acceptable timeout', () => {
      const lines = Array.from({ length: 1000 }, (_, i) =>
        `export function handler_${i}(req: Request, res: Response): Promise<void> { return process(req, ${i}); }`
      ).join('\n');

      const start = Date.now();
      const count = estimator.countTokens(lines);
      const duration = Date.now() - start;

      expect(count).toBeGreaterThan(2000);
      expect(duration).toBeLessThan(1500);
    });

    it('processes unbroken strings and repetitive newlines safely', () => {
      const unbroken = 'a'.repeat(1000);
      expect(() => estimator.countTokens(unbroken)).not.toThrow();
      expect(estimator.countTokens(unbroken)).toBeGreaterThan(0);

      const newlines = '\n'.repeat(1000);
      expect(() => estimator.countTokens(newlines)).not.toThrow();
      expect(estimator.countTokens(newlines)).toBeGreaterThan(0);
    });
  });

  describe('Unicode, Emojis, and Polyglot Stress-Testing', () => {
    it('accurately counts complex multi-codepoint emojis with ZWJ sequences', () => {
      const emojis = '👨‍👩‍👧‍👦 👩🏽‍💻 🏳️‍🌈 🧑🏾‍🚀 ⚡️🔥🚀✨🎉';
      expect(() => estimator.countTokens(emojis)).not.toThrow();
      const count = estimator.countTokens(emojis);
      expect(count).toBeGreaterThan(5);
    });

    it('handles diverse multilingual scripts (CJK, Arabic, Hebrew, Cyrillic, Devanagari)', () => {
      const polyglot = [
        '日本語のテストコード: function 計算(価格: number): number { return 価格 * 1.1; }',
        '中文测试: const 状态 = "成功";',
        'العربية: مرحبا بكم في ContextDiet لتحسين السياق',
        'עברית: שלום עולם בדיקת ביצועים',
        'Русский: Функция проверки синтаксического дерева',
        'हिन्दी: प्रसंग संपीड़न और टोकन अनुकूलन'
      ].join('\n');

      expect(() => estimator.countTokens(polyglot)).not.toThrow();
      const count = estimator.countTokens(polyglot);
      expect(count).toBeGreaterThan(30);
    });

    it('handles Zalgo text and combining diacritical marks', () => {
      const zalgo = 'Z̸̖͋a̸̦͛ľ̶̳ģ̵̂ò̶͍ ̵̡͌ț̸̌e̸͈̎x̴̙͋t̸̛̥ ̸̦͝t̸̔ͅé̶͜š̸̳ţ̶̅';
      expect(() => estimator.countTokens(zalgo)).not.toThrow();
      const count = estimator.countTokens(zalgo);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Adversarial calculateFileMetric & calculateAudit', () => {
    it('handles negative or invalid number inputs', () => {
      const metric = calculateFileMetric('bad.ts', 'SKELETON', -100, -50);
      expect(metric.originalTokens).toBe(0);
      expect(metric.packedTokens).toBe(0);
      expect(metric.savedTokens).toBe(0);
      expect(metric.reductionPercentage).toBe(0.0);
    });

    it('handles packed tokens greater than original tokens (negative savings)', () => {
      const metric = calculateFileMetric('bloated.ts', 'SKELETON', 100, 150);
      expect(metric.originalTokens).toBe(100);
      expect(metric.packedTokens).toBe(150);
      expect(metric.savedTokens).toBe(-50);
      expect(metric.reductionPercentage).toBe(-50.0);
    });

    it('handles extreme integer token numbers without overflow', () => {
      const metric = calculateFileMetric('huge.ts', 'SKELETON', 10_000_000, 4_000_000);
      expect(metric.originalTokens).toBe(10_000_000);
      expect(metric.packedTokens).toBe(4_000_000);
      expect(metric.savedTokens).toBe(6_000_000);
      expect(metric.reductionPercentage).toBe(60.0);
    });

    it('calculates audit when file content is undefined or empty', () => {
      const files: PackedFile[] = [
        {
          filePath: '/repo/empty.ts',
          relativePath: 'empty.ts',
          language: 'typescript',
          status: 'SKELETON',
          content: '',
          rawContent: ''
        },
        {
          filePath: '/repo/nil.ts',
          relativePath: 'nil.ts',
          language: 'other',
          status: 'FOCUS',
          content: undefined as any,
          rawContent: undefined as any
        }
      ];

      const audit = calculateAudit(files);
      expect(audit.totalOriginalTokens).toBe(0);
      expect(audit.totalPackedTokens).toBe(0);
      expect(audit.totalSavedTokens).toBe(0);
      expect(audit.overallReductionPercentage).toBe(0.0);
    });

    it('correctly aggregates high file counts (100+ files)', () => {
      const files: PackedFile[] = Array.from({ length: 150 }, (_, i) => ({
        filePath: `/repo/file_${i}.ts`,
        relativePath: `file_${i}.ts`,
        language: 'typescript',
        status: i % 2 === 0 ? 'FOCUS' : 'SKELETON',
        content: `export const val_${i} = ${i};`,
        rawContent: `export const val_${i} = ${i};\n// Extra comment line\nconst internal_${i} = ${i};`,
        rawTokens: 100,
        packedTokens: i % 2 === 0 ? 100 : 30
      }));

      const audit = calculateAudit(files);
      expect(audit.files).toHaveLength(150);
      expect(audit.totalOriginalTokens).toBe(150 * 100);
      // 75 focus at 100 = 7500, 75 skeleton at 30 = 2250 -> total 9750
      expect(audit.totalPackedTokens).toBe(75 * 100 + 75 * 30);
      expect(audit.totalSavedTokens).toBe(15000 - 9750);
      expect(audit.overallReductionPercentage).toBeCloseTo(35.0, 1);
    });
  });
});
