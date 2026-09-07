import type { SupportedLanguage } from '../types.js';
import type { DependencyGraph } from './graph.js';

export interface ImportInfo {
  specifier: string;
  kind?: 'import' | 'export' | 'require' | 'dynamic';
  isRelative: boolean;
  start?: number;
  end?: number;
}

export interface ModuleResolverOptions {
  repoRoot: string;
  tsconfigPath?: string;
  extensions?: string[];
}

export interface DependencyNode {
  filePath: string;
  relativePath: string;
  language: SupportedLanguage | 'other';
  dependencies: Set<string>;
  dependents: Set<string>;
  isFocus?: boolean;
}

export interface DependencyGraphBuilderOptions {
  repoRoot: string;
  tsconfigPath?: string;
  ignoreFilter?: (filePath: string) => boolean;
  filter?: { isIgnored: (filePath: string) => boolean };
}

export interface GraphBuildResult {
  graph: DependencyGraph;
  reachableFiles: string[];
  orderedFiles: string[];
  cycles: string[][];
}
