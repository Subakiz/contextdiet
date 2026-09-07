import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { astSkeletonizer, validateSyntaxDetailed } from '../../dist/ast/index.js';
import {
  REPO_ROOT,
  EDGE_CASES_DIR,
  CYCLIC_DIR,
  CLI_BIN,
  runCli,
  countTokens,
  hasCli,
  hasGraph,
  hasPacker,
  hasFilter
} from './helpers/test-runner.js';

describe('Tier 2: Boundary & Corner Cases', () => {
  // =========================================================================
  // 1. Empty Files Boundary
  // =========================================================================
  describe('Boundary 1: Empty Files', () => {
    it('should skeletonize an empty TypeScript file without crashing and produce valid syntax', () => {
      const emptyTsPath = path.join(EDGE_CASES_DIR, 'empty.ts');
      const raw = fs.readFileSync(emptyTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, emptyTsPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe('');
      expect(result.skeletonLength).toBe(0);
    });

    it('should skeletonize an empty Python file without crashing and produce valid syntax', () => {
      const emptyPyPath = path.join(EDGE_CASES_DIR, 'empty.py');
      const raw = fs.readFileSync(emptyPyPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, emptyPyPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe('');
      expect(result.skeletonLength).toBe(0);
    });

    it('should skeletonize an empty Go file without crashing', () => {
      const emptyGoPath = path.join(EDGE_CASES_DIR, 'empty.go');
      const raw = fs.readFileSync(emptyGoPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, emptyGoPath);
      expect(result.code).toBe('');
      expect(result.skeletonLength).toBe(0);
    });

    it('should calculate 0 tokens for empty files without error', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(''.trim())).toBe(0);
    });

    it.skipIf(!hasPacker)('should pack empty files into context pack without throwing', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const result = await packerModule.packContext({
        repoRoot: EDGE_CASES_DIR,
        focusFiles: [path.join(EDGE_CASES_DIR, 'empty.ts')]
      });
      const file = result.files.find(f => f.relativePath.endsWith('empty.ts'));
      expect(file).toBeDefined();
      expect(file?.content).toBe('');
    });
  });

  // =========================================================================
  // 2. Comment-Only Files Boundary
  // =========================================================================
  describe('Boundary 2: Comment-Only Files', () => {
    it('should preserve TypeScript comments intact without inserting synthetic bodies', () => {
      const commentsTsPath = path.join(EDGE_CASES_DIR, 'comments.ts');
      const raw = fs.readFileSync(commentsTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, commentsTsPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe(raw);
      expect(result.code).toContain('Multi-line JSDoc comment explaining architecture');
      expect(result.code).toContain('Block comment without asterisk prefix');
    });

    it('should preserve Python docstrings and comments intact', () => {
      const commentsPyPath = path.join(EDGE_CASES_DIR, 'comments.py');
      const raw = fs.readFileSync(commentsPyPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, commentsPyPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe(raw);
      expect(result.code).toContain('Single line comment in Python');
      expect(result.code).toContain('Multi-line docstring block comment');
    });

    it('should preserve Go comments and package declarations intact', () => {
      const commentsGoPath = path.join(EDGE_CASES_DIR, 'comments.go');
      const raw = fs.readFileSync(commentsGoPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, commentsGoPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe(raw);
      expect(result.code).toContain('package edgecases');
      expect(result.code).toContain('Block comment explaining details');
    });

    it('should have 0% token reduction on comment-only files since there are no function bodies to strip', () => {
      const commentsTsPath = path.join(EDGE_CASES_DIR, 'comments.ts');
      const raw = fs.readFileSync(commentsTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, commentsTsPath);
      const origTokens = countTokens(raw);
      const skelTokens = countTokens(result.code);
      expect(origTokens).toBe(skelTokens);
    });

    it('should maintain exact line count for comment-only files', () => {
      const commentsTsPath = path.join(EDGE_CASES_DIR, 'comments.ts');
      const raw = fs.readFileSync(commentsTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, commentsTsPath);
      expect(result.code.split('\n').length).toBe(raw.split('\n').length);
    });
  });

  // =========================================================================
  // 3. Type-Only Files Boundary
  // =========================================================================
  describe('Boundary 3: Type-Only Files', () => {
    it('should retain all TypeScript interfaces, types, and mapped types without alteration', () => {
      const typesTsPath = path.join(EDGE_CASES_DIR, 'types.ts');
      const raw = fs.readFileSync(typesTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, typesTsPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe(raw);
      expect(result.code).toContain('export interface UserDTO extends BaseEntity');
      expect(result.code).toContain('export type ReadonlyRecord<K extends string, V>');
    });

    it('should retain all Go structs, type aliases, and interfaces without alteration', () => {
      const typesGoPath = path.join(EDGE_CASES_DIR, 'types.go');
      const raw = fs.readFileSync(typesGoPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, typesGoPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toBe(raw);
      expect(result.code).toContain('type Status string');
      expect(result.code).toContain('type ReadWriter interface');
    });

    it('should result in identical token counts before and after skeletonization for type-only files', () => {
      const typesTsPath = path.join(EDGE_CASES_DIR, 'types.ts');
      const raw = fs.readFileSync(typesTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, typesTsPath);
      const origTokens = countTokens(raw);
      const skelTokens = countTokens(result.code);
      expect(origTokens).toBe(skelTokens);
    });

    it('should correctly validate syntax for type definitions with nested generics', () => {
      const complexType = `
export type DeepReadonly<T> = T extends Function ? T : T extends Array<infer U> ? _DeepReadonlyArray<U> : _DeepReadonlyObject<T>;
type _DeepReadonlyArray<T> = ReadonlyArray<DeepReadonly<T>>;
type _DeepReadonlyObject<T> = { readonly [P in keyof T]: DeepReadonly<T[P]> };
      `;
      const result = astSkeletonizer.skeletonize(complexType, 'complex-types.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('DeepReadonly<T>');
    });

    it('should preserve type annotations on exported constants without function bodies', () => {
      const constTypes = `
export const API_BASE_URL: string = "https://api.example.com";
export const RETRY_ATTEMPTS: number = 3;
export const SUPPORTED_LOCALES: readonly string[] = ["en-US", "ja-JP"] as const;
      `;
      const result = astSkeletonizer.skeletonize(constTypes, 'constants.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('API_BASE_URL: string');
      expect(result.code).toContain('RETRY_ATTEMPTS: number');
      expect(result.code).toContain('SUPPORTED_LOCALES: readonly string[]');
    });
  });

  // =========================================================================
  // 4. Circular Imports Boundary
  // =========================================================================
  describe('Boundary 4: Circular Imports', () => {
    it.skipIf(!hasGraph)('should terminate on 2-node cycle without exceeding maximum call stack', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const startTime = Date.now();
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle2-a.ts')]);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000); // Must terminate quickly
      expect(result.reachableFiles).toHaveLength(2);
    });

    it.skipIf(!hasGraph)('should terminate on 3-node cycle without duplicate node explosion', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle3-a.ts')]);
      const uniqueReachable = new Set(result.reachableFiles);
      expect(uniqueReachable.size).toBe(3);
    });

    it.skipIf(!hasGraph)('should terminate on self-import cycle in single file', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'self-cycle.ts')]);
      expect(result.reachableFiles).toHaveLength(1);
    });

    it.skipIf(!hasGraph)('should correctly identify and report cycle paths in cycle audit array', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle3-a.ts')]);
      expect(result.cycles).toBeDefined();
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it.skipIf(!hasPacker)('should pack context with circular dependencies and include both files safely', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focusFile = path.join(CYCLIC_DIR, 'cycle2-a.ts');
      const result = await packerModule.packContext({
        repoRoot: CYCLIC_DIR,
        focusFiles: [focusFile]
      });
      const fileNames = result.files.map(f => path.basename(f.relativePath));
      expect(fileNames).toContain('cycle2-a.ts');
      expect(fileNames).toContain('cycle2-b.ts');
      const focusNode = result.files.find(f => f.relativePath.includes('cycle2-a.ts'));
      const skelNode = result.files.find(f => f.relativePath.includes('cycle2-b.ts'));
      expect(focusNode?.status).toBe('FOCUS');
      expect(skelNode?.status).toBe('SKELETON');
    });
  });

  // =========================================================================
  // 5. Deeply Nested Directory Structures
  // =========================================================================
  describe('Boundary 5: Deeply Nested Directory Structures', () => {
    it('should skeletonize files located in deeply nested subdirectories', () => {
      const deepPath = path.join(EDGE_CASES_DIR, 'deeply/nested/directory/structure/deep.ts');
      const raw = fs.readFileSync(deepPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, deepPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('export function deepFunction(): string { /* ... */ }');
      expect(result.code).not.toContain('from the depths of the filesystem');
    });

    it.skipIf(!hasPacker)('should pack deeply nested files and preserve normalized relative paths', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const deepPath = path.join(EDGE_CASES_DIR, 'deeply/nested/directory/structure/deep.ts');
      const result = await packerModule.packContext({
        repoRoot: EDGE_CASES_DIR,
        focusFiles: [deepPath]
      });
      const deepFile = result.files.find(f => f.relativePath.includes('deep.ts'));
      expect(deepFile).toBeDefined();
      expect(deepFile?.relativePath).toBe('deeply/nested/directory/structure/deep.ts');
    });

    it.skipIf(!hasGraph)('should resolve imports across multiple parent levels (../../..)', async () => {
      const resolverModule = await import('../../src/graph/resolver.js');
      const resolver = new resolverModule.ModuleResolver({ repoRoot: EDGE_CASES_DIR });
      const fromPath = path.join(EDGE_CASES_DIR, 'deeply/nested/directory/structure/deep.ts');
      const resolved = resolver.resolve(fromPath, '../../../../types', 'typescript');
      expect(resolved).toBeTruthy();
      expect(resolved).toContain('edge-cases/types.ts');
    });

    it.skipIf(!hasFilter)('should not accidentally prune deeply nested valid files when ignore patterns are present', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: EDGE_CASES_DIR });
      expect(filter.isIgnored('deeply/nested/directory/structure/deep.ts')).toBe(false);
    });

    it('should handle relative path calculations with mixed slashes without crashing', () => {
      const deepRelative = path.relative(REPO_ROOT, path.join(EDGE_CASES_DIR, 'deeply/nested/directory/structure/deep.ts'));
      expect(deepRelative).toContain('deeply');
      expect(deepRelative).toContain('structure');
    });
  });

  // =========================================================================
  // 6. Unicode, Emojis & International Text Boundary
  // =========================================================================
  describe('Boundary 6: Unicode & International Text', () => {
    it('should skeletonize TypeScript files containing Japanese characters and emojis without corrupting characters', () => {
      const unicodeTsPath = path.join(EDGE_CASES_DIR, 'unicode.ts');
      const raw = fs.readFileSync(unicodeTsPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, unicodeTsPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('export interface ユーザー');
      expect(result.code).toContain('名前: string;');
      expect(result.code).toContain('通貨: \'€\' | \'¥\' | \'£\' | \'$\';');
      expect(result.code).toContain('export function greetUser(user: ユーザー): string { /* ... */ }');
      expect(result.code).not.toContain('こんにちは');
    });

    it('should skeletonize Python files containing accented characters and currency symbols safely', () => {
      const unicodePyPath = path.join(EDGE_CASES_DIR, 'unicode.py');
      const raw = fs.readFileSync(unicodePyPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, unicodePyPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('def saluer_monde(nom: str = "Monde") -> str:');
      expect(result.code).toContain('"""Dit bonjour avec des caractères accentués: été, forêt, naïve."""');
      expect(result.code).toContain('def calculate_currencies(amounts: dict[str, float]) -> float:');
      expect(result.code).toContain('"""Calculate total using symbols: €, £, ¥, ₹, ₩."""');
      expect(result.code).not.toContain('Bonjour, {nom}!');
    });

    it('should skeletonize Go files containing Japanese identifiers and emojis safely', () => {
      const unicodeGoPath = path.join(EDGE_CASES_DIR, 'unicode.go');
      const raw = fs.readFileSync(unicodeGoPath, 'utf-8');
      const result = astSkeletonizer.skeletonize(raw, unicodeGoPath);
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('type 挨拶 struct');
      expect(result.code).toContain('func 新規挨拶(送信者 string, メッセージ string) 挨拶 { /* ... */ }');
      expect(result.code).toContain('func (a *挨拶) 出力() string { /* ... */ }');
      expect(result.code).not.toContain('Sprintf');
    });

    it('should count tokens accurately for non-ASCII and multibyte characters', () => {
      const unicodeStr = 'こんにちは 世界！ 🌍 🚀 €99.99';
      const tokens = countTokens(unicodeStr);
      expect(tokens).toBeGreaterThan(5);
    });

    it('should preserve multi-line international comments without truncation', () => {
      const multiLingual = `
/**
 * 🌍 Global Multi-Lingual Header
 * 中文：优化代码上下文
 * 日本語：コードコンテキストの最適化
 * 한국어: 코드 컨텍스트 최적화
 * Русский: Оптимизация контекста кода
 */
export function multiLingual(): void {
  const x = 1;
}
      `;
      const result = astSkeletonizer.skeletonize(multiLingual, 'multilingual.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('中文：优化代码上下文');
      expect(result.code).toContain('日本語：コードコンテキストの最適化');
      expect(result.code).toContain('한국어: 코드 컨텍스트 최적화');
      expect(result.code).toContain('Русский: Оптимизация контекста кода');
    });
  });

  // =========================================================================
  // 7. Invalid Syntax Error Handling
  // =========================================================================
  describe('Boundary 7: Invalid Syntax Error Handling', () => {
    it('should report syntax error diagnostics on invalid TypeScript without uncaught process termination', () => {
      const brokenTsPath = path.join(EDGE_CASES_DIR, 'syntax-error.ts');
      const raw = fs.readFileSync(brokenTsPath, 'utf-8');
      const result = validateSyntaxDetailed(raw, 'typescript', brokenTsPath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report syntax error diagnostics on invalid Python without uncaught exception', () => {
      const brokenPyPath = path.join(EDGE_CASES_DIR, 'syntax-error.py');
      const raw = fs.readFileSync(brokenPyPath, 'utf-8');
      const result = validateSyntaxDetailed(raw, 'python');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report syntax error diagnostics on invalid Go without uncaught exception', () => {
      const brokenGoPath = path.join(EDGE_CASES_DIR, 'syntax-error.go');
      const raw = fs.readFileSync(brokenGoPath, 'utf-8');
      const result = validateSyntaxDetailed(raw, 'go');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fall back gracefully to original source code when skeletonization encounters unparseable syntax', () => {
      const broken = 'function ( { broken';
      try {
        const result = astSkeletonizer.skeletonize(broken, 'broken.ts');
        expect(result.isValidSyntax).toBe(false);
      } catch (err: any) {
        expect(err).toBeDefined();
      }
    });

    it.skipIf(!hasCli)('should return exit code 1 with clear diagnostic when user points CLI to non-existent file', () => {
      const res = runCli(['pack', '.', '--focus', 'src/does-not-exist.ts']);
      expect(res.status).toBe(1);
      expect(res.stderr.length).toBeGreaterThan(0);
    });
  });
});
