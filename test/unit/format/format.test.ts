import { describe, it, expect } from 'vitest';
import {
  formatMarkdown,
  formatXml,
  formatJson,
  formatContext,
  formatPack,
  getMarkdownCodeFence,
  escapeXmlAttr,
  escapeCdata,
  createAnchorSlug
} from '../../../src/format/index.js';
import type { FormatInput } from '../../../src/format/types.js';

describe('Multi-Format Exporters (src/format/)', () => {
  const sampleInput: FormatInput = {
    files: [
      {
        filePath: '/repo/src/app.ts',
        relativePath: 'src/app.ts',
        language: 'typescript',
        status: 'FOCUS',
        content: 'export class App {\n  public start() { console.log("Running"); }\n}',
        rawContent: 'export class App {\n  public start() { console.log("Running"); }\n}',
        rawTokens: 100,
        packedTokens: 100
      },
      {
        filePath: '/repo/src/util.ts',
        relativePath: 'src/util.ts',
        language: 'typescript',
        status: 'SKELETON',
        content: 'export function helper(): void { /* ... */ }',
        rawContent: 'export function helper(): void { const a = 1; return; }',
        rawTokens: 400,
        packedTokens: 80
      }
    ],
    audit: {
      files: [
        { path: 'src/app.ts', status: 'FOCUS', originalTokens: 100, packedTokens: 100, savedTokens: 0, reductionPercentage: 0 },
        { path: 'src/util.ts', status: 'SKELETON', originalTokens: 400, packedTokens: 80, savedTokens: 320, reductionPercentage: 80 }
      ],
      totalOriginalTokens: 500,
      totalPackedTokens: 180,
      totalSavedTokens: 320,
      overallReductionPercentage: 64.0
    }
  };

  describe('formatMarkdown', () => {
    it('formats context pack with header, metadata summary, and file blocks', () => {
      const md = formatMarkdown(sampleInput);
      expect(md).toContain('# ContextDiet');
      expect(md).toContain('**500** original -> **180** packed');
      expect(md).toContain('**320** tokens saved (**64.0%** reduction)');
      expect(md).toContain('Table of Contents');
      expect(md).toContain('src/app.ts');
      expect(md).toContain('src/util.ts');
      expect(md).toContain('```typescript');
      expect(md).toContain('export class App');
      expect(md).toContain('export function helper');
    });

    it('creates table of contents with anchor tags and status badges', () => {
      const md = formatMarkdown(sampleInput);
      expect(md).toContain('- [src/app.ts](#file-src-app-ts) `[FOCUS]`');
      expect(md).toContain('- [src/util.ts](#file-src-util-ts) `[SKELETON]`');
      expect(md).toContain('<a id="file-src-app-ts"></a>');
      expect(md).toContain('## `src/app.ts` [FOCUS]');
    });

    it('dynamically expands code fences when source code contains triple backticks', () => {
      const input: FormatInput = {
        files: [
          {
            relativePath: 'docs/example.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: 'const snippet = "```markdown\\n# Title\\n```";'
          }
        ]
      };
      const md = formatMarkdown(input);
      expect(md).toContain('````typescript');
      expect(md.endsWith('````\n') || md.includes('````')).toBe(true);
    });

    it('handles empty files gracefully', () => {
      const md = formatMarkdown({ files: [] });
      expect(md).toContain('# ContextDiet');
      expect(md).toContain('_No files included in context pack._');
    });
  });

  describe('formatXml', () => {
    it('produces valid XML with context_pack root, metadata, and CDATA encapsulated files', () => {
      const xml = formatXml(sampleInput);
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<context_pack version="1.0" generator="contextdiet" total_files="2"');
      expect(xml).toContain('</context_pack>');
      expect(xml).toContain('<original_tokens>500</original_tokens>');
      expect(xml).toContain('<packed_tokens>180</packed_tokens>');
      expect(xml).toContain('<tokens_saved>320</tokens_saved>');
      expect(xml).toContain('<file path="src/app.ts" language="typescript" status="FOCUS">');
      expect(xml).toContain('<![CDATA[');
      expect(xml).toContain('export class App');
      expect(xml).toContain(']]>');
      expect(xml).toContain('</file>');
    });

    it('escapes internal ]]> sequences in CDATA safely', () => {
      const trickyInput: FormatInput = {
        files: [
          {
            relativePath: 'cdata.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: 'const marker = "]]>";'
          }
        ]
      };
      const xml = formatXml(trickyInput);
      expect(xml).toContain(']]]]><![CDATA[>');
    });

    it('escapes XML attribute special characters properly', () => {
      const trickyAttrInput: FormatInput = {
        files: [
          {
            relativePath: 'src/weird & "quote" <tag>.ts',
            language: 'other',
            status: 'SKELETON',
            content: '// test'
          }
        ]
      };
      const xml = formatXml(trickyAttrInput);
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;');
      expect(xml).toContain('&lt;');
      expect(xml).toContain('&gt;');
    });
  });

  describe('formatJson', () => {
    it('produces strictly valid JSON matching schema with metrics and files', () => {
      const jsonStr = formatJson(sampleInput);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.generator).toBe('contextdiet');
      expect(parsed.timestamp).toBeDefined();

      expect(parsed.metrics.totalFiles).toBe(2);
      expect(parsed.metrics.focusedFiles).toBe(1);
      expect(parsed.metrics.skeletonFiles).toBe(1);
      expect(parsed.metrics.originalTokens).toBe(500);
      expect(parsed.metrics.packedTokens).toBe(180);
      expect(parsed.metrics.savedTokens).toBe(320);
      expect(parsed.metrics.reductionPercentage).toBe(64.0);

      expect(parsed.files).toHaveLength(2);
      expect(parsed.files[0].path).toBe('src/app.ts');
      expect(parsed.files[0].status).toBe('FOCUS');
      expect(parsed.files[0].originalTokens).toBe(100);
      expect(parsed.files[1].path).toBe('src/util.ts');
      expect(parsed.files[1].status).toBe('SKELETON');
      expect(parsed.files[1].originalTokens).toBe(400);
    });

    it('handles input without explicit audit by computing baseline metrics', () => {
      const jsonStr = formatJson({
        files: [
          {
            relativePath: 'test.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: 'const x = 1;',
            rawTokens: 10,
            packedTokens: 10
          }
        ]
      });
      const parsed = JSON.parse(jsonStr);
      expect(parsed.metrics.totalFiles).toBe(1);
      expect(parsed.files[0].path).toBe('test.ts');
    });
  });

  describe('formatContext and formatPack router', () => {
    it('routes md, xml, and json accurately', () => {
      const md = formatContext('md', sampleInput);
      expect(md).toContain('# ContextDiet');

      const xml = formatContext('xml', sampleInput);
      expect(xml).toContain('<context_pack');

      const json = formatContext('json', sampleInput);
      expect(JSON.parse(json)).toHaveProperty('metrics');

      const packMd = formatPack('markdown', sampleInput);
      expect(packMd).toContain('# ContextDiet');
    });

    it('throws error for unsupported format string', () => {
      expect(() => formatContext('yaml' as any, sampleInput)).toThrow(
        /Unsupported output format: "yaml"/
      );
    });
  });

  describe('Helper utilities', () => {
    it('getMarkdownCodeFence returns appropriate backtick counts', () => {
      expect(getMarkdownCodeFence('')).toBe('```');
      expect(getMarkdownCodeFence('const a = 1;')).toBe('```');
      expect(getMarkdownCodeFence('```ts\ncode\n```')).toBe('````');
      expect(getMarkdownCodeFence('````ts\ncode\n````')).toBe('`````');
    });

    it('escapeXmlAttr escapes all XML entities', () => {
      expect(escapeXmlAttr('a & b < c > d "e" \'f\'')).toBe(
        'a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;'
      );
      expect(escapeXmlAttr(undefined)).toBe('');
    });

    it('escapeCdata escapes embedded terminators', () => {
      expect(escapeCdata('hello ]]> world')).toBe('hello ]]]]><![CDATA[> world');
      expect(escapeCdata(undefined)).toBe('');
    });

    it('createAnchorSlug converts paths to clean kebab slugs', () => {
      expect(createAnchorSlug('src/components/Button.tsx')).toBe('file-src-components-button-tsx');
    });
  });
});
