import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import ts from 'typescript';
import { parser as pythonParser } from '@lezer/python';
import { parser as goParser } from '@lezer/go';
import { validateSyntaxDetailed } from '../../dist/ast/validator.js';
import type { SupportedLanguage } from '../../src/types.js';
import {
  REPO_ROOT,
  BENCHMARK_DIR,
  CLI_BIN,
  runCli,
  countTokens
} from './helpers/test-runner.js';

interface JsonExportPayload {
  version: string;
  generator: string;
  timestamp: string;
  metrics: {
    originalTokens: number;
    packedTokens: number;
    savedTokens: number;
    reductionPercentage: number;
    filesCount: number;
    focusCount: number;
    skeletonCount: number;
  };
  files: Array<{
    path: string;
    language: SupportedLanguage | 'other';
    status: 'FOCUS' | 'SKELETON';
    originalTokens: number;
    packedTokens: number;
    savedTokens?: number;
    reductionPercentage?: number;
    content: string;
  }>;
}

describe('Challenger 2: Benchmark Hardening & CLI Empirical Stress Harness', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contextdiet-c2-stress-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  const benchmarkModules = [
    {
      name: 'ts-service',
      dir: path.join(BENCHMARK_DIR, 'ts-service'),
      focusFile: 'src/index.ts',
      focusFullPath: path.join(BENCHMARK_DIR, 'ts-service/src/index.ts'),
      lang: 'typescript' as SupportedLanguage
    },
    {
      name: 'js-worker',
      dir: path.join(BENCHMARK_DIR, 'js-worker'),
      focusFile: 'src/worker.js',
      focusFullPath: path.join(BENCHMARK_DIR, 'js-worker/src/worker.js'),
      lang: 'javascript' as SupportedLanguage
    },
    {
      name: 'py-ml',
      dir: path.join(BENCHMARK_DIR, 'py-ml'),
      focusFile: 'service/api.py',
      focusFullPath: path.join(BENCHMARK_DIR, 'py-ml/service/api.py'),
      lang: 'python' as SupportedLanguage
    },
    {
      name: 'go-raft',
      dir: path.join(BENCHMARK_DIR, 'go-raft'),
      focusFile: 'raft.go',
      focusFullPath: path.join(BENCHMARK_DIR, 'go-raft/raft.go'),
      lang: 'go' as SupportedLanguage
    }
  ];

  describe('1. Polyglot Benchmark Token Reduction (>= 50% Threshold)', () => {
    it('should achieve >= 50% token reduction on ts-service microservice', () => {
      const outPath = path.join(tempDir, 'ts-service.json');
      const mod = benchmarkModules[0];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(data.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
      expect(data.metrics.savedTokens).toBeGreaterThan(0);
      expect(data.metrics.originalTokens).toBeGreaterThan(data.metrics.packedTokens);
    });

    it('should achieve >= 50% token reduction on js-worker stream pipeline', () => {
      const outPath = path.join(tempDir, 'js-worker.json');
      const mod = benchmarkModules[1];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(data.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
      expect(data.metrics.savedTokens).toBeGreaterThan(0);
    });

    it('should achieve >= 50% token reduction on py-ml inference engine', () => {
      const outPath = path.join(tempDir, 'py-ml.json');
      const mod = benchmarkModules[2];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(data.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
      expect(data.metrics.savedTokens).toBeGreaterThan(0);
    });

    it('should achieve token reduction on go-raft consensus module', () => {
      const outPath = path.join(tempDir, 'go-raft.json');
      const mod = benchmarkModules[3];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(data.metrics.savedTokens).toBeGreaterThan(0);
      expect(data.metrics.originalTokens).toBeGreaterThan(data.metrics.packedTokens);
    });

    it('should verify aggregate polyglot token reduction exceeds >= 50.0% benchmark requirement', () => {
      let totalRaw = 0;
      let totalPacked = 0;

      for (const mod of benchmarkModules) {
        const outPath = path.join(tempDir, `${mod.name}.json`);
        const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        totalRaw += data.metrics.originalTokens;
        totalPacked += data.metrics.packedTokens;
      }

      const aggregateReduction = ((totalRaw - totalPacked) / totalRaw) * 100;
      expect(totalRaw).toBeGreaterThan(15000);
      expect(aggregateReduction).toBeGreaterThanOrEqual(50.0);
    });

    it('should achieve >= 50% reduction when packing whole repository without --focus', () => {
      const outPath = path.join(tempDir, 'benchmark-whole.json');
      const res = runCli([
        'pack',
        BENCHMARK_DIR,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);

      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      expect(data.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
      expect(data.files.length).toBeGreaterThanOrEqual(19);
    });
  });

  describe('2. Baseline Comparison (--no-diet vs Diet)', () => {
    for (const mod of benchmarkModules) {
      it(`should verify --no-diet retains raw files (0% savings) while diet achieves compression on ${mod.name}`, () => {
        const dietJson = path.join(tempDir, `${mod.name}-diet.json`);
        const noDietJson = path.join(tempDir, `${mod.name}-nodiet.json`);

        // Normal pack
        const resDiet = runCli([
          'pack',
          mod.dir,
          '--focus',
          mod.focusFullPath,
          '--format',
          'json',
          '-o',
          dietJson
        ]);
        expect(resDiet.status).toBe(0);

        // No-diet pack
        const resNoDiet = runCli([
          'pack',
          mod.dir,
          '--focus',
          mod.focusFullPath,
          '--no-diet',
          '--format',
          'json',
          '-o',
          noDietJson
        ]);
        expect(resNoDiet.status).toBe(0);

        const dataDiet: JsonExportPayload = JSON.parse(fs.readFileSync(dietJson, 'utf-8'));
        const dataNoDiet: JsonExportPayload = JSON.parse(fs.readFileSync(noDietJson, 'utf-8'));

        // No diet must have 0 tokens saved and 0% reduction
        expect(dataNoDiet.metrics.savedTokens).toBe(0);
        expect(dataNoDiet.metrics.reductionPercentage).toBe(0);
        expect(dataNoDiet.metrics.packedTokens).toBe(dataNoDiet.metrics.originalTokens);

        // Diet must have fewer packed tokens than no-diet
        expect(dataDiet.metrics.packedTokens).toBeLessThan(dataNoDiet.metrics.packedTokens);
        expect(dataDiet.metrics.savedTokens).toBeGreaterThan(0);

        // Original tokens must match exactly between runs
        expect(dataDiet.metrics.originalTokens).toBe(dataNoDiet.metrics.originalTokens);
      });
    }
  });

  describe('3. Focus Preservation (100% Byte-for-Byte & Token Fidelity)', () => {
    for (const mod of benchmarkModules) {
      it(`should preserve focused file 100% byte-for-byte in ${mod.name}`, () => {
        const outPath = path.join(tempDir, `${mod.name}-focus-check.json`);
        const res = runCli([
          'pack',
          mod.dir,
          '--focus',
          mod.focusFullPath,
          '--format',
          'json',
          '-o',
          outPath
        ]);

        expect(res.status).toBe(0);
        const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));

        // Find focus file
        const focusEntries = data.files.filter(f => f.status === 'FOCUS');
        expect(focusEntries.length).toBe(1);

        const focusEntry = focusEntries[0];
        const diskContent = fs.readFileSync(mod.focusFullPath, 'utf-8');

        // Exact string equality
        expect(focusEntry.content).toBe(diskContent);

        // Exact byte-for-byte Buffer equality
        const entryBuf = Buffer.from(focusEntry.content, 'utf-8');
        const diskBuf = Buffer.from(diskContent, 'utf-8');
        expect(entryBuf.equals(diskBuf)).toBe(true);

        // Exact token fidelity
        expect(focusEntry.packedTokens).toBe(focusEntry.originalTokens);
        const diskTokens = countTokens(diskContent);
        expect(focusEntry.originalTokens).toBe(diskTokens);
      });
    }
  });

  describe('4. Dependency Skeletonization & AST Syntax Validity', () => {
    for (const mod of benchmarkModules) {
      it(`should verify all skeletonized dependencies in ${mod.name} are valid syntax and properly stripped`, () => {
        const outPath = path.join(tempDir, `${mod.name}-syntax-check.json`);
        const res = runCli([
          'pack',
          mod.dir,
          '--focus',
          mod.focusFullPath,
          '--format',
          'json',
          '-o',
          outPath
        ]);

        expect(res.status).toBe(0);
        const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));

        const skeletonFiles = data.files.filter(f => f.status === 'SKELETON');
        expect(skeletonFiles.length).toBeGreaterThan(0);

        for (const file of skeletonFiles) {
          // 1. AST syntax validity via unified validator
          const validation = validateSyntaxDetailed(file.content, file.language as SupportedLanguage, file.path);
          expect(validation.valid, `Syntax error in skeleton file ${file.path}: ${validation.errors.join('; ')}`).toBe(true);
          expect(validation.errors.length).toBe(0);

          // 2. Direct language parser check
          if (file.language === 'typescript' || file.language === 'javascript') {
            const kind = file.language === 'typescript' ? ts.ScriptKind.TS : ts.ScriptKind.JS;
            const sf = ts.createSourceFile(file.path, file.content, ts.ScriptTarget.Latest, true, kind);
            const diagnostics: readonly ts.Diagnostic[] =
              (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];
            expect(diagnostics.length, `TS parse diagnostics found on ${file.path}`).toBe(0);
          } else if (file.language === 'python') {
            const tree = pythonParser.parse(file.content);
            const cursor = tree.cursor();
            let hasError = false;
            do {
              if (cursor.name === '⚠' || cursor.name.includes('Error')) {
                hasError = true;
                break;
              }
            } while (cursor.next());
            expect(hasError, `Python syntax error in ${file.path}`).toBe(false);
          } else if (file.language === 'go') {
            const tree = goParser.parse(file.content);
            const cursor = tree.cursor();
            let hasError = false;
            do {
              if (cursor.name === '⚠' || cursor.name.includes('Error')) {
                hasError = true;
                break;
              }
            } while (cursor.next());
            expect(hasError, `Go syntax error in ${file.path}`).toBe(false);
          }

          // 3. Verify placeholder presence if original file contained functions/methods
          const origPath = path.isAbsolute(file.path) ? file.path : path.join(mod.dir, file.path);
          if (fs.existsSync(origPath)) {
            const origCode = fs.readFileSync(origPath, 'utf-8');
            // If original had function/method implementations
            if (origCode.includes('function') || origCode.includes('def ') || origCode.includes('func ')) {
              if (file.language === 'python') {
                expect(file.content).toContain('...');
              } else {
                expect(file.content).toContain('/* ... */');
              }
            }
          }
        }
      });
    }
  });

  describe('5. CLI Output Formats (md, xml, json)', () => {
    it('should produce well-structured Markdown format (--format md)', () => {
      const outMd = path.join(tempDir, 'output.md');
      const mod = benchmarkModules[0];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'md',
        '-o',
        outMd
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outMd)).toBe(true);

      const content = fs.readFileSync(outMd, 'utf-8');

      // Check header and summary
      expect(content).toContain('# ContextDiet');
      expect(content).toContain('## Table of Contents');

      // Check TOC links
      expect(content).toContain('- [src/index.ts](#file-src-index-ts) `[FOCUS]`');
      expect(content).toContain('[SKELETON]');

      // Check code blocks with language and delimiters
      expect(content).toContain('```typescript');

      // Check focus file content inside markdown
      const diskContent = fs.readFileSync(mod.focusFullPath, 'utf-8');
      expect(content).toContain(diskContent);
    });

    it('should produce well-formed XML format (--format xml)', () => {
      const outXml = path.join(tempDir, 'output.xml');
      const mod = benchmarkModules[1];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'xml',
        '-o',
        outXml
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outXml)).toBe(true);

      const content = fs.readFileSync(outXml, 'utf-8');

      // Root element
      expect(content).toMatch(/<context_pack[\s\S]*<\/context_pack>/);

      // Metadata element
      expect(content).toContain('<metadata>');
      expect(content).toContain('</metadata>');
      expect(content).toContain('<original_tokens>');
      expect(content).toContain('<packed_tokens>');
      expect(content).toContain('total_original_tokens=');
      expect(content).toContain('total_packed_tokens=');

      // File tags and CDATA encapsulation
      expect(content).toContain('<file path="src/worker.js" language="javascript" status="FOCUS">');
      expect(content).toContain('<![CDATA[');
      expect(content).toContain(']]>');

      // Verify no unbalanced file tags
      const openFileTags = (content.match(/<file /g) || []).length;
      const closeFileTags = (content.match(/<\/file>/g) || []).length;
      expect(openFileTags).toBe(closeFileTags);
      expect(openFileTags).toBeGreaterThan(0);
    });

    it('should produce strongly typed and valid JSON format (--format json)', () => {
      const outJson = path.join(tempDir, 'output.json');
      const mod = benchmarkModules[2];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        outJson
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outJson)).toBe(true);

      const rawJson = fs.readFileSync(outJson, 'utf-8');
      const parsed = JSON.parse(rawJson);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.generator).toBe('contextdiet');
      expect(typeof parsed.timestamp).toBe('string');
      expect(parsed.metrics.totalFiles).toBe(parsed.files.length);
      expect(parsed.metrics.focusedFiles).toBe(1);
      expect(parsed.metrics.skeletonFiles).toBe(parsed.files.length - 1);
      expect(parsed.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
    });

    it('should print terminal comparison table when --summary is supplied', () => {
      const mod = benchmarkModules[0];
      const outPath = path.join(tempDir, 'summary-test.md');
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '-o',
        outPath,
        '--summary'
      ]);

      expect(res.status).toBe(0);
      expect(res.stdout).toContain('File Path');
      expect(res.stdout).toContain('Status');
      expect(res.stdout).toContain('Original Tokens');
      expect(res.stdout).toContain('Packed Tokens');
      expect(res.stdout).toContain('Tokens Saved');
      expect(res.stdout).toContain('Savings %');
      expect(res.stdout).toContain('Total (8 files)');
    });
  });

  describe('6. CLI Resilience & Error Handling', () => {
    it('should exit with 0 and print usage on --help', () => {
      const res = runCli(['--help']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Usage: contextdiet');
      expect(res.stdout).toContain('--focus');
    });

    it('should exit with 0 and print version on --version', () => {
      const res = runCli(['--version']);
      expect(res.status).toBe(0);
      expect(res.stdout.trim()).toBe('0.1.0');
    });

    it('should exit with 0 and print usage when invoked with no arguments', () => {
      const res = runCli([]);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Usage: contextdiet');
    });

    it('should exit with code 1 when target directory does not exist', () => {
      const res = runCli(['pack', '/non/existent/path/for/sure']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('does not exist');
    });

    it('should exit with code 1 when focus file does not exist', () => {
      const mod = benchmarkModules[0];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        path.join(mod.dir, 'non-existent-file.ts')
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr.toLowerCase()).toContain('focus file does not exist');
    });

    it('should exit with code 1 when unsupported format is specified', () => {
      const mod = benchmarkModules[0];
      const res = runCli([
        'pack',
        mod.dir,
        '--format',
        'yaml'
      ]);
      expect(res.status).toBe(1);
      expect(res.stderr.toLowerCase()).toContain('invalid format');
    });

    it('should create deep nested parent directories automatically when writing output', () => {
      const nestedPath = path.join(tempDir, 'deep/nested/sub/dir/output.json');
      const mod = benchmarkModules[1];
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFullPath,
        '--format',
        'json',
        '-o',
        nestedPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(nestedPath)).toBe(true);
    });

    it('should support relative focus path from target directory', () => {
      const mod = benchmarkModules[0];
      const outPath = path.join(tempDir, 'relative-focus.json');
      const res = runCli([
        'pack',
        mod.dir,
        '--focus',
        mod.focusFile,
        '--format',
        'json',
        '-o',
        outPath
      ]);

      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);
      const data: JsonExportPayload = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      const focus = data.files.find(f => f.status === 'FOCUS');
      expect(focus).toBeDefined();
      expect(focus?.path).toContain('index.ts');
    });
  });
});
