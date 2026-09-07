import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import type { SupportedLanguage } from '../types.js';
import type { ModuleResolverOptions } from './types.js';

export class ModuleResolver {
  private repoRoot: string;
  private tsconfigPath?: string;
  private paths: Record<string, string[]> | null = null;
  private baseUrl: string | null = null;
  private goModCache: { moduleName: string; dir: string } | null = null;
  private extensions: string[];

  constructor(options: ModuleResolverOptions) {
    this.repoRoot = path.resolve(options.repoRoot);
    this.tsconfigPath = options.tsconfigPath;
    this.extensions = options.extensions || ['.ts', '.tsx', '.d.ts', '.js', '.jsx'];
    this.initTsConfig();
  }

  /**
   * Resolve an import specifier to an absolute file or directory path within the repository.
   * Returns null if external or unresolvable.
   */
  public resolve(
    fromFilePath: string,
    specifier: string,
    language?: SupportedLanguage
  ): string | null {
    const fromAbs = path.resolve(fromFilePath);
    const fromDir = path.dirname(fromAbs);
    const lang = language || this.detectLanguage(fromAbs);

    let resolved: string | null = null;

    switch (lang) {
      case 'typescript':
      case 'javascript':
        resolved = this.resolveTsJs(fromDir, specifier, lang);
        break;
      case 'python':
        resolved = this.resolvePython(fromDir, specifier);
        break;
      case 'go':
        resolved = this.resolveGo(fromDir, specifier);
        break;
      default:
        resolved = this.resolveTsJs(fromDir, specifier, 'typescript');
    }

    if (!resolved) return null;

    // Boundary check: ensure resolved path is inside repoRoot
    const rel = path.relative(this.repoRoot, resolved);
    if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) {
      return null;
    }

