import path from 'path';
import type { DependencyNode } from './types.js';

export class DependencyGraph {
  private nodes = new Map<string, DependencyNode>();
  private edges = new Map<string, Set<string>>(); // from -> Set of to (outgoing: from imports to)
  private revEdges = new Map<string, Set<string>>(); // to -> Set of from (incoming: from imports to)

  public addNode(filePath: string, meta: Partial<DependencyNode> = {}): void {
    const normalized = path.resolve(filePath);
    if (!this.nodes.has(normalized)) {
      this.nodes.set(normalized, {
        filePath: normalized,
        relativePath: meta.relativePath || normalized,
        language: meta.language || 'other',
        dependencies: new Set<string>(),
        dependents: new Set<string>(),
        isFocus: meta.isFocus || false
      });
      this.edges.set(normalized, new Set<string>());
      this.revEdges.set(normalized, new Set<string>());
    } else if (meta.isFocus !== undefined) {
      this.nodes.get(normalized)!.isFocus = meta.isFocus;
    }
  }

  public addEdge(from: string, to: string): void {
    const u = path.resolve(from);
    const v = path.resolve(to);
    this.addNode(u);
    this.addNode(v);

    this.edges.get(u)!.add(v);
    this.revEdges.get(v)!.add(u);
    this.nodes.get(u)!.dependencies.add(v);
    this.nodes.get(v)!.dependents.add(u);
  }

  public hasNode(filePath: string): boolean {
    return this.nodes.has(path.resolve(filePath));
  }

  public getNode(filePath: string): DependencyNode | undefined {
    return this.nodes.get(path.resolve(filePath));
  }

  public getDependencies(filePath: string): Set<string> {
    return this.edges.get(path.resolve(filePath)) || new Set<string>();
  }

  public getDependents(filePath: string): Set<string> {
    return this.revEdges.get(path.resolve(filePath)) || new Set<string>();
  }

  public getAllNodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * 3-color DFS cycle detection on the graph or a scoped subset of nodes.
   * Returns canonicalized, deduplicated cycle loops (e.g. [[A, B, A]]).
   */
  public detectCycles(scopeNodes?: string[]): string[][] {
    const targetNodes = (scopeNodes ? scopeNodes.map(f => path.resolve(f)) : this.getAllNodes())
      .filter(n => this.hasNode(n))
      .sort();

    const targetSet = new Set(targetNodes);
    // Colors: 0 = WHITE (unvisited), 1 = GRAY (visiting), 2 = BLACK (finished)
    const color = new Map<string, number>();
    for (const n of targetNodes) color.set(n, 0);

    const stack: string[] = [];
    const rawCycles: string[][] = [];

    const dfs = (u: string) => {
      color.set(u, 1);
      stack.push(u);

      const neighbors = Array.from(this.getDependencies(u))
        .filter(v => targetSet.has(v))
        .sort();

      for (const v of neighbors) {
        const vColor = color.get(v) ?? 0;
        if (vColor === 1) {
          // Back-edge detected!
          const idx = stack.indexOf(v);
          if (idx !== -1) {
            const cyclePath = stack.slice(idx).concat(v);
            rawCycles.push(cyclePath);
          }
        } else if (vColor === 0) {
          dfs(v);
        }
      }

      stack.pop();
      color.set(u, 2);
    };

    for (const node of targetNodes) {
      if ((color.get(node) ?? 0) === 0) {
        dfs(node);
      }
    }

    // Canonicalize and deduplicate cycles
    const seen = new Set<string>();
    const canonicalCycles: string[][] = [];

    for (const cycle of rawCycles) {
      const canonical = this.canonicalizeCycle(cycle);
      const key = canonical.join(' -> ');
      if (!seen.has(key)) {
        seen.add(key);
        canonicalCycles.push(canonical);
      }
    }

    return canonicalCycles;
  }

  /**
   * Canonicalize cycle representation by rotating the loop so the lexicographically
   * earliest file path is first.
   */
  private canonicalizeCycle(cycle: string[]): string[] {
    if (cycle.length <= 2) return cycle; // e.g. [A, A]
    const base = cycle.slice(0, -1);
    let minIdx = 0;
    for (let i = 1; i < base.length; i++) {
      if (base[i].localeCompare(base[minIdx]) < 0) {
        minIdx = i;
      }
    }
    const rotated = [...base.slice(minIdx), ...base.slice(0, minIdx)];
    rotated.push(rotated[0]);
    return rotated;
  }

