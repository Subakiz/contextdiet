import { describe, it, expect } from 'vitest';
import path from 'path';
import { DependencyGraph } from '../../../src/graph/graph.js';

describe('Adversarial DependencyGraph & Topological Sorting Stress Tests', () => {
  describe('1. Leaf-First Topological Ordering Contracts', () => {
    it('strictly orders leaf models/types before intermediate services and entry points', () => {
      const graph = new DependencyGraph();

      // Architecture:
      // app.ts (entry/focus) -> user-controller.ts -> user-service.ts -> user-model.ts -> db-types.ts (leaf)
      //                      -> order-controller.ts -> order-service.ts -> order-model.ts -> db-types.ts (leaf)
      const app = '/repo/src/app.ts';
      const userCtrl = '/repo/src/controllers/user.controller.ts';
      const orderCtrl = '/repo/src/controllers/order.controller.ts';
      const userSvc = '/repo/src/services/user.service.ts';
      const orderSvc = '/repo/src/services/order.service.ts';
      const userModel = '/repo/src/models/user.model.ts';
      const orderModel = '/repo/src/models/order.model.ts';
      const dbTypes = '/repo/src/types/db.types.ts';

      graph.addEdge(app, userCtrl);
      graph.addEdge(app, orderCtrl);
      graph.addEdge(userCtrl, userSvc);
      graph.addEdge(orderCtrl, orderSvc);
      graph.addEdge(userSvc, userModel);
      graph.addEdge(orderSvc, orderModel);
      graph.addEdge(userModel, dbTypes);
      graph.addEdge(orderModel, dbTypes);

      const ordered = graph.topologicalSortLeafFirst();

      // dbTypes must be first (index 0) because both models depend on it and it depends on nothing
      expect(ordered[0]).toBe(dbTypes);

      // Models must precede services
      expect(ordered.indexOf(userModel)).toBeLessThan(ordered.indexOf(userSvc));
      expect(ordered.indexOf(orderModel)).toBeLessThan(ordered.indexOf(orderSvc));

      // Services must precede controllers
      expect(ordered.indexOf(userSvc)).toBeLessThan(ordered.indexOf(userCtrl));
      expect(ordered.indexOf(orderSvc)).toBeLessThan(ordered.indexOf(orderCtrl));

      // Controllers must precede root app.ts
      expect(ordered.indexOf(userCtrl)).toBeLessThan(ordered.indexOf(app));
      expect(ordered.indexOf(orderCtrl)).toBeLessThan(ordered.indexOf(app));

      // Root app.ts must be at the very tail (last element)
      expect(ordered[ordered.length - 1]).toBe(app);
    });

    it('places diamond dependency prerequisites before both branches and entry point', () => {
      const graph = new DependencyGraph();
      // Diamond: Entry -> B, Entry -> C; B -> Leaf, C -> Leaf
      const entry = '/repo/entry.ts';
      const b = '/repo/b.ts';
      const c = '/repo/c.ts';
      const leaf = '/repo/leaf.ts';

      graph.addEdge(entry, b);
      graph.addEdge(entry, c);
      graph.addEdge(b, leaf);
      graph.addEdge(c, leaf);

      const ordered = graph.topologicalSortLeafFirst();

      expect(ordered[0]).toBe(leaf);
      expect(ordered.indexOf(leaf)).toBeLessThan(ordered.indexOf(b));
      expect(ordered.indexOf(leaf)).toBeLessThan(ordered.indexOf(c));
      expect(ordered.indexOf(b)).toBeLessThan(ordered.indexOf(entry));
      expect(ordered.indexOf(c)).toBeLessThan(ordered.indexOf(entry));
      expect(ordered[ordered.length - 1]).toBe(entry);
    });
  });

  describe('2. Complex Cycle Topologies & SCC Condensation', () => {
    it('handles self-loops without crashing and includes the node', () => {
      const graph = new DependencyGraph();
      const selfLoop = '/repo/self.ts';
      graph.addEdge(selfLoop, selfLoop);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBe(1);
      expect(cycles[0]).toEqual([selfLoop, selfLoop]);

      const ordered = graph.topologicalSortLeafFirst();
      expect(ordered).toEqual([selfLoop]);
    });

    it('condenses cycles between leaf and root correctly preserving global order', () => {
      const graph = new DependencyGraph();
      // Structure:
      // Root -> CycleNodeA <-> CycleNodeB -> Leaf
      const root = '/repo/root.ts';
      const cycleA = '/repo/cycleA.ts';
      const cycleB = '/repo/cycleB.ts';
      const leaf = '/repo/leaf.ts';

      graph.addEdge(root, cycleA);
      graph.addEdge(cycleA, cycleB);
      graph.addEdge(cycleB, cycleA);
      graph.addEdge(cycleB, leaf);

      const cycles = graph.detectCycles();
      expect(cycles.length).toBe(1);

      const sccs = graph.computeSccs();
      const cycleScc = sccs.find(s => s.length === 2);
      expect(cycleScc).toBeDefined();
      expect(cycleScc).toContain(cycleA);
      expect(cycleScc).toContain(cycleB);

      const ordered = graph.topologicalSortLeafFirst();

      // Leaf must come first
      expect(ordered.indexOf(leaf)).toBeLessThan(ordered.indexOf(cycleA));
      expect(ordered.indexOf(leaf)).toBeLessThan(ordered.indexOf(cycleB));

      // Cycle nodes must precede root
      expect(ordered.indexOf(cycleA)).toBeLessThan(ordered.indexOf(root));
      expect(ordered.indexOf(cycleB)).toBeLessThan(ordered.indexOf(root));

      // Root must be last
      expect(ordered[ordered.length - 1]).toBe(root);
    });

    it('handles figure-8 tangled cycles (two cycles sharing a pivot node)', () => {
      const graph = new DependencyGraph();
      // Cycle 1: A -> B -> C -> A
      // Cycle 2: C -> D -> E -> C
      // Shared pivot: C
      const a = '/repo/a.ts';
      const b = '/repo/b.ts';
      const c = '/repo/c.ts';
      const d = '/repo/d.ts';
      const e = '/repo/e.ts';

      graph.addEdge(a, b);
      graph.addEdge(b, c);
      graph.addEdge(c, a);

      graph.addEdge(c, d);
      graph.addEdge(d, e);
      graph.addEdge(e, c);

      const sccs = graph.computeSccs();
      // All 5 nodes form a single SCC because C connects both cycles
      const largeScc = sccs.find(s => s.length === 5);
      expect(largeScc).toBeDefined();

      const ordered = graph.topologicalSortLeafFirst();
      expect(ordered).toHaveLength(5);
    });

    it('handles multiple disjoint cycles independently', () => {
      const graph = new DependencyGraph();
      // Disjoint Cycle 1: A <-> B
      // Disjoint Cycle 2: C <-> D
      const a = '/repo/c1-a.ts';
      const b = '/repo/c1-b.ts';
      const c = '/repo/c2-c.ts';
      const d = '/repo/c2-d.ts';

      graph.addEdge(a, b);
      graph.addEdge(b, a);

      graph.addEdge(c, d);
      graph.addEdge(d, c);

      const cycles = graph.detectCycles();
      expect(cycles).toHaveLength(2);

      const ordered = graph.topologicalSortLeafFirst();
      expect(ordered).toHaveLength(4);
    });
  });

  describe('3. Determinism & Prompt Caching Invariant', () => {
    it('produces 100% identical topological ordering across 50 runs with randomized node discovery order', () => {
      const graph = new DependencyGraph();

      // Create a complex multi-tier graph with 15 nodes
      const nodes: string[] = [];
      for (let i = 0; i < 15; i++) {
        nodes.push(`/repo/module_${String(i).padStart(2, '0')}.ts`);
      }

      // Add nodes and dependencies
      for (const n of nodes) graph.addNode(n);

      // Layer 0 (leaves): 00, 01, 02
      // Layer 1: 03 -> 00, 04 -> 01, 05 -> 02, 06 -> 00, 01
      graph.addEdge(nodes[3], nodes[0]);
      graph.addEdge(nodes[4], nodes[1]);
      graph.addEdge(nodes[5], nodes[2]);
      graph.addEdge(nodes[6], nodes[0]);
      graph.addEdge(nodes[6], nodes[1]);

      // Layer 2 (cycle between 07 and 08):
      graph.addEdge(nodes[7], nodes[8]);
      graph.addEdge(nodes[8], nodes[7]);
      graph.addEdge(nodes[7], nodes[3]);
      graph.addEdge(nodes[8], nodes[4]);

      // Layer 3: 09 -> 05, 10 -> 06
      graph.addEdge(nodes[9], nodes[5]);
      graph.addEdge(nodes[10], nodes[6]);

      // Layer 4 (roots): 11 -> 07, 12 -> 09, 13 -> 10, 14 -> 11, 12, 13
      graph.addEdge(nodes[11], nodes[7]);
      graph.addEdge(nodes[12], nodes[9]);
      graph.addEdge(nodes[13], nodes[10]);
      graph.addEdge(nodes[14], nodes[11]);
      graph.addEdge(nodes[14], nodes[12]);
      graph.addEdge(nodes[14], nodes[13]);

      // Reference baseline order
      const baseline = graph.topologicalSortLeafFirst();
      expect(baseline).toHaveLength(15);

      // Run 50 times with shuffled scoped nodes arrays
      for (let run = 0; run < 50; run++) {
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);
        const result = graph.topologicalSortLeafFirst(shuffled);
        expect(result).toEqual(baseline);
      }
    });
  });
});
