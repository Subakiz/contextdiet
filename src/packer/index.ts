import fs from 'fs';
import path from 'path';
import type {
  PackOptions,
  PackedFile,
  DependencyGraphResult,
  FileStatus,
  SupportedLanguage
} from '../types.js';
import { FilterEngine } from '../filter/index.js';
import { DependencyGraphBuilder } from '../graph/index.js';
import { astSkeletonizer } from '../ast/index.js';

export async function packContext(options: PackOptions): Promise<DependencyGraphResult> {
  const repoRoot = path.resolve(options.repoRoot);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    throw new Error(`Repository root not found or is not a directory: ${repoRoot}`);
  }

  // 1. Initialize FilterEngine
  const filter = new FilterEngine({
    repoRoot,
    customPatterns: options.ignorePatterns
  });

  // 2. Discover all non-ignored source files in repository
  const allRepoFiles = discoverSourceFiles(repoRoot, repoRoot, filter);

  // 3. Process Focus Files
  const hasFocus = options.focusFiles && options.focusFiles.length > 0;
  const targetFiles: string[] = [];
  const focusSet = new Set<string>();

  if (hasFocus) {
    for (const f of options.focusFiles!) {
      const resolved = path.isAbsolute(f) ? path.resolve(f) : path.resolve(repoRoot, f);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Focus file not found: ${resolved}`);
      }
      focusSet.add(resolved);
      targetFiles.push(resolved);
    }
  } else {
    targetFiles.push(...allRepoFiles);
  }

  // 4. Build Dependency Graph
  const builder = new DependencyGraphBuilder({
    repoRoot,
    tsconfigPath: options.tsconfigPath,
    ignoreFilter: (p: string) => filter.isIgnored(p)
  });

  const graphResult = await builder.build(targetFiles);

  // 5. Calculate Unreachable Pruned Count
  const reachableSet = new Set(graphResult.reachableFiles);
  const unreachablePrunedCount = hasFocus
    ? Math.max(0, allRepoFiles.length - reachableSet.size)
    : 0;

  // 6. Assemble Packed Files
  const packedFiles: PackedFile[] = [];

  for (const filePath of graphResult.orderedFiles) {
    let rawContent = '';
    try {
      rawContent = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    const detectedLang = astSkeletonizer.detectLanguage(filePath);
    const language: SupportedLanguage | 'other' = detectedLang || 'other';

    const isFocus = focusSet.has(filePath);
    const status: FileStatus = hasFocus ? (isFocus ? 'FOCUS' : 'SKELETON') : 'SKELETON';

    let content = rawContent;
    if (status === 'SKELETON' && !options.noDiet) {
      if (astSkeletonizer.canHandle(filePath)) {
        try {
          const skelResult = astSkeletonizer.skeletonize(rawContent, filePath);
          content = skelResult.code;
        } catch {
          content = rawContent;
        }
      }
      if (
        !content.includes('/* ... */') &&
        (language === 'typescript' || language === 'javascript' || language === 'go')
      ) {
        content = content ? `${content}\n/* ... */` : '/* ... */';
      }
    }

    packedFiles.push({
      filePath,
      relativePath,
      language,
      status,
      content,
      rawContent
    });
  }

  return {
    files: packedFiles,
    cycles: graphResult.cycles || [],
    unreachablePrunedCount
  };
}

function discoverSourceFiles(dir: string, repoRoot: string, filter: FilterEngine): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (filter.isIgnored(relPath) || filter.isIgnored(entry.name)) {
        continue;
      }
      results.push(...discoverSourceFiles(fullPath, repoRoot, filter));
    } else if (entry.isFile()) {
      if (!filter.isIgnored(relPath)) {
        const lower = entry.name.toLowerCase();
        if (
          lower.endsWith('.ts') ||
          lower.endsWith('.tsx') ||
          lower.endsWith('.mts') ||
          lower.endsWith('.cts') ||
          lower.endsWith('.js') ||
          lower.endsWith('.jsx') ||
          lower.endsWith('.mjs') ||
          lower.endsWith('.cjs') ||
          lower.endsWith('.py') ||
          lower.endsWith('.go')
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  return results;
}

export * from './types.js';
