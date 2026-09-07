import { describe, it, expect } from 'vitest';
import path from 'path';
import { DependencyGraph } from '../../../src/graph/graph.js';
import { DependencyGraphBuilder } from '../../../src/graph/index.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const CYCLIC_DIR = path.join(REPO_ROOT, 'test/fixtures/cyclic-imports');
const BENCHMARK_DIR = path.join(REPO_ROOT, 'test/fixtures/benchmark-project');

describe('DependencyGraph & Cycle Traversal', () => {
  describe('DependencyGraph Data Structure', () => {
    it('manages directed dependency and reverse dependent edges', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/repo/a.ts', '/repo/b.ts');
      graph.addEdge('/repo/b.ts', '/repo/c.ts');

      expect(graph.hasNode('/repo/a.ts')).toBe(true);
      expect(graph.hasNode('/repo/b.ts')).toBe(true);
      expect(graph.hasNode('/repo/c.ts')).toBe(true);

      const depsA = graph.getDependencies('/repo/a.ts');
      expect(depsA.has(path.resolve('/repo/b.ts'))).toBe(true);

      const dependentsB = graph.getDependents('/repo/b.ts');
      expect(dependentsB.has(path.resolve('/repo/a.ts'))).toBe(true);
    });
  });

  describe('Cycle Detection (3-Color DFS)', () => {
    it('detects 2-node circular dependencies', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycles = graph.detectCycles();
      expect(cycles.length).toBe(1);
      const cycle = cycles[0];
      expect(cycle).toHaveLength(3);
      expect(cycle[0]).toBe(cycle[2]); // Closed loop
    });

    it('detects 3-node ring cycles', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/a.ts');

      const cycles = graph.detectCycles();
      expect(cycles.length).toBe(1);
      const cycle = cycles[0];
      expect(cycle).toHaveLength(4);
      expect(cycle[0]).toBe(cycle[3]); // Closed loop
    });

    it('detects self-referencing loops (A -> A)', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/self.ts', '/self.ts');

      const cycles = graph.detectCycles();
      expect(cycles.length).toBe(1);
      expect(cycles[0]).toEqual([path.resolve('/self.ts'), path.resolve('/self.ts')]);
    });

    it('returns empty array for strictly acyclic graphs', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/a.ts', '/c.ts');
      graph.addEdge('/b.ts', '/c.ts');

      const cycles = graph.detectCycles();
      expect(cycles).toEqual([]);
    });
  });

  describe('Tarjan SCC Condensation', () => {
    it('collapses cyclic components into single SCCs while keeping acyclic nodes separate', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');
      graph.addEdge('/a.ts', '/leaf.ts');

      const sccs = graph.computeSccs();
      // Should have two components: { /leaf.ts } and { /a.ts, /b.ts }
      expect(sccs.length).toBe(2);

      const cyclicScc = sccs.find(s => s.length === 2);
      expect(cyclicScc).toBeDefined();
      expect(cyclicScc).toContain(path.resolve('/a.ts'));
      expect(cyclicScc).toContain(path.resolve('/b.ts'));

      const leafScc = sccs.find(s => s.length === 1);
      expect(leafScc).toBeDefined();
      expect(leafScc).toContain(path.resolve('/leaf.ts'));
    });
  });

  describe('Attention-Optimal Leaf-First Topological Sort', () => {
    it('orders leaf type/schema contracts before dependent business logic', () => {
      const graph = new DependencyGraph();
      // index -> controller -> service -> repository -> model
      graph.addEdge('/index.ts', '/controller.ts');
      graph.addEdge('/controller.ts', '/service.ts');
      graph.addEdge('/service.ts', '/repository.ts');
      graph.addEdge('/repository.ts', '/model.ts');

      const ordered = graph.topologicalSortLeafFirst();
      const names = ordered.map(p => path.basename(p));

      expect(names).toEqual(['model.ts', 'repository.ts', 'service.ts', 'controller.ts', 'index.ts']);
    });

    it('safely sequences cyclic nodes without dropping them or infinite looping', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/entry.ts', '/cycleA.ts');
      graph.addEdge('/cycleA.ts', '/cycleB.ts');
      graph.addEdge('/cycleB.ts', '/cycleA.ts');
      graph.addEdge('/cycleA.ts', '/leaf.ts');

      const ordered = graph.topologicalSortLeafFirst();
      const names = ordered.map(p => path.basename(p));

      // leaf must come before cycles, entry must come last
      expect(names.indexOf('leaf.ts')).toBeLessThan(names.indexOf('cycleA.ts'));
      expect(names.indexOf('cycleA.ts')).toBeLessThan(names.indexOf('entry.ts'));
      expect(names.indexOf('cycleB.ts')).toBeLessThan(names.indexOf('entry.ts'));
      expect(names).toHaveLength(4);
    });

    it('produces 100% deterministic ordering across runs', () => {
      const graph = new DependencyGraph();
      graph.addEdge('/root.ts', '/modC.ts');
      graph.addEdge('/root.ts', '/modA.ts');
      graph.addEdge('/root.ts', '/modB.ts');

      const run1 = graph.topologicalSortLeafFirst();
      const run2 = graph.topologicalSortLeafFirst();

      expect(run1).toEqual(run2);
    });
  });

  describe('DependencyGraphBuilder', () => {
    it('builds reachable subgraph from cyclic entry files within milliseconds', async () => {
      const builder = new DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle2-a.ts')]);

      expect(result.reachableFiles).toHaveLength(2);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.orderedFiles).toHaveLength(2);
    });

    it('builds benchmark service dependency graph deterministically', async () => {
      const builder = new DependencyGraphBuilder({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const entry = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const result1 = await builder.build([entry]);
      const result2 = await builder.build([entry]);

      expect(result1.orderedFiles).toEqual(result2.orderedFiles);
      expect(result1.reachableFiles.length).toBeGreaterThan(5);
    });
  });
});