  /**
   * Partition target nodes into Strongly Connected Components (SCCs) using Tarjan's algorithm.
   */
  public computeSccs(scopeNodes?: string[]): string[][] {
    const nodes = (scopeNodes ? scopeNodes.map(f => path.resolve(f)) : this.getAllNodes())
      .filter(n => this.hasNode(n));
    const nodeSet = new Set(nodes);

    let index = 0;
    const indices = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Map<string, boolean>();
    const stack: string[] = [];
    const sccs: string[][] = [];

    const strongConnect = (u: string) => {
      indices.set(u, index);
      lowlink.set(u, index);
      index++;
      stack.push(u);
      onStack.set(u, true);

      const neighbors = Array.from(this.getDependencies(u))
        .filter(v => nodeSet.has(v))
        .sort();

      for (const v of neighbors) {
        if (!indices.has(v)) {
          strongConnect(v);
          lowlink.set(u, Math.min(lowlink.get(u)!, lowlink.get(v)!));
        } else if (onStack.get(v)) {
          lowlink.set(u, Math.min(lowlink.get(u)!, indices.get(v)!));
        }
      }

      if (lowlink.get(u) === indices.get(u)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.set(w, false);
          scc.push(w);
        } while (w !== u);
        sccs.push(scc);
      }
    };

    const sortedNodes = [...nodes].sort();
    for (const node of sortedNodes) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return sccs;
  }

  /**
   * Attention-optimal leaf-first topological ordering.
   * Prerequisites and leaf models/interfaces are emitted first;
   * entry / focus files (which depend on everything) are emitted last.
   * Uses Kahn's algorithm on the reverse condensation DAG (G^SCC)^R.
   */
  public topologicalSortLeafFirst(scopeNodes?: string[]): string[] {
    const nodes = (scopeNodes ? scopeNodes.map(f => path.resolve(f)) : this.getAllNodes())
      .filter(n => this.hasNode(n));
    const nodeSet = new Set(nodes);

    const sccs = this.computeSccs(nodes);
    const numSccs = sccs.length;

    const fileToScc = new Map<string, number>();
    sccs.forEach((scc, idx) => {
      for (const f of scc) {
        fileToScc.set(f, idx);
      }
    });

    const inDegree = new Array<number>(numSccs).fill(0);
    const revAdj = new Map<number, Set<number>>();
    for (let i = 0; i < numSccs; i++) {
      revAdj.set(i, new Set<number>());
    }

    // Build reverse condensation edges: if u -> v (u depends on v),
    // then in prerequisite order, v must be emitted before u.
    // In the condensation graph, add directed edge SCC(v) -> SCC(u).
    for (const u of nodes) {
      const sccU = fileToScc.get(u)!;
      for (const v of this.getDependencies(u)) {
        if (!nodeSet.has(v)) continue;
        const sccV = fileToScc.get(v)!;
        if (sccU !== sccV) {
          const adjSet = revAdj.get(sccV)!;
          if (!adjSet.has(sccU)) {
            adjSet.add(sccU);
            inDegree[sccU]++;
          }
        }
      }
    }

    // Deterministic priority queue: sort SCCs by representative filename
    const getRep = (idx: number) => {
      const sorted = [...sccs[idx]].sort();
      return sorted[0];
    };

    const ready: number[] = [];
    for (let i = 0; i < numSccs; i++) {
      if (inDegree[i] === 0) {
        ready.push(i);
      }
    }
    ready.sort((a, b) => getRep(a).localeCompare(getRep(b)));

    const orderedFiles: string[] = [];

    while (ready.length > 0) {
      const currSccIdx = ready.shift()!;
      const componentFiles = [...sccs[currSccIdx]].sort();
      orderedFiles.push(...componentFiles);

      const dependents = Array.from(revAdj.get(currSccIdx)!).sort((a, b) => getRep(a).localeCompare(getRep(b)));
      for (const depScc of dependents) {
        inDegree[depScc]--;
        if (inDegree[depScc] === 0) {
          ready.push(depScc);
        }
      }

      ready.sort((a, b) => getRep(a).localeCompare(getRep(b)));
    }

    // In case of any unvisited nodes (defensive safeguard), append remaining sorted
    if (orderedFiles.length < nodes.length) {
      const emitted = new Set(orderedFiles);
      const remaining = nodes.filter(n => !emitted.has(n)).sort();
      orderedFiles.push(...remaining);
    }

    return orderedFiles;
  }
}
