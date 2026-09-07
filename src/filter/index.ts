import fs from 'fs';
import path from 'path';
import {
  BUILTIN_IGNORE_DIRS,
  BUILTIN_IGNORE_FILES,
  BUILTIN_IGNORE_EXTENSIONS
} from './default-ignores.js';
import type { FilterOptions, GitignoreRule } from './types.js';

export class FilterEngine {
  private repoRoot: string;
  private rules: GitignoreRule[] = [];

  constructor(options: FilterOptions) {
    this.repoRoot = path.resolve(options.repoRoot);

    const enableGitignore = options.enableGitignore ?? true;
    const enableContextdietignore = options.enableContextdietignore ?? true;

    // Load .gitignore
    if (enableGitignore) {
      const gitignorePath = path.join(this.repoRoot, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        this.loadIgnoreFile(gitignorePath);
      }
    }

    // Load .contextdietignore
    if (enableContextdietignore) {
      const dietignorePath = path.join(this.repoRoot, '.contextdietignore');
      if (fs.existsSync(dietignorePath)) {
        this.loadIgnoreFile(dietignorePath);
      }
    }

    // Load custom patterns
    if (options.customPatterns) {
      for (const pat of options.customPatterns) {
        const rule = this.parseRule(pat);
        if (rule) this.rules.push(rule);
      }
    }
  }

  /**
   * Pure string-based path evaluation.
   * Returns true if the path should be ignored.
   * Does NOT require the file or directory to exist on disk.
   */
  public isIgnored(targetPath: string): boolean {
    if (!targetPath) return false;

    // Normalize path separators
    let normalized = targetPath.replace(/\\/g, '/');

    // Make relative to repoRoot if absolute
    if (path.isAbsolute(targetPath)) {
      normalized = path.relative(this.repoRoot, targetPath).replace(/\\/g, '/');
      if (normalized.startsWith('..' + path.sep) || normalized === '..') {
        return true; // outside repository
      }
    }

    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }

    if (!normalized || normalized === '.') {
      return false;
    }

    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) return false;

    // 1. Built-in Directory Check: if any segment matches built-in ignore dirs
    for (const seg of segments) {
      if (BUILTIN_IGNORE_DIRS.has(seg)) {
        return true;
      }
    }

    // 2. Built-in Filename Check
    const filename = segments[segments.length - 1];
    if (BUILTIN_IGNORE_FILES.has(filename)) {
      return true;
    }

    // 3. Built-in Extension Check
    const ext = path.extname(filename).toLowerCase();
    if (ext && BUILTIN_IGNORE_EXTENSIONS.has(ext)) {
      return true;
    }

    // 4. User-Defined Rules (.gitignore, .contextdietignore, CLI custom patterns)
    let ignored = false;
    for (const rule of this.rules) {
      if (rule.regex.test(normalized)) {
        ignored = !rule.isNegative;
      }
    }

    return ignored;
  }

  /**
   * Filter an array of file paths, retaining only non-ignored files.
   */
  public filterFiles(filePaths: string[]): string[] {
    return filePaths.filter(fp => !this.isIgnored(fp));
  }

  private loadIgnoreFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const rule = this.parseRule(line);
        if (rule) {
          this.rules.push(rule);
        }
      }
    } catch {
      // ignore read failures
    }
  }

  private parseRule(line: string): GitignoreRule | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    let pat = trimmed;
    let isNegative = false;
    if (pat.startsWith('!')) {
      isNegative = true;
      pat = pat.slice(1);
    }

    let isDirOnly = false;
    if (pat.endsWith('/')) {
      isDirOnly = true;
      pat = pat.slice(0, -1);
    }

    const hasSlash = pat.includes('/');
    let isRootRelative = false;
    if (pat.startsWith('/')) {
      isRootRelative = true;
      pat = pat.slice(1);
    } else if (hasSlash) {
      isRootRelative = true;
    }

    let regexStr = '';
    let i = 0;
    while (i < pat.length) {
      const char = pat[i];
      if (char === '*' && pat[i + 1] === '*') {
        if (pat[i + 2] === '/') {
          regexStr += '(?:.*?/)?';
          i += 3;
        } else {
          regexStr += '.*';
          i += 2;
        }
      } else if (char === '*') {
        regexStr += '[^/]*';
        i++;
      } else if (char === '?') {
        regexStr += '[^/]';
        i++;
      } else if (['.', '(', ')', '+', '|', '^', '$', '{', '}', '[', ']', '\\'].includes(char)) {
        regexStr += '\\' + char;
        i++;
      } else {
        regexStr += char;
        i++;
      }
    }

    if (!isRootRelative) {
      regexStr = '(?:^|.*/)' + regexStr;
    } else {
      regexStr = '^' + regexStr;
    }

    regexStr += '(/.*)?$';

    return {
      isNegative,
      isDirOnly,
      regex: new RegExp(regexStr),
      sourcePattern: line
    };
  }
}

export * from './types.js';
export * from './default-ignores.js';
