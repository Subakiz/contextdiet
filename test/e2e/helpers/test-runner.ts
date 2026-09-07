import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getEncoding } from 'js-tiktoken';
import { validateSyntaxDetailed } from '../../../dist/ast/validator.js';
import type { SupportedLanguage, SyntaxValidationResult } from '../../../src/types.js';

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const FIXTURES_DIR = path.resolve(REPO_ROOT, 'test/fixtures');
export const BENCHMARK_DIR = path.resolve(FIXTURES_DIR, 'benchmark-project');
export const CYCLIC_DIR = path.resolve(FIXTURES_DIR, 'cyclic-imports');
export const ALIAS_DIR = path.resolve(FIXTURES_DIR, 'alias-imports');
export const EDGE_CASES_DIR = path.resolve(FIXTURES_DIR, 'edge-cases');
export const IGNORE_TEST_DIR = path.resolve(FIXTURES_DIR, 'ignore-test');

export const CLI_BIN = path.resolve(REPO_ROOT, 'bin/contextdiet.js');

export const hasCli = fs.existsSync(CLI_BIN);
export const hasGraph = fs.existsSync(path.resolve(REPO_ROOT, 'src/graph/index.ts'));
export const hasFilter = fs.existsSync(path.resolve(REPO_ROOT, 'src/filter/index.ts'));
export const hasPacker = fs.existsSync(path.resolve(REPO_ROOT, 'src/packer/index.ts'));
export const hasToken = fs.existsSync(path.resolve(REPO_ROOT, 'src/token/index.ts'));
export const hasFormat = fs.existsSync(path.resolve(REPO_ROOT, 'src/format/index.ts'));

let cl100kEncoder: ReturnType<typeof getEncoding> | null = null;
try {
  cl100kEncoder = getEncoding('cl100k_base');
} catch {
  // If encoding fails to load in edge environments
  cl100kEncoder = null;
}

/**
 * Independent oracle for token counting using cl100k_base BPE.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  if (cl100kEncoder) {
    try {
      return cl100kEncoder.encode(text).length;
    } catch {
      // Fallback regex if special tokens conflict
    }
  }
  const regex = /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/giu;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

/**
 * Run the ContextDiet CLI binary.
 */
export function runCli(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): CliResult {
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], {
    cwd: options.cwd || REPO_ROOT,
    env: {
      ...process.env,
      NO_COLOR: '1',
      ...options.env
    },
    encoding: 'utf-8'
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error
  };
}

/**
 * Validate syntax across TS, JS, Python, and Go.
 */
export function checkSyntax(code: string, language: SupportedLanguage, filePath?: string): SyntaxValidationResult {
  return validateSyntaxDetailed(code, language, filePath);
}
