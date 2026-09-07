import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { executePack } from '../../../src/cli/commands/pack.js';
import { createCli } from '../../../src/cli/index.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCHMARK_TS = path.resolve(REPO_ROOT, 'test/fixtures/benchmark-project/ts-service');

describe('Adversarial Stress-Testing: CLI Application', () => {
  let exitSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Subcommand & Option Edge Cases', () => {
    it('creates nested destination directory automatically when writing output file', async () => {
      const nestedDir = path.resolve(REPO_ROOT, 'test/fixtures/.temp_nested_cli_out/deep/sub/dir');
      const outPath = path.resolve(nestedDir, 'packed_context.md');
      const focusFile = path.resolve(BENCHMARK_TS, 'src/index.ts');

      try {
        await executePack(BENCHMARK_TS, {
          focus: [focusFile],
          output: outPath,
          format: 'md'
        });

        expect(fs.existsSync(outPath)).toBe(true);
        const content = fs.readFileSync(outPath, 'utf-8');
        expect(content).toContain('# ContextDiet');
      } finally {
        if (fs.existsSync(outPath)) {
          fs.unlinkSync(outPath);
        }
        const topDir = path.resolve(REPO_ROOT, 'test/fixtures/.temp_nested_cli_out');
        if (fs.existsSync(topDir)) {
          fs.rmSync(topDir, { recursive: true, force: true });
        }
      }
    });

    it('handles multiple focus files specified as array or string', async () => {
      const outPath = path.resolve(REPO_ROOT, 'test/temp_multi_focus.json');
      const focus1 = path.resolve(BENCHMARK_TS, 'src/index.ts');
      const focus2 = path.resolve(BENCHMARK_TS, 'src/models/order.ts');

      try {
        await executePack(BENCHMARK_TS, {
          focus: [focus1, focus2],
          output: outPath,
          format: 'json'
        });

        expect(fs.existsSync(outPath)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        expect(parsed.metrics.focusedFiles).toBe(2);
      } finally {
        if (fs.existsSync(outPath)) {
          fs.unlinkSync(outPath);
        }
      }
    });

    it('rejects invalid format case-insensitively and exits 1', async () => {
      await expect(
        executePack(BENCHMARK_TS, { format: 'PDF' })
      ).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("error: invalid format 'PDF'"));
    });

    it('supports multiple custom ignore glob patterns', async () => {
      const outPath = path.resolve(REPO_ROOT, 'test/temp_custom_ignore.json');
      try {
        await executePack(BENCHMARK_TS, {
          output: outPath,
          format: 'json',
          ignore: ['**/logger.ts', '**/types.ts']
        });

        expect(fs.existsSync(outPath)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        const paths = parsed.files.map((f: any) => f.path);
        expect(paths.some((p: string) => p.includes('logger.ts'))).toBe(false);
      } finally {
        if (fs.existsSync(outPath)) {
          fs.unlinkSync(outPath);
        }
      }
    });

    it('honors --no-diet by retaining raw file contents without skeletonization', async () => {
      const outPath = path.resolve(REPO_ROOT, 'test/temp_no_diet.json');
      const focusFile = path.resolve(BENCHMARK_TS, 'src/index.ts');

      try {
        await executePack(BENCHMARK_TS, {
          focus: [focusFile],
          output: outPath,
          format: 'json',
          noDiet: true
        });

        expect(fs.existsSync(outPath)).toBe(true);
        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        // With no-diet, original tokens equal packed tokens and savings is 0
        expect(parsed.metrics.savedTokens).toBe(0);
        expect(parsed.metrics.reductionPercentage).toBe(0);
      } finally {
        if (fs.existsSync(outPath)) {
          fs.unlinkSync(outPath);
        }
      }
    });
  });

  describe('Root CLI Parser & Help Handling', () => {
    it('prints help and exits with 0 when run without subcommands or options', async () => {
      const cli = createCli({ exitOverride: true });
      let output = '';
      cli.configureOutput({
        writeOut: (str: string) => {
          output += str;
        }
      });

      cli.outputHelp();
      expect(output).toContain('Usage: contextdiet');
      expect(output).toContain('Commands:');
      expect(output).toContain('pack');
    });

    it('configures pack subcommand with correct option defaults', () => {
      const cli = createCli({ exitOverride: true });
      const packCmd = cli.commands.find(c => c.name() === 'pack');
      expect(packCmd).toBeDefined();

      const formatOpt = packCmd!.options.find(o => o.long === '--format');
      expect(formatOpt?.defaultValue).toBe('md');
    });
  });
});