    return resolved;
  }

  /**
   * Resolve an import specifier to an array of concrete file paths.
   * For Go packages, expands a package directory into all contained source files.
   */
  public resolveFiles(
    fromFilePath: string,
    specifier: string,
    language?: SupportedLanguage
  ): string[] {
    const resolved = this.resolve(fromFilePath, specifier, language);
    if (!resolved) return [];

    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      // If Go package directory, return all non-test .go files
      const entries = fs.readdirSync(resolved);
      const goFiles = entries
        .filter(f => f.endsWith('.go') && !f.endsWith('_test.go'))
        .map(f => path.join(resolved, f));
      if (goFiles.length > 0) return goFiles;

      // If directory with index file
      for (const idx of ['index.ts', 'index.tsx', 'index.d.ts', 'index.js', 'index.jsx', '__init__.py']) {
        const idxPath = path.join(resolved, idx);
        if (fs.existsSync(idxPath) && fs.statSync(idxPath).isFile()) {
          return [idxPath];
        }
      }
    }

    return [resolved];
  }

  private resolveTsJs(fromDir: string, specifier: string, lang: 'typescript' | 'javascript'): string | null {
    // 1. Check tsconfig path aliases
    if (this.paths && this.baseUrl) {
      const sortedPatterns = Object.keys(this.paths).sort((a, b) => b.length - a.length);
      for (const pattern of sortedPatterns) {
        const targets = this.paths[pattern];
        const starIdx = pattern.indexOf('*');

        if (starIdx !== -1) {
          const prefix = pattern.slice(0, starIdx);
          const suffix = pattern.slice(starIdx + 1);
          if (specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
            const wildcardVal = specifier.slice(prefix.length, specifier.length - suffix.length);
            for (const target of targets) {
              const candidatePath = path.resolve(this.baseUrl, target.replace('*', wildcardVal));
              const probed = this.probeTsExtensions(candidatePath, lang);
              if (probed) return probed;
            }
          }
        } else if (specifier === pattern) {
          for (const target of targets) {
            const candidatePath = path.resolve(this.baseUrl, target);
            const probed = this.probeTsExtensions(candidatePath, lang);
            if (probed) return probed;
          }
        }
      }
    }

    // 2. Relative paths
    if (this.isRelative(specifier)) {
      const candidate = path.resolve(fromDir, specifier);
      return this.probeTsExtensions(candidate, lang);
    }

    return null;
  }

  private probeTsExtensions(candidate: string, lang: 'typescript' | 'javascript'): string | null {
    // ESM rewrite: .js -> .ts / .tsx / .d.ts
    if (/\.jsx?$/i.test(candidate)) {
      const base = candidate.replace(/\.jsx?$/i, '');
      if (lang === 'typescript') {
        for (const ext of ['.ts', '.tsx', '.d.ts']) {
          const p = base + ext;
          if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
        }
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      } else {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        for (const ext of ['.ts', '.tsx', '.d.ts']) {
          const p = base + ext;
          if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
        }
      }
    }

    // Direct file check
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }

    // Extension probing
    for (const ext of this.extensions) {
      const p = candidate + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    }

    // Directory index probing
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      for (const idx of ['index.ts', 'index.tsx', 'index.d.ts', 'index.js', 'index.jsx']) {
        const p = path.join(candidate, idx);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      }
    }

    return null;
  }

  private resolvePython(fromDir: string, specifier: string): string | null {
    if (specifier.startsWith('.')) {
      const match = specifier.match(/^(\.+)(.*)$/);
      if (match) {
        const dots = match[1].length;
        const subpath = match[2];
        let baseDir = fromDir;
        for (let i = 1; i < dots; i++) {
          baseDir = path.dirname(baseDir);
        }
        const clean = subpath ? subpath.replace(/\./g, '/') : '';
        if (!clean) {
          const initPy = path.join(baseDir, '__init__.py');
          if (fs.existsSync(initPy) && fs.statSync(initPy).isFile()) return initPy;
          return baseDir;
        }
        const fileCandidate = path.join(baseDir, clean + '.py');
        if (fs.existsSync(fileCandidate) && fs.statSync(fileCandidate).isFile()) return fileCandidate;
        const initCandidate = path.join(baseDir, clean, '__init__.py');
        if (fs.existsSync(initCandidate) && fs.statSync(initCandidate).isFile()) return initCandidate;
      }
    } else {
      const clean = specifier.replace(/\./g, '/');
      const candidates = [
        path.join(this.repoRoot, clean + '.py'),
        path.join(this.repoRoot, clean, '__init__.py'),
        path.join(this.repoRoot, 'src', clean + '.py'),
        path.join(this.repoRoot, 'src', clean, '__init__.py'),
        path.join(fromDir, clean + '.py'),
        path.join(fromDir, clean, '__init__.py')
      ];
      for (const c of candidates) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
      }
    }
    return null;
  }

  private resolveGo(fromDir: string, specifier: string): string | null {
    this.initGoMod(fromDir);
    if (this.goModCache) {
      const { moduleName, dir } = this.goModCache;
      if (specifier === moduleName) {
        return dir;
      }
      if (specifier.startsWith(moduleName + '/')) {
        const sub = specifier.slice(moduleName.length + 1);
        const target = path.resolve(dir, sub);
        if (fs.existsSync(target)) {
          return target;
        }
      }
    }
    if (this.isRelative(specifier)) {
      const candidate = path.resolve(fromDir, specifier);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private isRelative(specifier: string): boolean {
    return (
      specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier === '.' ||
      specifier === '..' ||
      specifier.startsWith('.\\') ||
      specifier.startsWith('..\\')
    );
  }

  private initTsConfig(): void {
    let configPath = this.tsconfigPath;
    if (!configPath) {
      const candidate = path.join(this.repoRoot, 'tsconfig.json');
      if (fs.existsSync(candidate)) configPath = candidate;
    }
    if (configPath && fs.existsSync(configPath)) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.config) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath)
        );
        if (parsed.options.paths) {
          this.paths = parsed.options.paths as Record<string, string[]>;
          this.baseUrl = parsed.options.baseUrl || path.dirname(configPath);
        }
      }
    }
  }

  private initGoMod(fromDir: string): void {
    if (this.goModCache) return;
    let curr = fromDir;
    while (curr.startsWith(this.repoRoot) || curr === this.repoRoot) {
      const candidate = path.join(curr, 'go.mod');
      if (fs.existsSync(candidate)) {
        try {
          const content = fs.readFileSync(candidate, 'utf-8');
          const match = content.match(/^module\s+([^\s\r\n]+)/m);
          if (match) {
            this.goModCache = { moduleName: match[1], dir: curr };
            return;
          }
        } catch {
          // ignore read error
        }
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }
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
}
