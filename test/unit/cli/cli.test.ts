import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { createCli } from '../../../src/cli/index.js';
import { executePack } from '../../../src/cli/commands/pack.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const BENCHMARK_TS = path.resolve(REPO_ROOT, 'test/fixtures/benchmark-project/ts-service');

describe('CLI Engine (src/cli/)', () => {
  describe('createCli setup', () => {
    it('creates commander instance with name contextdiet and version 0.1.0', () => {
      const cli = createCli({ exitOverride: true });
      expect(cli.name()).toBe('contextdiet');
      expect(cli.version()).toBe('0.1.0');
    });

    it('registers the pack command with all required options', () => {
      const cli = createCli({ exitOverride: true });
      const packCmd = cli.commands.find(cmd => cmd.name() === 'pack');
      expect(packCmd).toBeDefined();

      const optionNames = packCmd!.options.map(opt => opt.long);
      expect(optionNames).toContain('--focus');
      expect(optionNames).toContain('--output');
      expect(optionNames).toContain('--format');
      expect(optionNames).toContain('--no-diet');
      expect(optionNames).toContain('--summary');
      expect(optionNames).toContain('--ignore');
      expect(optionNames).toContain('--tsconfig');
    });

    it('help information includes pack options for root --help', () => {
      const cli = createCli({ exitOverride: true });
      let help = '';
      cli.configureOutput({
        writeOut: (str: string) => {
          help += str;
        }
      });
      cli.outputHelp();
      expect(help).toContain('contextdiet');
      expect(help).toContain('pack');
      expect(help).toContain('--focus');
    });
  });

  describe('executePack action logic', () => {
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

    it('terminates with code 1 when target path does not exist', async () => {
      await expect(executePack('non-existent-folder-xyz', {})).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: target path does not exist'));
    });

    it('terminates with code 1 when target path is a file instead of directory', async () => {
      const packageJsonPath = path.resolve(REPO_ROOT, 'package.json');
      await expect(executePack(packageJsonPath, {})).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: target path is not a directory'));
    });

    it('terminates with code 1 when a focus file does not exist', async () => {
      await expect(
        executePack(BENCHMARK_TS, { focus: ['src/does-not-exist.ts'] })
      ).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: focus file does not exist'));
    });

    it('terminates with code 1 when format is invalid', async () => {
      await expect(
        executePack(BENCHMARK_TS, { format: 'docx' })
      ).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: invalid format'));
    });

    it('terminates with code 1 when custom tsconfig path does not exist', async () => {
      await expect(
        executePack(BENCHMARK_TS, { tsconfig: 'missing-tsconfig.json' })
      ).rejects.toThrow('process.exit(1)');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error: tsconfig file does not exist'));
    });

    it('executes packaging and writes output to file successfully', async () => {
      const outPath = path.resolve(REPO_ROOT, 'test/temp-unit-cli-pack.md');
      const focusFile = path.resolve(BENCHMARK_TS, 'src/index.ts');

      await executePack(BENCHMARK_TS, {
        focus: [focusFile],
        output: outPath,
        format: 'md'
      });

      expect(fs.existsSync(outPath)).toBe(true);
      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('# ContextDiet');
      expect(content).toContain('OrderApplication');
      fs.unlinkSync(outPath);
    });

    it('prints comparison table when --summary is passed', async () => {
      const outPath = path.resolve(REPO_ROOT, 'test/temp-unit-cli-summary.json');
      const focusFile = path.resolve(BENCHMARK_TS, 'src/index.ts');

      await executePack(BENCHMARK_TS, {
        focus: [focusFile],
        output: outPath,
        format: 'json',
        summary: true
      });

      expect(fs.existsSync(outPath)).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Original Tokens'));
      fs.unlinkSync(outPath);
    });
  });
});
