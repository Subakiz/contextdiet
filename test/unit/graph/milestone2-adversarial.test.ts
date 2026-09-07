import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DependencyGraph } from '../../../src/graph/graph.js';
import { DependencyGraphBuilder } from '../../../src/graph/index.js';
import { ModuleResolver } from '../../../src/graph/resolver.js';
import { extractImports } from '../../../src/graph/scanner.js';
import { packContext } from '../../../src/packer/index.js';
import { FilterEngine } from '../../../src/filter/index.js';

describe('Milestone 2 Adversarial Stress Suite', () => {
  let tempDirs: string[] = [];

  function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cd-adv-${prefix}-`));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const d of tempDirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    tempDirs = [];
  });

  // =========================================================================
  // Dimension 1: Extreme & Tangled Cyclic Graphs
  // =========================================================================
  describe('Dimension 1: Extreme & Tangled Cyclic Graphs', () => {
    it('handles complete graph clique K_20 (380 cyclic edges) without explosion', () => {
      const graph = new DependencyGraph();
      const N = 20;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i !== j) {
            graph.addEdge(`/repo/node${i}.ts`, `/repo/node${j}.ts`);
          }
        }
      }

      const t0 = performance.now();
      const cycles = graph.detectCycles();
      const sccs = graph.computeSccs();
      const order = graph.topologicalSortLeafFirst();
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(500); // Guarantees sub-second completion
      expect(cycles.length).toBeGreaterThan(0);
      expect(sccs).toHaveLength(1);
      expect(sccs[0]).toHaveLength(N);
      expect(order).toHaveLength(N);
      expect(new Set(order).size).toBe(N);
    });

    it('handles giant ring cycle of 100 nodes with exactly 1 cycle and 1 SCC', () => {
      const graph = new DependencyGraph();
      const N = 100;
      for (let i = 0; i < N; i++) {
        graph.addEdge(`/repo/ring${i}.ts`, `/repo/ring${(i + 1) % N}.ts`);
      }

      const t0 = performance.now();
      const cycles = graph.detectCycles();
      const sccs = graph.computeSccs();
      const order = graph.topologicalSortLeafFirst();
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(500);
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toHaveLength(N + 1); // [N_first, ..., N_first]
      expect(cycles[0][0]).toBe(cycles[0][cycles[0].length - 1]);
      expect(sccs).toHaveLength(1);
      expect(sccs[0]).toHaveLength(N);
      expect(order).toHaveLength(N);
      expect(new Set(order).size).toBe(N);
    });

    it('handles figure-8 tangled double cycle sharing a node and cross-chords', () => {
      const graph = new DependencyGraph();
      // Cycle 1: A -> B -> C -> A
      graph.addEdge('/repo/A.ts', '/repo/B.ts');
      graph.addEdge('/repo/B.ts', '/repo/C.ts');
      graph.addEdge('/repo/C.ts', '/repo/A.ts');
      // Cycle 2: C -> D -> E -> C
      graph.addEdge('/repo/C.ts', '/repo/D.ts');
      graph.addEdge('/repo/D.ts', '/repo/E.ts');
      graph.addEdge('/repo/E.ts', '/repo/C.ts');
      // Cross chords: B -> D, E -> A
      graph.addEdge('/repo/B.ts', '/repo/D.ts');
      graph.addEdge('/repo/E.ts', '/repo/A.ts');

      const cycles = graph.detectCycles();
      const sccs = graph.computeSccs();
      const order = graph.topologicalSortLeafFirst();

      expect(cycles.length).toBeGreaterThanOrEqual(2);
      expect(sccs).toHaveLength(1); // Entangled through C and chords -> single SCC
      expect(sccs[0]).toHaveLength(5);
      expect(order).toHaveLength(5);
      expect(new Set(order).size).toBe(5);
    });

    it('correctly orders disjoint multi-cycles connected via directed bridge', () => {
      const graph = new DependencyGraph();
      // Cycle 1: C1_A <-> C1_B
      graph.addEdge('/repo/c1_a.ts', '/repo/c1_b.ts');
      graph.addEdge('/repo/c1_b.ts', '/repo/c1_a.ts');

      // Bridge: C1_B -> Bridge
      graph.addEdge('/repo/c1_b.ts', '/repo/bridge.ts');

      // Bridge -> Cycle 2: Bridge -> C2_A
      graph.addEdge('/repo/bridge.ts', '/repo/c2_a.ts');

      // Cycle 2: C2_A <-> C2_B
      graph.addEdge('/repo/c2_a.ts', '/repo/c2_b.ts');
      graph.addEdge('/repo/c2_b.ts', '/repo/c2_a.ts');

      // Cycle 2 -> Leaf
      graph.addEdge('/repo/c2_b.ts', '/repo/leaf.ts');

      const sccs = graph.computeSccs();
      expect(sccs).toHaveLength(4); // {leaf}, {C2_A, C2_B}, {bridge}, {C1_A, C1_B}

      const order = graph.topologicalSortLeafFirst();
      expect(order).toHaveLength(6);

      const leafIdx = order.indexOf(path.resolve('/repo/leaf.ts'));
      const c2aIdx = order.indexOf(path.resolve('/repo/c2_a.ts'));
      const bridgeIdx = order.indexOf(path.resolve('/repo/bridge.ts'));
      const c1aIdx = order.indexOf(path.resolve('/repo/c1_a.ts'));

      // Leaf must come before C2, C2 before Bridge, Bridge before C1
      expect(leafIdx).toBeLessThan(c2aIdx);
      expect(c2aIdx).toBeLessThan(bridgeIdx);
      expect(bridgeIdx).toBeLessThan(c1aIdx);
    });

    it('handles self-loops embedded in complex graphs', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/repo/self.ts', '/repo/self.ts');
      graph.addEdge('/repo/root.ts', '/repo/self.ts');
      graph.addEdge('/repo/self.ts', '/repo/leaf.ts');

      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual([path.resolve('/repo/self.ts'), path.resolve('/repo/self.ts')]);

      const order = graph.topologicalSortLeafFirst();
      const leafIdx = order.indexOf(path.resolve('/repo/leaf.ts'));
      const selfIdx = order.indexOf(path.resolve('/repo/self.ts'));
      const rootIdx = order.indexOf(path.resolve('/repo/root.ts'));

      expect(leafIdx).toBeLessThan(selfIdx);
      expect(selfIdx).toBeLessThan(rootIdx);
    });
  });

  // =========================================================================
  // Dimension 2: Deeply Nested Relative Traversals & Escapes
  // =========================================================================
  describe('Dimension 2: Deeply Nested Relative Traversals & Security', () => {
    it('resolves extreme 15-level deep relative traversal within repository bounds', () => {
      const repo = createTempDir('deep-rel');
      const deepDir = path.join(
        repo,
        'src/l1/l2/l3/l4/l5/l6/l7/l8/l9/l10/l11/l12/l13/l14/l15'
      );
      fs.mkdirSync(deepDir, { recursive: true });

      const rootFile = path.join(repo, 'src/root-types.ts');
      fs.writeFileSync(rootFile, 'export interface RootType { id: string; }');

      const deepFile = path.join(deepDir, 'deep-consumer.ts');
      fs.writeFileSync(deepFile, 'export const deep = true;');

      const resolver = new ModuleResolver({ repoRoot: repo });

      // 15 parent segments
      const specifier = '../../../../../../../../../../../../../../../root-types';
      const resolved = resolver.resolve(deepFile, specifier, 'typescript');

      expect(resolved).toBe(rootFile);
    });

    it('strictly prevents directory traversal escapes beyond repository root', () => {
      const repo = createTempDir('escape-guard');
      const srcDir = path.join(repo, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      const testFile = path.join(srcDir, 'test.ts');
      fs.writeFileSync(testFile, 'export const a = 1;');

      const resolver = new ModuleResolver({ repoRoot: repo });

      const escapeAttempts = [
        '../../../../../../../../../../../../etc/passwd',
        '../../outside.ts',
        '../outside.ts',
        './../../outside.ts',
        '..\\outside.ts',
        '..\\..\\outside.ts'
      ];

      for (const attempt of escapeAttempts) {
        const resolved = resolver.resolve(testFile, attempt, 'typescript');
        expect(resolved).toBeNull();
      }
    });

    it('resolves redundant and noisy relative path segments within repository', () => {
      const repo = createTempDir('noisy-rel');
      const dirA = path.join(repo, 'src/a/b');
      const dirB = path.join(repo, 'src/c/d');
      fs.mkdirSync(dirA, { recursive: true });
      fs.mkdirSync(dirB, { recursive: true });

      const target = path.join(dirB, 'target.ts');
      fs.writeFileSync(target, 'export const target = 42;');

      const source = path.join(dirA, 'source.ts');
      fs.writeFileSync(source, 'export const source = 1;');

      const resolver = new ModuleResolver({ repoRoot: repo });
      // Redundant . and .. segments
      const noisySpec = './../../c/./d/../d/./target';
      const resolved = resolver.resolve(source, noisySpec, 'typescript');

      expect(resolved).toBe(target);
    });

    it('returns null gracefully on non-existent deep paths without throwing', () => {
      const repo = createTempDir('non-existent');
      const src = path.join(repo, 'src');
      fs.mkdirSync(src);
      const testFile = path.join(src, 'test.ts');
      fs.writeFileSync(testFile, '');

      const resolver = new ModuleResolver({ repoRoot: repo });
      expect(resolver.resolve(testFile, './does/not/exist/at/all', 'typescript')).toBeNull();
      expect(resolver.resolve(testFile, '../../does/not/exist', 'typescript')).toBeNull();
    });
  });

  // =========================================================================
  // Dimension 3: Tsconfig Path Aliasing Collisions & Overlaps
  // =========================================================================
  describe('Dimension 3: Tsconfig Path Aliasing Collisions & Overlaps', () => {
    it('correctly respects longest-prefix specificity for overlapping aliases', () => {
      const repo = createTempDir('alias-overlap');
      const tsconfig = {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@app/*': ['src/general/*'],
            '@app/components/*': ['src/components/*'],
            '@app/components/special-button': ['src/custom/special.ts']
          }
        }
      };

      fs.writeFileSync(path.join(repo, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

      fs.mkdirSync(path.join(repo, 'src/general'), { recursive: true });
      fs.mkdirSync(path.join(repo, 'src/components'), { recursive: true });
      fs.mkdirSync(path.join(repo, 'src/custom'), { recursive: true });

      const generalFile = path.join(repo, 'src/general/logger.ts');
      const componentFile = path.join(repo, 'src/components/card.ts');
      const specialFile = path.join(repo, 'src/custom/special.ts');

      fs.writeFileSync(generalFile, 'export const logger = 1;');
      fs.writeFileSync(componentFile, 'export const card = 1;');
      fs.writeFileSync(specialFile, 'export const special = 1;');

      const fromFile = path.join(repo, 'src/index.ts');
      fs.writeFileSync(fromFile, '');

      const resolver = new ModuleResolver({
        repoRoot: repo,
        tsconfigPath: path.join(repo, 'tsconfig.json')
      });

      // 1. Exact match takes precedence
      expect(resolver.resolve(fromFile, '@app/components/special-button', 'typescript')).toBe(specialFile);

      // 2. Longer wildcard @app/components/* takes precedence over @app/*
      expect(resolver.resolve(fromFile, '@app/components/card', 'typescript')).toBe(componentFile);

      // 3. Fallback to @app/*
      expect(resolver.resolve(fromFile, '@app/logger', 'typescript')).toBe(generalFile);
    });

    it('falls through multi-target alias arrays when earlier targets do not exist', () => {
      const repo = createTempDir('alias-fallback');
      const tsconfig = {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@shared/*': [
              'src/generated-missing/*',
              'src/fallback-missing/*',
              'src/actual-shared/*'
            ]
          }
        }
      };

      fs.writeFileSync(path.join(repo, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
      fs.mkdirSync(path.join(repo, 'src/actual-shared'), { recursive: true });

      const target = path.join(repo, 'src/actual-shared/utils.ts');
      fs.writeFileSync(target, 'export const utils = true;');

      const fromFile = path.join(repo, 'src/main.ts');
      fs.writeFileSync(fromFile, '');

      const resolver = new ModuleResolver({
        repoRoot: repo,
        tsconfigPath: path.join(repo, 'tsconfig.json')
      });

      const resolved = resolver.resolve(fromFile, '@shared/utils', 'typescript');
      expect(resolved).toBe(target);
    });

    it('handles wildcard in directory path segments (@pkg/*/api)', () => {
      const repo = createTempDir('alias-mid-wildcard');
      const tsconfig = {
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@pkg/*/api': ['packages/*/src/api.ts']
          }
        }
      };

      fs.writeFileSync(path.join(repo, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
      fs.mkdirSync(path.join(repo, 'packages/billing/src'), { recursive: true });

      const apiFile = path.join(repo, 'packages/billing/src/api.ts');
      fs.writeFileSync(apiFile, 'export const billingApi = {};');

      const fromFile = path.join(repo, 'src/index.ts');
      const resolver = new ModuleResolver({
        repoRoot: repo,
        tsconfigPath: path.join(repo, 'tsconfig.json')
      });

      expect(resolver.resolve(fromFile, '@pkg/billing/api', 'typescript')).toBe(apiFile);
    });
  });

  // =========================================================================
  // Dimension 4: Comment & String Literal Immunity Across Languages
  // =========================================================================
  describe('Dimension 4: Comment & String Literal Immunity Across Languages', () => {
    it('ignores fake imports in TS comments, template strings, and multiline blocks', () => {
      const tsCode = `
// import { FakeA } from './fake-line-comment';
/*
  import './fake-block-comment';
  import { FakeB } from '../fake-block';
  export * from './fake-export';
  const x = require('./fake-require');
*/
const msg1 = "import './in-double-quotes';";
const msg2 = 'import "./in-single-quotes";';
const msg3 = \`
  import './in-multiline-template';
  from './fake-python' import something;
\`;
const msg4 = \`prefix \${'import "./in-expr"'} suffix\`;

// Real imports
import { RealA } from './real-a';
/* leading */ import { RealB } from './real-b'; /* trailing */
export { RealC } from './real-c';
      `;

      const imports = extractImports(tsCode, 'typescript');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('./real-a');
      expect(specifiers).toContain('./real-b');
      expect(specifiers).toContain('./real-c');

      expect(specifiers).not.toContain('./fake-line-comment');
      expect(specifiers).not.toContain('./fake-block-comment');
      expect(specifiers).not.toContain('../fake-block');
      expect(specifiers).not.toContain('./fake-export');
      expect(specifiers).not.toContain('./fake-require');
      expect(specifiers).not.toContain('./in-double-quotes');
      expect(specifiers).not.toContain('./in-single-quotes');
      expect(specifiers).not.toContain('./in-multiline-template');
      expect(specifiers).not.toContain('./in-expr');
    });

    it('ignores fake imports in Python docstrings, comments, and multiline strings', () => {
      const pyCode = `
# import fake_comment_module
# from .fake_comment import fake_func

"""
Module Docstring:
import fake_docstring_module
from .fake_docstring import something
"""

from .real_service import RealService  # from .inline_fake import foo

def helper():
    '''
    Function Docstring:
    import fake_func_docstring
    '''
    sql = """
    SELECT * FROM users
    -- import fake_sql
    """
    from ..real_db import get_connection
    import real_external
    return 10
      `;

      const imports = extractImports(pyCode, 'python');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('.real_service');
      expect(specifiers).toContain('..real_db');
      expect(specifiers).toContain('real_external');

      expect(specifiers).not.toContain('fake_comment_module');
      expect(specifiers).not.toContain('.fake_comment');
      expect(specifiers).not.toContain('fake_docstring_module');
      expect(specifiers).not.toContain('.fake_docstring');
      expect(specifiers).not.toContain('.inline_fake');
      expect(specifiers).not.toContain('fake_func_docstring');
      expect(specifiers).not.toContain('fake_sql');
    });

    it('ignores fake imports in Go line comments, block comments, and raw strings', () => {
      const goCode = `
package main

// import "fake/line/outside"
/*
import (
    "fake/block/outside"
)
*/

import (
    "real/package/one"
    // "fake/line/inside"
    /* "fake/block/inside" */
    alias "real/package/two"
    _ "real/package/three"
    . "real/package/four"
)

var rawLiteral = \`
import "fake/in/raw/string"
package fake
\`
      `;

      const imports = extractImports(goCode, 'go');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('real/package/one');
      expect(specifiers).toContain('real/package/two');
      expect(specifiers).toContain('real/package/three');
      expect(specifiers).toContain('real/package/four');

      expect(specifiers).not.toContain('fake/line/outside');
      expect(specifiers).not.toContain('fake/block/outside');
      expect(specifiers).not.toContain('fake/line/inside');
      expect(specifiers).not.toContain('fake/block/inside');
      expect(specifiers).not.toContain('fake/in/raw/string');
    });
  });

  // =========================================================================
  // Dimension 5: End-to-End packContext Stress on Tangled Polyglot Repo
  // =========================================================================
  describe('Dimension 5: End-to-End packContext Stress on Tangled Polyglot Repo', () => {
    it('packs complex cyclic repository with guaranteed termination and exact status attribution', async () => {
      const repo = createTempDir('e2e-stress');

      // Entry file
      const mainTs = path.join(repo, 'src/main.ts');
      fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
      fs.writeFileSync(
        mainTs,
        `import { serviceA } from './serviceA.js';
export function run(): number {
  return serviceA();
}`
      );

      // Service A <-> Service B cycle
      const serviceA = path.join(repo, 'src/serviceA.ts');
      const serviceB = path.join(repo, 'src/serviceB.ts');
      fs.writeFileSync(
        serviceA,
        `import { serviceB } from './serviceB.js';
import { ModelType } from './models.js';
export function serviceA(): number {
  return serviceB() + 1;
}`
      );
      fs.writeFileSync(
        serviceB,
        `import { serviceA } from './serviceA.js';
import { LeafType } from './leaf.js';
export function serviceB(): number {
  return 42;
}`
      );

      // Model and Leaf
      const models = path.join(repo, 'src/models.ts');
      const leaf = path.join(repo, 'src/leaf.ts');
      fs.writeFileSync(models, `export interface ModelType { id: string; }`);
      fs.writeFileSync(leaf, `export interface LeafType { value: number; }`);

      // Unreachable files (dead code and tests)
      const deadCode = path.join(repo, 'src/dead.ts');
      fs.writeFileSync(deadCode, `export function unused() { return 'dead'; }`);

      // Build context pack focusing on main.ts
      const t0 = performance.now();
      const packResult = await packContext({
        repoRoot: repo,
        focusFiles: [mainTs]
      });
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(1000);
      expect(packResult.unreachablePrunedCount).toBe(1); // dead.ts pruned
      expect(packResult.cycles).toHaveLength(1);
      expect(packResult.files).toHaveLength(5); // main, serviceA, serviceB, models, leaf

      // Check focus status
      const mainPacked = packResult.files.find(f => f.relativePath === 'src/main.ts')!;
      expect(mainPacked.status).toBe('FOCUS');
      expect(mainPacked.content).toBe(mainPacked.rawContent);

      // Check skeleton status for cyclic dependencies
      const aPacked = packResult.files.find(f => f.relativePath === 'src/serviceA.ts')!;
      const bPacked = packResult.files.find(f => f.relativePath === 'src/serviceB.ts')!;
      expect(aPacked.status).toBe('SKELETON');
      expect(bPacked.status).toBe('SKELETON');
      expect(aPacked.content).toContain('/* ... */');
      expect(bPacked.content).toContain('/* ... */');

      // Check leaf-first topological ordering: leaf and models should precede main.ts
      const orderPaths = packResult.files.map(f => f.relativePath);
      const leafIdx = orderPaths.indexOf('src/leaf.ts');
      const mainIdx = orderPaths.indexOf('src/main.ts');
      expect(leafIdx).toBeLessThan(mainIdx);
    });

    it('handles whole-repo fallback on cyclic graphs with 0 pruned and 100% SKELETON', async () => {
      const repo = createTempDir('e2e-fallback');
      fs.writeFileSync(
        path.join(repo, 'node1.ts'),
        `import './node2.js'; export function n1() { return 1; }`
      );
      fs.writeFileSync(
        path.join(repo, 'node2.ts'),
        `import './node1.js'; export function n2() { return 2; }`
      );
      fs.writeFileSync(
        path.join(repo, 'isolated.ts'),
        `export function iso() { return 'alone'; }`
      );

      const res = await packContext({ repoRoot: repo });

      expect(res.files).toHaveLength(3);
      expect(res.unreachablePrunedCount).toBe(0);
      expect(res.cycles).toHaveLength(1);
      expect(res.files.every(f => f.status === 'SKELETON')).toBe(true);
    });

    it('handles empty repository without crashing or emitting spurious files', async () => {
      const repo = createTempDir('e2e-empty');
      const res = await packContext({ repoRoot: repo });

      expect(res.files).toHaveLength(0);
      expect(res.cycles).toHaveLength(0);
      expect(res.unreachablePrunedCount).toBe(0);
    });
  });
});
