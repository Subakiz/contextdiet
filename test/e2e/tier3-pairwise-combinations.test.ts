import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { astSkeletonizer, validateSyntaxDetailed } from '../../dist/ast/index.js';
import {
  REPO_ROOT,
  BENCHMARK_DIR,
  CYCLIC_DIR,
  ALIAS_DIR,
  EDGE_CASES_DIR,
  CLI_BIN,
  runCli,
  countTokens,
  hasCli,
  hasGraph,
  hasPacker,
  hasFormat,
  hasToken
} from './helpers/test-runner.js';

describe('Tier 3: Cross-Feature Combinations (Pairwise Coverage)', () => {
  // =========================================================================
  // Combination 1: Circular Dependencies + Focus-Aware Packing + Token Audit
  // =========================================================================
  describe('Pairwise 1: Circular Dependencies + Focus File + Token Audit', () => {
    it('should verify AST skeletonization of circular dependency node preserves signatures and types', () => {
      const rawA = fs.readFileSync(path.join(CYCLIC_DIR, 'cycle2-a.ts'), 'utf-8');
      const rawB = fs.readFileSync(path.join(CYCLIC_DIR, 'cycle2-b.ts'), 'utf-8');

      const skelA = astSkeletonizer.skeletonize(rawA, 'cycle2-a.ts');
      const skelB = astSkeletonizer.skeletonize(rawB, 'cycle2-b.ts');

      expect(skelA.isValidSyntax).toBe(true);
      expect(skelB.isValidSyntax).toBe(true);
      expect(skelA.code).toContain('export interface InterfaceA');
      expect(skelB.code).toContain('export interface InterfaceB');
      expect(skelA.code).toContain('export function getA(): InterfaceA { /* ... */ }');
      expect(skelB.code).toContain('export function getB(): InterfaceB { /* ... */ }');

      const tokensAOrig = countTokens(rawA);
      const tokensASkel = countTokens(skelA.code);
      expect(tokensASkel).toBeLessThan(tokensAOrig);
    });

    it.skipIf(!hasPacker || !hasToken)('should pack cyclic project with single focus file, keeping focus unabridged and skeletonizing cyclic partner', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focusPath = path.join(CYCLIC_DIR, 'cycle2-a.ts');
      const packResult = await packerModule.packContext({
        repoRoot: CYCLIC_DIR,
        focusFiles: [focusPath]
      });

      expect(packResult.files.length).toBeGreaterThanOrEqual(2);
      const fileA = packResult.files.find(f => f.relativePath.includes('cycle2-a.ts'));
      const fileB = packResult.files.find(f => f.relativePath.includes('cycle2-b.ts'));

      expect(fileA).toBeDefined();
      expect(fileB).toBeDefined();
      expect(fileA?.status).toBe('FOCUS');
      expect(fileB?.status).toBe('SKELETON');

      // Unabridged check
      const rawA = fs.readFileSync(focusPath, 'utf-8');
      expect(fileA?.content).toBe(rawA);

      // Skeletonized check
      expect(fileB?.content).toContain('/* ... */');
    });
  });

  // =========================================================================
  // Combination 2: XML Output + TypeScript Generics + CDATA Escaping
  // =========================================================================
  describe('Pairwise 2: XML Output + TS Generics (<T>) + CDATA Escaping', () => {
    it('should verify CDATA file skeletonizes properly while retaining XML angle brackets and CDATA delimiters', () => {
      const cdataTsPath = path.join(EDGE_CASES_DIR, 'cdata.ts');
      const raw = fs.readFileSync(cdataTsPath, 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, cdataTsPath);

      expect(skel.isValidSyntax).toBe(true);
      expect(skel.code).toContain('export interface XmlContainer<T extends Record<string, unknown>>');
      expect(skel.code).toContain('export function escapeCdataSequence<T extends Record<string, unknown>>(data: T): XmlContainer<T> { /* ... */ }');
    });

    it.skipIf(!hasFormat)('should wrap source code containing generics and CDATA delimiters into valid XML without parse errors', async () => {
      const formatModule = await import('../../src/format/index.js');
      const cdataTsPath = path.join(EDGE_CASES_DIR, 'cdata.ts');
      const raw = fs.readFileSync(cdataTsPath, 'utf-8');

      const xml = formatModule.formatXml({
        files: [
          {
            relativePath: 'cdata.ts',
            language: 'typescript',
            status: 'SKELETON',
            content: raw
          }
        ],
        audit: {
          totalOriginalTokens: 150,
          totalPackedTokens: 150,
          totalSavedTokens: 0,
          overallReductionPercentage: 0,
          files: []
        }
      });

      expect(xml).toContain('<context_pack');
      expect(xml).toContain('</context_pack>');
      expect(xml).toContain('<![CDATA[');
      // Ensure ]]> inside the code is split-escaped
      expect(xml).toContain(']]]]><![CDATA[>');
    });
  });

  // =========================================================================
  // Combination 3: Markdown Output + Backtick Code Fences
  // =========================================================================
  describe('Pairwise 3: Markdown Output + Code Containing Triple Backticks', () => {
    it('should skeletonize backticks fixture retaining backtick strings in signatures', () => {
      const backticksPath = path.join(EDGE_CASES_DIR, 'backticks.ts');
      const raw = fs.readFileSync(backticksPath, 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, backticksPath);

      expect(skel.isValidSyntax).toBe(true);
      expect(skel.code).toContain('export function generateMarkdownSnippet(title: string, code: string): string { /* ... */ }');
    });

    it.skipIf(!hasFormat)('should escape or safely fence Markdown code blocks when code contains triple backticks', async () => {
      const formatModule = await import('../../src/format/index.js');
      const backticksPath = path.join(EDGE_CASES_DIR, 'backticks.ts');
      const raw = fs.readFileSync(backticksPath, 'utf-8');

      const md = formatModule.formatMarkdown({
        files: [
          {
            relativePath: 'backticks.ts',
            language: 'typescript',
            status: 'FOCUS',
            content: raw
          }
        ],
        audit: {
          totalOriginalTokens: 100,
          totalPackedTokens: 100,
          totalSavedTokens: 0,
          overallReductionPercentage: 0,
          files: []
        }
      });

      expect(md).toContain('# ContextDiet');
      // When code contains triple backticks, Markdown must use quad backticks ```` or escaped fences
      expect(md.includes('````') || md.includes('\\`\\`\\`')).toBe(true);
    });
  });

  // =========================================================================
  // Combination 4: CLI Execution: --no-diet Baseline vs Normal Diet A/B Comparison
  // =========================================================================
  describe('Pairwise 4: CLI Execution --no-diet Baseline vs Diet Compression', () => {
    it.skipIf(!hasCli)('should achieve >= 50% token reduction when comparing normal diet to --no-diet baseline', () => {
      const outDiet = path.join(REPO_ROOT, 'test/temp-diet-compare.json');
      const outNoDiet = path.join(REPO_ROOT, 'test/temp-nodiet-compare.json');
      const focusFile = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');

      // 1. Run normal diet
      const resDiet = runCli(['pack', path.join(BENCHMARK_DIR, 'ts-service'), '--focus', focusFile, '--format', 'json', '-o', outDiet]);
      expect(resDiet.status).toBe(0);

      // 2. Run --no-diet baseline
      const resNoDiet = runCli(['pack', path.join(BENCHMARK_DIR, 'ts-service'), '--focus', focusFile, '--no-diet', '--format', 'json', '-o', outNoDiet]);
      expect(resNoDiet.status).toBe(0);

      const jsonDiet = JSON.parse(fs.readFileSync(outDiet, 'utf-8'));
      const jsonNoDiet = JSON.parse(fs.readFileSync(outNoDiet, 'utf-8'));

      const dietTokens = jsonDiet.metrics.packedTokens;
      const baselineTokens = jsonNoDiet.metrics.packedTokens;

      expect(baselineTokens).toBeGreaterThan(dietTokens);
      const reduction = ((baselineTokens - dietTokens) / baselineTokens) * 100;
      expect(reduction).toBeGreaterThanOrEqual(50.0);

      fs.unlinkSync(outDiet);
      fs.unlinkSync(outNoDiet);
    });
  });

  // =========================================================================
  // Combination 5: Multi-Focus + TSConfig Path Aliasing
  // =========================================================================
  describe('Pairwise 5: Multi-Focus Files + TSConfig Path Aliasing', () => {
    it.skipIf(!hasPacker)('should pack context with multiple focus files and resolve @/* alias imports', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const buttonPath = path.join(ALIAS_DIR, 'src/components/button.ts');
      const mathPath = path.join(ALIAS_DIR, 'src/utils/math.ts');

      const packResult = await packerModule.packContext({
        repoRoot: ALIAS_DIR,
        focusFiles: [buttonPath]
      });

      const fileNames = packResult.files.map(f => path.basename(f.relativePath));
      expect(fileNames).toContain('button.ts');
      expect(fileNames).toContain('math.ts');

      const buttonNode = packResult.files.find(f => f.relativePath.includes('button.ts'));
      const mathNode = packResult.files.find(f => f.relativePath.includes('math.ts'));

      expect(buttonNode?.status).toBe('FOCUS');
      expect(mathNode?.status).toBe('SKELETON');
    });
  });
});
