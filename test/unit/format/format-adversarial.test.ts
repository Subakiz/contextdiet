import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import {
  formatMarkdown,
  formatXml,
  formatJson,
  formatContext,
  getMarkdownCodeFence,
  escapeXmlAttr,
  escapeCdata,
  createAnchorSlug
} from '../../../src/format/index.js';
import type { FormatInput } from '../../../src/format/types.js';

function validateXmlWellFormedness(xmlString: string): void {
  execFileSync(
    'python3',
    ['-c', 'import xml.etree.ElementTree as ET, sys; ET.fromstring(sys.stdin.read())'],
    { input: xmlString, encoding: 'utf-8' }
  );
}

describe('Adversarial Stress-Testing: Multi-Format Exporters', () => {
  describe('Markdown Formatter Adversarial Cases', () => {
    it('handles code with deeply nested backticks (up to 12 backticks)', () => {
      const codeWithBackticks = [
        '```markdown',
        '````markdown',
        '`````markdown',
        '````````````',
        'const literal = "``````";',
        '````'
      ].join('\n');

      const fence = getMarkdownCodeFence(codeWithBackticks);
      // Max backticks is 12, so fence must be at least 13
      expect(fence.length).toBeGreaterThanOrEqual(13);
      expect(fence).toBe('`'.repeat(13));

      const input: FormatInput = {
        files: [
          {
            relativePath: 'nested-ticks.md',
            language: 'markdown',
            status: 'FOCUS',
            content: codeWithBackticks
          }
        ]
      };

      const md = formatMarkdown(input);
      expect(md).toContain('`````````````markdown');
      expect(md.endsWith('`````````````\n') || md.endsWith('`````````````')).toBe(true);
    });

    it('handles pathological paths with special characters in TOC anchors', () => {
      const paths = [
        'src/components/🚀-rocket.ts',
        'src/weird & special / <tag> / "quotes" / file [1].ts',
        'src/spaces in path/file.py',
        'src/path.with.many.dots.and-dashes_underscores.go'
      ];

      for (const p of paths) {
        const slug = createAnchorSlug(p);
        // Slugs must only contain safe alphanumeric, dash, underscore
        expect(slug).toMatch(/^file-[a-z0-9_-]+$/);
      }

      const input: FormatInput = {
        files: paths.map(p => ({
          relativePath: p,
          language: 'typescript',
          status: 'FOCUS',
          content: 'export const x = 1;'
        }))
      };

      const md = formatMarkdown(input);
      for (const p of paths) {
        const slug = createAnchorSlug(p);
        expect(md).toContain(`[${p}](#${slug})`);
        expect(md).toContain(`<a id="${slug}"></a>`);
      }
    });

    it('handles completely empty input (no files, no audit)', () => {
      const md = formatMarkdown({ files: [] });
      expect(md).toContain('# ContextDiet');
      expect(md).toContain('_No files included in context pack._');
      expect(md).toContain('**0** original -> **0** packed');
    });

    it('handles files with empty or undefined content', () => {
      const input: FormatInput = {
        files: [
          {
            relativePath: 'empty.ts',
            language: 'typescript',
            status: 'SKELETON',
            content: ''
          },
          {
            relativePath: 'nil.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: undefined as any
          }
        ]
      };

      const md = formatMarkdown(input);
      expect(md).toContain('## `empty.ts` [SKELETON]');
      expect(md).toContain('## `nil.ts` [FOCUS]');
    });
  });

  describe('XML Formatter Adversarial Cases', () => {
    it('handles multiple consecutive and nested CDATA terminators (]]>]]>]]>) safely', () => {
      const rawContent = 'const a = "]]>"; const b = "]]>]]>"; const c = "]]]]><![CDATA[>";';
      const escaped = escapeCdata(rawContent);

      // In XML CDATA splitting, any embedded ']]>' becomes ']]]]><![CDATA[>'
      // Every ']]>' is split so no unescaped CDATA boundary exists
      expect(escaped).toContain(']]]]><![CDATA[>');
      expect(rawContent.replace(/\]\]>/g, ']]]]><![CDATA[>')).toBe(escaped);

      const input: FormatInput = {
        files: [
          {
            relativePath: 'cdata-stress.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: rawContent
          }
        ]
      };

      const xml = formatXml(input);
      expect(xml).toContain('<context_pack');
      expect(xml).toContain('</context_pack>');
      expect(xml).toContain('<file path="cdata-stress.ts"');
      expect(xml).toContain('</file>');

      // Verify the generated XML parses successfully with standard XML parser
      expect(() => validateXmlWellFormedness(xml)).not.toThrow();
    });

    it('handles unclosed tags, malformed XML, and raw HTML inside code content', () => {
      const malformedCode = [
        '<div class="unclosed">',
        '  <span style="color:red">',
        '  <input type="text" value="unclosed attribute>',
        '  <!-- unclosed comment',
        '  <?unclosed processing instruction',
        '  <weird <tag <syntax>',
        '  &amp; & < > " \'',
        '  </unexpected_closing_tag>'
      ].join('\n');

      const input: FormatInput = {
        files: [
          {
            relativePath: 'malformed.html',
            language: 'html',
            status: 'FOCUS',
            content: malformedCode
          }
        ]
      };

      const xml = formatXml(input);
      // Verify the CDATA wrapper encloses the malformed markup intact
      expect(xml).toContain('<![CDATA[');
      expect(xml).toContain(malformedCode);
      expect(xml).toContain(']]>');
      expect(xml).toContain('</file>');
      expect(xml).toContain('</context_pack>');

      // Verify well-formedness of the full XML document
      expect(() => validateXmlWellFormedness(xml)).not.toThrow();
    });

    it('escapes all special characters in XML attributes (path, language, status)', () => {
      const rawPath = 'dir & subdir / <module> / "test" / \'single\' / file.ts';
      const escapedPath = escapeXmlAttr(rawPath);

      expect(escapedPath).not.toContain('& ');
      expect(escapedPath).toContain('&amp;');
      expect(escapedPath).not.toContain('<');
      expect(escapedPath).toContain('&lt;');
      expect(escapedPath).not.toContain('>');
      expect(escapedPath).toContain('&gt;');
      expect(escapedPath).not.toContain('"');
      expect(escapedPath).toContain('&quot;');
      expect(escapedPath).not.toContain("'");
      expect(escapedPath).toContain('&apos;');

      const input: FormatInput = {
        files: [
          {
            relativePath: rawPath,
            language: 'type<script>&"extra"' as any,
            status: 'FOCUS',
            content: 'export const ok = true;'
          }
        ]
      };

      const xml = formatXml(input);
      expect(xml).toContain(`path="${escapedPath}"`);
      expect(xml).toContain('language="type&lt;script&gt;&amp;&quot;extra&quot;"');

      // Verify XML validity
      expect(() => validateXmlWellFormedness(xml)).not.toThrow();
    });

    it('handles empty files and missing metadata gracefully', () => {
      const xml = formatXml({ files: [] });
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<context_pack version="1.0" generator="contextdiet" total_files="0"');
      expect(xml).toContain('<files>');
      expect(xml).toContain('</files>');
      expect(xml).toContain('</context_pack>');

      expect(() => validateXmlWellFormedness(xml)).not.toThrow();
    });
  });

  describe('JSON Formatter Adversarial Cases', () => {
    it('produces 100% valid JSON parseable by JSON.parse() on complex adversarial inputs', () => {
      const complexContent = JSON.stringify({
        nestedJson: '{"key": "value", "escaped": "\\\"quote\\\""}',
        code: 'function escape(): string { return "\n\t\r\\\""; }',
        unicode: '🚀 日本語 العربية \u0000 \u001F',
        cdata: ']]><![CDATA[>'
      });

      const input: FormatInput = {
        files: [
          {
            relativePath: 'complex.json',
            language: 'json',
            status: 'FOCUS',
            content: complexContent,
            rawTokens: 150,
            packedTokens: 150
          }
        ]
      };

      const jsonStr = formatJson(input);
      expect(() => JSON.parse(jsonStr)).not.toThrow();

      const parsed = JSON.parse(jsonStr);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.metrics.totalFiles).toBe(1);
      expect(parsed.files[0].content).toBe(complexContent);
    });

    it('handles undefined or null properties in FormatInput without throwing', () => {
      const input: FormatInput = {
        files: [
          {
            filePath: undefined as any,
            relativePath: undefined as any,
            language: undefined as any,
            status: undefined as any,
            content: undefined as any
          }
        ],
        audit: undefined
      };

      expect(() => formatJson(input)).not.toThrow();
      const parsed = JSON.parse(formatJson(input));
      expect(parsed.metrics.totalFiles).toBe(1);
      expect(parsed.files[0].path).toBe('');
      expect(parsed.files[0].content).toBe('');
    });
  });

  describe('formatContext and formatPack Router Adversarial Cases', () => {
    it('handles case-insensitive format options', () => {
      const input: FormatInput = { files: [] };
      expect(() => formatContext('MD' as any, input)).not.toThrow();
      expect(() => formatContext('Xml' as any, input)).not.toThrow();
      expect(() => formatContext('JSON' as any, input)).not.toThrow();
    });

    it('rejects unsupported or dangerous format injections', () => {
      const input: FormatInput = { files: [] };
      expect(() => formatContext('../../../etc/passwd' as any, input)).toThrow();
      expect(() => formatContext('yaml' as any, input)).toThrow();
      expect(() => formatContext('html' as any, input)).toThrow();
    });
  });
});
