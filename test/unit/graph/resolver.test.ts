import { describe, it, expect } from 'vitest';
import path from 'path';
import { ModuleResolver } from '../../../src/graph/resolver.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'test/fixtures/benchmark-project');
const ALIAS_DIR = path.join(REPO_ROOT, 'test/fixtures/alias-imports');
const CYCLIC_DIR = path.join(REPO_ROOT, 'test/fixtures/cyclic-imports');
const EDGE_CASES_DIR = path.join(REPO_ROOT, 'test/fixtures/edge-cases');

describe('ModuleResolver', () => {
  describe('TypeScript & JavaScript Resolution', () => {
    it('resolves relative import with extension probing', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const fromPath = path.join(BENCHMARK_DIR, 'ts-service/src/services/order-service.ts');
      const resolved = resolver.resolve(fromPath, '../models/order', 'typescript');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(BENCHMARK_DIR, 'ts-service/src/models/order.ts'));
    });

    it('resolves directory index imports', () => {
      const resolver = new ModuleResolver({ repoRoot: BENCHMARK_DIR });
      const fromPath = path.join(BENCHMARK_DIR, 'ts-service/package.json');
      const resolved = resolver.resolve(fromPath, './src', 'typescript');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(BENCHMARK_DIR, 'ts-service/src/index.ts'));
    });

    it('handles ESM .js to .ts rewrite for TypeScript imports', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const fromPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      // In TS ESM, code imports './models/user.js'
      const resolved = resolver.resolve(fromPath, './models/user.js', 'typescript');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(BENCHMARK_DIR, 'ts-service/src/models/user.ts'));
    });

    it('resolves tsconfig path aliases (@/* -> src/*)', () => {
      const resolver = new ModuleResolver({
        repoRoot: ALIAS_DIR,
        tsconfigPath: path.join(ALIAS_DIR, 'tsconfig.json')
      });
      const fromPath = path.join(ALIAS_DIR, 'src/components/button.ts');
      const resolved = resolver.resolve(fromPath, '@/utils/math', 'typescript');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(ALIAS_DIR, 'src/utils/math.ts'));
    });

    it('returns null for external dependencies', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const fromPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');

      expect(resolver.resolve(fromPath, 'express', 'typescript')).toBeNull();
      expect(resolver.resolve(fromPath, 'node:fs', 'typescript')).toBeNull();
      expect(resolver.resolve(fromPath, 'vitest', 'typescript')).toBeNull();
    });
  });

  describe('Python Resolution', () => {
    it('resolves relative dotted module imports (.schemas -> schemas.py)', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'py-ml') });
      const fromPath = path.join(BENCHMARK_DIR, 'py-ml/service/api.py');
      const resolved = resolver.resolve(fromPath, '.schemas', 'python');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(BENCHMARK_DIR, 'py-ml/service/schemas.py'));
    });

    it('returns null for standard library and 3rd party packages', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'py-ml') });
      const fromPath = path.join(BENCHMARK_DIR, 'py-ml/service/api.py');

      expect(resolver.resolve(fromPath, 'math', 'python')).toBeNull();
      expect(resolver.resolve(fromPath, 'fastapi', 'python')).toBeNull();
    });
  });

  describe('Go Resolution', () => {
    it('resolves module package imports to package directories via go.mod', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'go-raft') });
      const fromPath = path.join(BENCHMARK_DIR, 'go-raft/raft.go');
      const resolved = resolver.resolve(fromPath, 'github.com/benchmark/raft/storage', 'go');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(BENCHMARK_DIR, 'go-raft/storage'));
    });

    it('expands package directory to contained source files via resolveFiles', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'go-raft') });
      const fromPath = path.join(BENCHMARK_DIR, 'go-raft/raft.go');
      const files = resolver.resolveFiles(fromPath, 'github.com/benchmark/raft/storage', 'go');

      expect(files).toHaveLength(1);
      expect(files[0]).toBe(path.join(BENCHMARK_DIR, 'go-raft/storage/wal.go'));
    });

    it('returns null for standard library Go imports', () => {
      const resolver = new ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'go-raft') });
      const fromPath = path.join(BENCHMARK_DIR, 'go-raft/raft.go');

      expect(resolver.resolve(fromPath, 'fmt', 'go')).toBeNull();
      expect(resolver.resolve(fromPath, 'sync', 'go')).toBeNull();
    });
  });

  describe('Boundary & Security Safety', () => {
    it('prevents directory traversal attacks outside the repository root', () => {
      const resolver = new ModuleResolver({ repoRoot: EDGE_CASES_DIR });
      const fromPath = path.join(EDGE_CASES_DIR, 'comments.ts');
      const resolved = resolver.resolve(fromPath, '../../../../../../../../../../etc/passwd', 'typescript');

      expect(resolved).toBeNull();
    });

    it('resolves valid deep relative traversals that remain within repo root', () => {
      const resolver = new ModuleResolver({ repoRoot: EDGE_CASES_DIR });
      const fromPath = path.join(EDGE_CASES_DIR, 'deeply/nested/directory/structure/deep.ts');
      const resolved = resolver.resolve(fromPath, '../../../../types', 'typescript');

      expect(resolved).toBeTruthy();
      expect(resolved).toBe(path.join(EDGE_CASES_DIR, 'types.ts'));
    });
  });
});
