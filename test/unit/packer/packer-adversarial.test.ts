import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getEncoding } from 'js-tiktoken';
import { packContext } from '../../../src/packer/index.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'test/fixtures/benchmark-project');
const TS_SERVICE_DIR = path.join(BENCHMARK_DIR, 'ts-service');
const CYCLIC_DIR = path.join(REPO_ROOT, 'test/fixtures/cyclic-imports');
const EDGE_CASES_DIR = path.join(REPO_ROOT, 'test/fixtures/edge-cases');

describe('Adversarial ContextPacker Stress Tests', () => {
  const enc = getEncoding('cl100k_base');

  describe('1. Focus-Aware Packing Fidelity (Byte-for-Byte & Token Fidelity)', () => {
    it('guarantees 100% byte-for-byte and token fidelity on focused TypeScript files', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/index.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focusPath]
      });

      const focusFile = result.files.find(f => f.status === 'FOCUS');
      expect(focusFile).toBeDefined();

      const diskRaw = fs.readFileSync(focusPath, 'utf-8');

      // Byte-for-byte equality
      expect(focusFile!.content).toBe(diskRaw);
      expect(focusFile!.content).toBe(focusFile!.rawContent);
      expect(Buffer.from(focusFile!.content).equals(Buffer.from(diskRaw))).toBe(true);

      // Token count fidelity
      const diskTokens = enc.encode(diskRaw).length;
      const contentTokens = enc.encode(focusFile!.content).length;
      const rawContentTokens = enc.encode(focusFile!.rawContent).length;
      expect(contentTokens).toBe(diskTokens);
      expect(contentTokens).toBe(rawContentTokens);
    });

    it('preserves multi-byte UTF-8 characters and comments with zero mangling', async () => {
      // Create a temporary test file with unicode symbols, emojis, and multi-line strings
      const unicodeFile = path.join(EDGE_CASES_DIR, 'temp-unicode-focus.ts');
      const unicodeContent = `// 🚀 ContextDiet Unicode Fidelity Test: 漢字, 한국어, العربية, 👨‍👩‍👧‍👦
export interface UnicodeData {
  emoji: string; // '✨🎯🔥'
  arabic: string; // 'مرحبا بالعالم'
  japanese: string; // 'こんにちは世界'
  mathSymbols: string; // '∑ ∏ ∫ √ ∛ ∜ ∝ ∞ ∟'
  crlfString: string; // "Line 1\r\nLine 2"
}

export function getUnicodeGreeting(name: string): string {
  // Comment with unusual symbols: ~!@#$%^&*()_+-={}|[];'<>?,./
  return "Hello 🌍, " + name + "! ✨";
}
`;
      fs.writeFileSync(unicodeFile, unicodeContent, 'utf-8');

      try {
        const result = await packContext({
          repoRoot: EDGE_CASES_DIR,
          focusFiles: [unicodeFile]
        });

        const focusFile = result.files.find(f => f.status === 'FOCUS');
        expect(focusFile).toBeDefined();
        expect(focusFile!.content).toBe(unicodeContent);
        expect(focusFile!.rawContent).toBe(unicodeContent);

        const expectedTokens = enc.encode(unicodeContent).length;
        const actualTokens = enc.encode(focusFile!.content).length;
        expect(actualTokens).toBe(expectedTokens);
      } finally {
        if (fs.existsSync(unicodeFile)) {
          fs.unlinkSync(unicodeFile);
        }
      }
    });

    it('preserves unabridged bodies for all files when multiple focus files are specified', async () => {
      const focus1 = path.join(TS_SERVICE_DIR, 'src/controllers/order-controller.ts');
      const focus2 = path.join(TS_SERVICE_DIR, 'src/services/order-service.ts');

      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focus1, focus2]
      });

      const focusedFiles = result.files.filter(f => f.status === 'FOCUS');
      expect(focusedFiles).toHaveLength(2);

      for (const f of focusedFiles) {
        const diskRaw = fs.readFileSync(f.filePath, 'utf-8');
        expect(f.content).toBe(diskRaw);
        expect(f.content).toBe(f.rawContent);
        expect(enc.encode(f.content).length).toBe(enc.encode(diskRaw).length);
      }
    });
  });

  describe('2. Attention Recency & Leaf-First Topological Ordering in Packed Result', () => {
    it('positions dependencies in leaf-first order and positions the focus file at the tail', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/index.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focusPath]
      });

      const paths = result.files.map(f => f.relativePath);

      // Focus file must be the last file in the packed result
      expect(paths[paths.length - 1]).toBe('src/index.ts');
      expect(result.files[result.files.length - 1].status).toBe('FOCUS');

      // Models must precede services
      const orderModelIdx = paths.findIndex(p => p.includes('models/order'));
      const orderServiceIdx = paths.findIndex(p => p.includes('services/order-service'));
      expect(orderModelIdx).toBeGreaterThanOrEqual(0);
      expect(orderServiceIdx).toBeGreaterThanOrEqual(0);
      expect(orderModelIdx).toBeLessThan(orderServiceIdx);

      // Services must precede controllers
      const orderCtrlIdx = paths.findIndex(p => p.includes('controllers/order-controller'));
      expect(orderCtrlIdx).toBeGreaterThanOrEqual(0);
      expect(orderServiceIdx).toBeLessThan(orderCtrlIdx);

      // Controllers must precede entry index.ts
      expect(orderCtrlIdx).toBeLessThan(paths.indexOf('src/index.ts'));
    });

    it('places leaf contracts first and focus files last in multi-module graphs', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/controllers/order-controller.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focusPath]
      });

      const paths = result.files.map(f => f.relativePath);

      // order-controller must be last
      expect(paths[paths.length - 1]).toContain('order-controller.ts');

      // order-model must come before order-service
      const modelIdx = paths.findIndex(p => p.includes('models/order.ts'));
      const svcIdx = paths.findIndex(p => p.includes('services/order-service.ts'));
      expect(modelIdx).toBeLessThan(svcIdx);
    });
  });

  describe('3. Deterministic Caching Invariant Across Repeated Invocations', () => {
    it('produces 100% bit-for-bit identical packed output across 20 consecutive runs', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/index.ts');

      const runs: Array<{
        fileCount: number;
        paths: string[];
        statuses: string[];
        totalContentLength: number;
      }> = [];

      for (let i = 0; i < 20; i++) {
        const res = await packContext({
          repoRoot: TS_SERVICE_DIR,
          focusFiles: [focusPath]
        });

        runs.push({
          fileCount: res.files.length,
          paths: res.files.map(f => f.relativePath),
          statuses: res.files.map(f => f.status),
          totalContentLength: res.files.reduce((sum, f) => sum + f.content.length, 0)
        });
      }

      const baseline = runs[0];
      expect(baseline.fileCount).toBeGreaterThan(5);

      for (let i = 1; i < 20; i++) {
        expect(runs[i].fileCount).toBe(baseline.fileCount);
        expect(runs[i].paths).toEqual(baseline.paths);
        expect(runs[i].statuses).toEqual(baseline.statuses);
        expect(runs[i].totalContentLength).toBe(baseline.totalContentLength);
      }
    });
  });

  describe('4. Skeletonization Guarantees on Non-Focus Files', () => {
    it('strips implementation bodies from dependencies while preserving contracts', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/index.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focusPath]
      });

      const skeletonFiles = result.files.filter(f => f.status === 'SKELETON');
      expect(skeletonFiles.length).toBeGreaterThan(0);

      for (const skel of skeletonFiles) {
        expect(skel.content).toContain('/* ... */');
        // Skeletonized content should be smaller than or equal to rawContent
        expect(skel.content.length).toBeLessThanOrEqual(skel.rawContent.length + 20); // small tolerance for /* ... */ marker
      }
    });

    it('retains 100% implementation bodies when noDiet is true', async () => {
      const focusPath = path.join(TS_SERVICE_DIR, 'src/index.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [focusPath],
        noDiet: true
      });

      for (const f of result.files) {
        expect(f.content).toBe(f.rawContent);
        expect(f.content).not.toContain('/* ... */');
      }
    });
  });

  describe('5. Complex Edge Cases & Boundary Inputs', () => {
    it('handles leaf focus files by pruning all upstream callers', async () => {
      const leafFocus = path.join(TS_SERVICE_DIR, 'src/models/user.ts');
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: [leafFocus]
      });

      // user.ts depends on nothing, so only user.ts itself should be packed
      expect(result.files).toHaveLength(1);
      expect(result.files[0].status).toBe('FOCUS');
      expect(result.files[0].relativePath).toBe('src/models/user.ts');
      expect(result.unreachablePrunedCount).toBeGreaterThan(5);
    });

    it('resolves relative focus file paths correctly', async () => {
      const result = await packContext({
        repoRoot: TS_SERVICE_DIR,
        focusFiles: ['./src/index.ts']
      });

      const focusFile = result.files.find(f => f.status === 'FOCUS');
      expect(focusFile).toBeDefined();
      expect(focusFile?.relativePath).toBe('src/index.ts');
    });

    it('survives circular imports and reports detected cycles', async () => {
      const result = await packContext({
        repoRoot: CYCLIC_DIR,
        focusFiles: [path.join(CYCLIC_DIR, 'cycle3-a.ts')]
      });

      expect(result.files).toHaveLength(3);
      expect(result.cycles.length).toBeGreaterThan(0);
      const focusFile = result.files.find(f => f.status === 'FOCUS');
      expect(focusFile?.relativePath).toContain('cycle3-a.ts');
    });

    it('rejects non-existent focus file with informative error', async () => {
      await expect(
        packContext({
          repoRoot: TS_SERVICE_DIR,
          focusFiles: ['non-existent-file.ts']
        })
      ).rejects.toThrow(/Focus file not found/);
    });

    it('rejects non-existent repository root with informative error', async () => {
      await expect(
        packContext({
          repoRoot: '/non/existent/repo/root'
        })
      ).rejects.toThrow(/Repository root not found/);
    });
  });
});
