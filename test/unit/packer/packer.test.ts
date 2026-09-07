import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { packContext } from '../../../src/packer/index.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'test/fixtures/benchmark-project');
const CYCLIC_DIR = path.join(REPO_ROOT, 'test/fixtures/cyclic-imports');
const ALIAS_DIR = path.join(REPO_ROOT, 'test/fixtures/alias-imports');
const EDGE_CASES_DIR = path.join(REPO_ROOT, 'test/fixtures/edge-cases');

describe('ContextPacker (packContext)', () => {
  describe('Focus-Driven Mode', () => {
    it('preserves 100% unabridged source code for focus file', async () => {
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const result = await packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });

      const focusFile = result.files.find(f => f.status === 'FOCUS');
      expect(focusFile).toBeDefined();
      const rawOnDisk = fs.readFileSync(focusPath, 'utf-8');
      expect(focusFile?.content).toBe(rawOnDisk);
    });

    it('skeletonizes direct and transitive dependencies', async () => {
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const result = await packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });

      const skeletonFiles = result.files.filter(f => f.status === 'SKELETON');
      expect(skeletonFiles.length).toBeGreaterThan(0);
      skeletonFiles.forEach(f => {
        expect(f.content).toContain('/* ... */');
      });
    });

    it('prunes unreachable repository files when focus is specified', async () => {
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/models/user.ts');
      const result = await packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });

      const relPaths = result.files.map(f => f.relativePath);
      expect(relPaths.some(p => p.includes('order-controller'))).toBe(false);
      expect(result.unreachablePrunedCount).toBeGreaterThan(0);
    });

    it('supports multiple focus files simultaneously', async () => {
      const focus1 = path.join(BENCHMARK_DIR, 'ts-service/src/models/user.ts');
      const focus2 = path.join(BENCHMARK_DIR, 'ts-service/src/models/order.ts');
      const result = await packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focus1, focus2]
      });

      const focused = result.files.filter(f => f.status === 'FOCUS');
      expect(focused).toHaveLength(2);
    });
  });

  describe('Whole-Repository Fallback Mode', () => {
    it('marks all repository files as SKELETON when focus is omitted', async () => {
      const result = await packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service')
      });

      expect(result.files.length).toBeGreaterThan(5);
      expect(result.files.every(f => f.status === 'SKELETON')).toBe(true);
      expect(result.unreachablePrunedCount).toBe(0);
    });
  });

  describe('Diet Options & Edge Cases', () => {
    it('disables skeletonization when noDiet is true', async () => {
      const focusPath = path.join(CYCLIC_DIR, 'cycle2-a.ts');
      const result = await packContext({
        repoRoot: CYCLIC_DIR,
        focusFiles: [focusPath],
        noDiet: true
      });

      const skelFile = result.files.find(f => f.relativePath.includes('cycle2-b.ts'));
      expect(skelFile).toBeDefined();
      const rawB = fs.readFileSync(path.join(CYCLIC_DIR, 'cycle2-b.ts'), 'utf-8');
      expect(skelFile?.content).toBe(rawB);
    });

    it('handles empty files without crashing', async () => {
      const result = await packContext({
        repoRoot: EDGE_CASES_DIR,
        focusFiles: [path.join(EDGE_CASES_DIR, 'empty.ts')]
      });

      const file = result.files.find(f => f.relativePath.endsWith('empty.ts'));
      expect(file).toBeDefined();
      expect(file?.content).toBe('');
    });

    it('throws when focus file does not exist', async () => {
      await expect(
        packContext({
          repoRoot: BENCHMARK_DIR,
          focusFiles: ['nonexistent.ts']
        })
      ).rejects.toThrow('Focus file not found');
    });

    it('throws when repoRoot does not exist', async () => {
      await expect(
        packContext({
          repoRoot: '/nonexistent/path/for/contextdiet'
        })
      ).rejects.toThrow('Repository root not found');
    });

    it('packs circular import projects safely', async () => {
      const result = await packContext({
        repoRoot: CYCLIC_DIR,
        focusFiles: [path.join(CYCLIC_DIR, 'cycle3-a.ts')]
      });

      expect(result.files).toHaveLength(3);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it('packs tsconfig alias projects resolving @/*', async () => {
      const result = await packContext({
        repoRoot: ALIAS_DIR,
        focusFiles: [path.join(ALIAS_DIR, 'src/components/button.ts')]
      });

      const names = result.files.map(f => path.basename(f.relativePath));
      expect(names).toContain('button.ts');
      expect(names).toContain('math.ts');
    });
  });
});
