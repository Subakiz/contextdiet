import { describe, it, expect } from 'vitest';
import path from 'path';
import { FilterEngine } from '../../../src/filter/index.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const IGNORE_TEST_DIR = path.join(REPO_ROOT, 'test/fixtures/ignore-test');
const EDGE_CASES_DIR = path.join(REPO_ROOT, 'test/fixtures/edge-cases');

describe('FilterEngine', () => {
  describe('Tier 1: Built-in Blacklists', () => {
    const filter = new FilterEngine({ repoRoot: IGNORE_TEST_DIR });

    it('ignores VCS metadata directories at any depth', () => {
      expect(filter.isIgnored('.git')).toBe(true);
      expect(filter.isIgnored('.git/config')).toBe(true);
      expect(filter.isIgnored('nested/.git/HEAD')).toBe(true);
      expect(filter.isIgnored('.svn/entries')).toBe(true);
    });

    it('ignores package manager and dependency directories', () => {
      expect(filter.isIgnored('node_modules/fake-lib/index.js')).toBe(true);
      expect(filter.isIgnored('src/node_modules/pkg/main.js')).toBe(true);
      expect(filter.isIgnored('vendor/bundle')).toBe(true);
      expect(filter.isIgnored('.pnpm-store/v3')).toBe(true);
    });

    it('ignores build outputs, bundler caches, and test coverage', () => {
      expect(filter.isIgnored('dist/bundle.js')).toBe(true);
      expect(filter.isIgnored('.next/cache/webpack')).toBe(true);
      expect(filter.isIgnored('build/out.js')).toBe(true);
      expect(filter.isIgnored('coverage/lcov.info')).toBe(true);
      expect(filter.isIgnored('__snapshots__/app.test.ts.snap')).toBe(true);
    });

    it('ignores lockfiles across all major ecosystems', () => {
      expect(filter.isIgnored('package-lock.json')).toBe(true);
      expect(filter.isIgnored('yarn.lock')).toBe(true);
      expect(filter.isIgnored('pnpm-lock.yaml')).toBe(true);
      expect(filter.isIgnored('Cargo.lock')).toBe(true);
      expect(filter.isIgnored('go.sum')).toBe(true);
      expect(filter.isIgnored('poetry.lock')).toBe(true);
      expect(filter.isIgnored('Pipfile.lock')).toBe(true);
    });

    it('ignores compiled binaries, shared libraries, and media assets', () => {
      expect(filter.isIgnored('lib.so')).toBe(true);
      expect(filter.isIgnored('compiled.pyc')).toBe(true);
      expect(filter.isIgnored('binary.exe')).toBe(true);
      expect(filter.isIgnored('module.wasm')).toBe(true);
      expect(filter.isIgnored('assets/logo.png')).toBe(true);
      expect(filter.isIgnored('assets/banner.jpg')).toBe(true);
      expect(filter.isIgnored('video/demo.mp4')).toBe(true);
      expect(filter.isIgnored('fonts/inter.woff2')).toBe(true);
      expect(filter.isIgnored('archive.zip')).toBe(true);
    });
  });

  describe('Tier 4: Custom Patterns & Gitignore Semantics', () => {
    it('applies custom ignore glob patterns', () => {
      const filter = new FilterEngine({
        repoRoot: REPO_ROOT,
        customPatterns: ['**/*.generated.ts', 'temp/']
      });

      expect(filter.isIgnored('src/types.generated.ts')).toBe(true);
      expect(filter.isIgnored('temp/scratch.js')).toBe(true);
      expect(filter.isIgnored('src/normal.ts')).toBe(false);
    });

    it('supports negation patterns (!)', () => {
      const filter = new FilterEngine({
        repoRoot: REPO_ROOT,
        customPatterns: ['*.log', '!important.log']
      });

      expect(filter.isIgnored('debug.log')).toBe(true);
      expect(filter.isIgnored('important.log')).toBe(false);
    });
  });

  describe('Path Normalization & Filtering', () => {
    const filter = new FilterEngine({ repoRoot: EDGE_CASES_DIR });

    it('handles Windows backslashes cleanly', () => {
      expect(filter.isIgnored('node_modules\\pkg\\index.js')).toBe(true);
      expect(filter.isIgnored('dist\\bundle.js')).toBe(true);
      expect(filter.isIgnored('src\\components\\button.ts')).toBe(false);
    });

    it('does not falsely ignore valid deeply nested source paths', () => {
      const deepPath = 'deeply/nested/directory/structure/deep.ts';
      expect(filter.isIgnored(deepPath)).toBe(false);
    });

    it('filters arrays of paths with filterFiles', () => {
      const paths = [
        'src/app.ts',
        'package-lock.json',
        'dist/main.js',
        'src/utils.ts',
        'assets/hero.png'
      ];
      const valid = filter.filterFiles(paths);

      expect(valid).toEqual(['src/app.ts', 'src/utils.ts']);
    });
  });
});
