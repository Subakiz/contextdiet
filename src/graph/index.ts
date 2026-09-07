import fs from 'fs';
import path from 'path';
import { DependencyGraph } from './graph.js';
import { extractImports } from './scanner.js';
import { ModuleResolver } from './resolver.js';
import type {
  DependencyGraphBuilderOptions,
  GraphBuildResult
} from './types.js';
import type { SupportedLanguage } from '../types.js';

export class DependencyGraphBuilder {
  private repoRoot: string;
  private resolver: ModuleResolver;
  private options: DependencyGraphBuilderOptions;

  constructor(options: DependencyGraphBuilderOptions) {
    this.options = options;
    this.repoRoot = path.resolve(options.repoRoot);
    this.resolver = new ModuleResolver({
      repoRoot: this.repoRoot,
      tsconfigPath: options.tsconfigPath
    });
  }

  /**
   * Build the dependency graph starting from entry files (or all repo files if none given).
   * Safe against circular imports with finite O(V + E) termination.
   */
  public async build(entryFiles?: string[]): Promise<GraphBuildResult> {
    const graph = new DependencyGraph();

    // 1. Determine root targets
    const initialFiles: string[] = [];
    const isEntrySpecified = entryFiles && entryFiles.length > 0;

    if (isEntrySpecified) {
      for (const f of entryFiles!) {
        const resolved = path.isAbsolute(f) ? path.resolve(f) : path.resolve(this.repoRoot, f);
        if (fs.existsSync(resolved)) {
          initialFiles.push(resolved);
        }
      }
    } else {
      initialFiles.push(...this.discoverRepoSourceFiles());
    }

    // 2. Safe iterative BFS traversal
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const f of initialFiles) {
      visited.add(f);
      queue.push(f);
      graph.addNode(f, {
        relativePath: path.relative(this.repoRoot, f).replace(/\\/g, '/'),
        language: this.detectLanguage(f),
        isFocus: isEntrySpecified
      });
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      let content = '';
      try {
        content = fs.readFileSync(current, 'utf-8');
      } catch {
        continue;
      }

      const lang = this.detectLanguage(current);
      const imports = extractImports(content, lang, current);

      for (const imp of imports) {
        const resolvedFiles = this.resolver.resolveFiles(current, imp.specifier, lang);

        for (const resolved of resolvedFiles) {
          const resolvedAbs = path.resolve(resolved);
          if (this.isIgnored(resolvedAbs)) {
            continue;
          }

          graph.addEdge(current, resolvedAbs);

          if (!visited.has(resolvedAbs)) {
            visited.add(resolvedAbs);
            queue.push(resolvedAbs);
          }
        }
      }
    }

    const reachableFiles = Array.from(visited);

    // 3. Detect circular dependencies
    const cycles = graph.detectCycles(reachableFiles);

    // 4. Attention-optimal leaf-first topological sort
    const orderedFiles = graph.topologicalSortLeafFirst(reachableFiles);

    return {
      graph,
      reachableFiles,
      orderedFiles,
      cycles
    };
  }

  private isIgnored(filePath: string): boolean {
    if (this.options.ignoreFilter && this.options.ignoreFilter(filePath)) return true;
    if (this.options.filter && this.options.filter.isIgnored(filePath)) return true;
    return false;
  }

  private detectLanguage(filePath: string): SupportedLanguage {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.mts') || lower.endsWith('.cts')) {
      return 'typescript';
    }
    if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
      return 'javascript';
    }
    if (lower.endsWith('.py')) return 'python';
    if (lower.endsWith('.go')) return 'go';
    return 'typescript';
  }

  private discoverRepoSourceFiles(): string[] {
    const results: string[] = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (this.isIgnored(full)) continue;

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          const lower = entry.name.toLowerCase();
          if (
            lower.endsWith('.ts') ||
            lower.endsWith('.tsx') ||
            lower.endsWith('.js') ||
            lower.endsWith('.jsx') ||
            lower.endsWith('.py') ||
            lower.endsWith('.go')
          ) {
            results.push(full);
          }
        }
      }
    };

    walk(this.repoRoot);
    return results;
  }
}

export * from './types.js';
export * from './scanner.js';
export * from './resolver.js';
export * from './graph.js';
