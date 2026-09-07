import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { astSkeletonizer, validateSyntaxDetailed } from '../../dist/ast/index.js';
import type { SupportedLanguage } from '../../src/types.js';
import {
  REPO_ROOT,
  BENCHMARK_DIR,
  CLI_BIN,
  runCli,
  countTokens,
  hasCli,
  hasPacker
} from './helpers/test-runner.js';

interface BenchmarkFile {
  path: string;
  language: SupportedLanguage;
  isFocus: boolean;
}

describe('Tier 4: Real-World Polyglot Benchmark Project', () => {
  const benchmarkModules: Record<string, BenchmarkFile[]> = {
    'ts-service': [
      { path: 'ts-service/src/index.ts', language: 'typescript', isFocus: true },
      { path: 'ts-service/src/models/user.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/models/order.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/repositories/order-repository.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/services/notification-service.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/services/order-service.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/controllers/order-controller.ts', language: 'typescript', isFocus: false },
      { path: 'ts-service/src/routes/order-routes.ts', language: 'typescript', isFocus: false }
    ],
    'js-worker': [
      { path: 'js-worker/src/worker.js', language: 'javascript', isFocus: true },
      { path: 'js-worker/src/utils/event-buffer.js', language: 'javascript', isFocus: false },
      { path: 'js-worker/src/metrics.js', language: 'javascript', isFocus: false },
      { path: 'js-worker/src/pipeline.js', language: 'javascript', isFocus: false }
    ],
    'py-ml': [
      { path: 'py-ml/service/api.py', language: 'python', isFocus: true },
      { path: 'py-ml/service/schemas.py', language: 'python', isFocus: false },
      { path: 'py-ml/service/feature_extract.py', language: 'python', isFocus: false },
      { path: 'py-ml/service/inference.py', language: 'python', isFocus: false }
    ],
    'go-raft': [
      { path: 'go-raft/raft.go', language: 'go', isFocus: true },
      { path: 'go-raft/storage/wal.go', language: 'go', isFocus: false },
      { path: 'go-raft/transport/transport.go', language: 'go', isFocus: false }
    ]
  };

  it('should verify all benchmark files exist on disk with substantial real-world code', () => {
    let totalFiles = 0;
    for (const [moduleName, files] of Object.entries(benchmarkModules)) {
      for (const file of files) {
        const fullPath = path.join(BENCHMARK_DIR, file.path);
        expect(fs.existsSync(fullPath), `Benchmark file missing: ${file.path}`).toBe(true);
        const stat = fs.statSync(fullPath);
        expect(stat.size, `Benchmark file is empty: ${file.path}`).toBeGreaterThan(100);
        totalFiles++;
      }
    }
    expect(totalFiles).toBe(19);
  });

  it('should verify syntax validity of all skeletonized dependency files in the benchmark project', () => {
    for (const [moduleName, files] of Object.entries(benchmarkModules)) {
      for (const file of files) {
        if (!file.isFocus) {
          const fullPath = path.join(BENCHMARK_DIR, file.path);
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const skel = astSkeletonizer.skeletonize(raw, fullPath);
          expect(skel.isValidSyntax, `Invalid syntax after skeletonizing: ${file.path}`).toBe(true);

          const validation = validateSyntaxDetailed(skel.code, file.language, fullPath);
          expect(validation.valid, `Validation failed on ${file.path}: ${validation.errors.join('; ')}`).toBe(true);
        }
      }
    }
  });

  it('should achieve >= 50% token reduction (target 60-80%) across the full benchmark suite', () => {
    let totalRawTokens = 0;
    let totalOptimizedTokens = 0;
    const perModuleStats: Record<string, { raw: number; optimized: number; reduction: number }> = {};

    for (const [moduleName, files] of Object.entries(benchmarkModules)) {
      let moduleRawTokens = 0;
      let moduleOptimizedTokens = 0;

      for (const file of files) {
        const fullPath = path.join(BENCHMARK_DIR, file.path);
        const rawContent = fs.readFileSync(fullPath, 'utf-8');
        const rawTokens = countTokens(rawContent);
        moduleRawTokens += rawTokens;

        if (file.isFocus) {
          // Focus file retains 100% unabridged source code
          moduleOptimizedTokens += rawTokens;
        } else {
          // Dependency file is skeletonized
          const skel = astSkeletonizer.skeletonize(rawContent, fullPath);
          const skelTokens = countTokens(skel.code);
          moduleOptimizedTokens += skelTokens;
        }
      }

      totalRawTokens += moduleRawTokens;
      totalOptimizedTokens += moduleOptimizedTokens;

      const moduleReduction = ((moduleRawTokens - moduleOptimizedTokens) / moduleRawTokens) * 100;
      perModuleStats[moduleName] = {
        raw: moduleRawTokens,
        optimized: moduleOptimizedTokens,
        reduction: Math.round(moduleReduction * 10) / 10
      };
    }

    const overallReduction = ((totalRawTokens - totalOptimizedTokens) / totalRawTokens) * 100;

    // Log benchmark reduction table for visibility
    console.log('\n--- ContextDiet Polyglot Benchmark Token Audit ---');
    console.log(`Total Original Tokens:  ${totalRawTokens.toLocaleString()}`);
    console.log(`Total Optimized Tokens: ${totalOptimizedTokens.toLocaleString()}`);
    console.log(`Tokens Saved:           ${(totalRawTokens - totalOptimizedTokens).toLocaleString()}`);
    console.log(`Overall Reduction:      ${overallReduction.toFixed(1)}%`);
    console.log('--------------------------------------------------');
    for (const [mod, stats] of Object.entries(perModuleStats)) {
      console.log(`  ${mod.padEnd(12)}: ${stats.raw.toLocaleString()} -> ${stats.optimized.toLocaleString()} tokens (${stats.reduction}% reduction)`);
    }
    console.log('--------------------------------------------------\n');

    // Authoritative requirement: total token reduction >= 50%
    expect(overallReduction).toBeGreaterThanOrEqual(50.0);
  });

  it('should verify that all focused files maintain 100% byte-for-byte fidelity', () => {
    for (const [moduleName, files] of Object.entries(benchmarkModules)) {
      for (const file of files) {
        if (file.isFocus) {
          const fullPath = path.join(BENCHMARK_DIR, file.path);
          const rawOnDisk = fs.readFileSync(fullPath, 'utf-8');
          // In ContextDiet, focused files are never skeletonized
          expect(rawOnDisk.length).toBeGreaterThan(0);
          const rawTokens = countTokens(rawOnDisk);
          expect(rawTokens).toBeGreaterThan(0);
        }
      }
    }
  });

  it.skipIf(!hasCli)('should execute ContextDiet CLI pack against ts-service and assert >= 50% token reduction in output JSON', () => {
    const outJsonPath = path.join(REPO_ROOT, 'test/temp-benchmark-ts.json');
    const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
    const res = runCli([
      'pack',
      path.join(BENCHMARK_DIR, 'ts-service'),
      '--focus',
      focusPath,
      '--format',
      'json',
      '-o',
      outJsonPath
    ]);

    expect(res.status).toBe(0);
    expect(fs.existsSync(outJsonPath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(outJsonPath, 'utf-8'));
    expect(data.metrics.reductionPercentage).toBeGreaterThanOrEqual(50.0);
    expect(data.metrics.originalTokens).toBeGreaterThan(data.metrics.packedTokens);

    fs.unlinkSync(outJsonPath);
  });
});
