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
  IGNORE_TEST_DIR,
  CLI_BIN,
  runCli,
  countTokens,
  hasCli,
  hasGraph,
  hasFilter,
  hasPacker,
  hasToken,
  hasFormat
} from './helpers/test-runner.js';

describe('Tier 1: Comprehensive Feature Coverage', () => {
  // =========================================================================
  // F1: TypeScript / JavaScript AST Skeletonizer
  // =========================================================================
  describe('F1: TypeScript/JavaScript AST Skeletonizer', () => {
    it('should strip TypeScript class method bodies to /* ... */ while preserving method signatures and modifiers', () => {
      const code = `
export class OrderService {
  private db: Database;
  constructor(db: Database) {
    this.db = db;
    this.initPool();
  }
  public async getOrder(id: string): Promise<Order | null> {
    const query = "SELECT * FROM orders WHERE id = " + id;
    const res = await this.db.query(query);
    return res.rows[0];
  }
}
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/services/order.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('class OrderService');
      expect(result.code).toContain('constructor(db: Database) { /* ... */ }');
      expect(result.code).toContain('public async getOrder(id: string): Promise<Order | null> { /* ... */ }');
      expect(result.code).not.toContain('SELECT * FROM orders');
      expect(result.skeletonLength).toBeLessThan(result.originalLength);
    });

    it('should strip standalone and exported function bodies while retaining parameters, generics, and return types', () => {
      const code = `
export function calculateTax<T extends { amount: number }>(item: T, rate: number = 0.05): number {
  if (rate < 0) throw new Error("Invalid rate");
  const base = item.amount;
  return base * rate;
}
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/utils/tax.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('export function calculateTax<T extends { amount: number }>(item: T, rate: number = 0.05): number { /* ... */ }');
      expect(result.code).not.toContain('Invalid rate');
    });

    it('should strip arrow functions and function expressions in exported constants', () => {
      const code = `
export const formatCurrency = (val: number, symbol: string = "$"): string => {
  const formatted = val.toFixed(2);
  return symbol + formatted;
};
export const conciseArrow = (x: number): number => x * 2;
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/utils/format.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('export const formatCurrency = (val: number, symbol: string = "$"): string => { /* ... */ };');
      expect(result.code).toContain('export const conciseArrow = (x: number): number => { /* ... */ };');
      expect(result.code).not.toContain('toFixed');
    });

    it('should retain interface declarations, type aliases, and enums completely intact', () => {
      const code = `
export enum OrderStatus {
  Pending = "PENDING",
  Completed = "COMPLETED"
}
export interface OrderItem {
  sku: string;
  qty: number;
}
export type OrderResponse = {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
};
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/models/order.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('export enum OrderStatus');
      expect(result.code).toContain('export interface OrderItem');
      expect(result.code).toContain('export type OrderResponse');
      // Types should not have bodies stripped
      expect(result.code).toContain('sku: string;');
    });

    it('should preserve JSDoc comments attached to functions and classes while stripping implementation bodies', () => {
      const code = `
/**
 * Processes payment transactions securely.
 * @param amount Total in cents
 * @returns Confirmation token
 */
export async function processPayment(amount: number): Promise<string> {
  const secretKey = "sk_live_12345";
  return secretKey + "_" + amount;
}
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/billing/pay.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('Processes payment transactions securely.');
      expect(result.code).toContain('@param amount Total in cents');
      expect(result.code).toContain('export async function processPayment(amount: number): Promise<string> { /* ... */ }');
      expect(result.code).not.toContain('sk_live_12345');
    });

    it('should keep abstract methods and overload signatures intact without modifying them', () => {
      const code = `
export abstract class BaseRepository<T> {
  abstract findById(id: string): Promise<T | null>;
  public count(): number {
    return 42;
  }
}
      `;
      const result = astSkeletonizer.skeletonize(code, 'src/repo/base.ts');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('abstract findById(id: string): Promise<T | null>;');
      expect(result.code).toContain('public count(): number { /* ... */ }');
    });
  });

  // =========================================================================
  // F2: Python AST Skeletonizer
  // =========================================================================
  describe('F2: Python AST Skeletonizer', () => {
    it('should replace Python function bodies with ... while retaining signatures', () => {
      const code = `def calculate_metrics(values: list[float], factor: float = 1.0) -> dict[str, float]:
    total = sum(values) * factor
    mean = total / len(values) if values else 0.0
    return {"total": total, "mean": mean}`;
      const result = astSkeletonizer.skeletonize(code, 'service/metrics.py');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('def calculate_metrics(values: list[float], factor: float = 1.0) -> dict[str, float]:');
      expect(result.code).toContain('...');
      expect(result.code).not.toContain('sum(values)');
    });

    it('should preserve docstrings inside function and method bodies while stripping execution logic', () => {
      const code = `def normalize_text(text: str) -> str:
    """Clean and normalize raw text input.

    Args:
        text: Input raw string
    Returns:
        Cleaned text
    """
    cleaned = text.strip().lower()
    return cleaned`;
      const result = astSkeletonizer.skeletonize(code, 'service/preprocess.py');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('"""Clean and normalize raw text input.');
      expect(result.code).toContain('Returns:\n        Cleaned text');
      expect(result.code).toContain('...');
      expect(result.code).not.toContain('cleaned = text.strip()');
    });

    it('should preserve decorators on classes and methods', () => {
      const code = `@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}"`;
      const result = astSkeletonizer.skeletonize(code, 'service/config.py');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('@dataclass');
      expect(result.code).toContain('class Config:');
      expect(result.code).toContain('@property');
      expect(result.code).toContain('def url(self) -> str:');
      expect(result.code).not.toContain('http://{self.host}');
    });

    it('should preserve async def routines and complex type annotations', () => {
      const code = `async def fetch_user_data(user_id: str, timeout_sec: int = 10) -> Optional[dict[str, Any]]:
    async with aiohttp.ClientSession() as session:
        res = await session.get(f"/users/{user_id}", timeout=timeout_sec)
        return await res.json()`;
      const result = astSkeletonizer.skeletonize(code, 'service/client.py');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('async def fetch_user_data(user_id: str, timeout_sec: int = 10) -> Optional[dict[str, Any]]:');
      expect(result.code).toContain('...');
      expect(result.code).not.toContain('aiohttp.ClientSession');
    });

    it('should retain class variables and attributes while stripping method implementations', () => {
      const code = `class ModelService:
    DEFAULT_TIMEOUT: int = 30
    MODEL_NAME: str = "v3"

    def predict(self, x: list[float]) -> list[float]:
        return [val * 2.0 for val in x]`;
      const result = astSkeletonizer.skeletonize(code, 'service/model.py');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('DEFAULT_TIMEOUT: int = 30');
      expect(result.code).toContain('MODEL_NAME: str = "v3"');
      expect(result.code).toContain('def predict(self, x: list[float]) -> list[float]:');
      expect(result.code).not.toContain('val * 2.0');
    });
  });

  // =========================================================================
  // F3: Go AST Skeletonizer
  // =========================================================================
  describe('F3: Go AST Skeletonizer', () => {
    it('should replace Go function bodies with { /* ... */ } while retaining signatures', () => {
      const code = `package main

func Add(a int, b int) int {
	res := a + b
	return res
}
`;
      const result = astSkeletonizer.skeletonize(code, 'main.go');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('func Add(a int, b int) int { /* ... */ }');
      expect(result.code).not.toContain('res := a + b');
    });

    it('should preserve methods with pointer and value receivers', () => {
      const code = `package store

type Server struct {
	addr string
}

func (s *Server) Start(port int) error {
	s.addr = fmt.Sprintf(":%d", port)
	return nil
}

func (s Server) Address() string {
	return s.addr
}
`;
      const result = astSkeletonizer.skeletonize(code, 'server.go');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('func (s *Server) Start(port int) error { /* ... */ }');
      expect(result.code).toContain('func (s Server) Address() string { /* ... */ }');
      expect(result.code).not.toContain('fmt.Sprintf');
    });

    it('should retain package declaration, imports, and constants intact', () => {
      const code = `package consensus

import (
	"context"
	"time"
)

const DefaultTimeout = 50 * time.Millisecond

func Run(ctx context.Context) {
	time.Sleep(DefaultTimeout)
}
`;
      const result = astSkeletonizer.skeletonize(code, 'consensus.go');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('package consensus');
      expect(result.code).toContain('"context"');
      expect(result.code).toContain('const DefaultTimeout = 50 * time.Millisecond');
      expect(result.code).toContain('func Run(ctx context.Context) { /* ... */ }');
      expect(result.code).not.toContain('time.Sleep');
    });

    it('should retain struct definitions with fields and tags completely intact', () => {
      const code = `package models

type User struct {
	ID        string    \`json:"id" db:"user_id"\`
	Email     string    \`json:"email"\`
	CreatedAt time.Time \`json:"created_at"\`
}

func (u *User) Validate() bool {
	return u.Email != ""
}
`;
      const result = astSkeletonizer.skeletonize(code, 'user.go');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('type User struct {');
      expect(result.code).toContain('`json:"id" db:"user_id"`');
      expect(result.code).toContain('func (u *User) Validate() bool { /* ... */ }');
    });

    it('should retain interface declarations and Go 1.18+ generic type parameters', () => {
      const code = `package generic

type Store[T any] interface {
	Get(id string) (T, error)
	Set(id string, val T) error
}

func Map[T any, R any](items []T, f func(T) R) []R {
	res := make([]R, len(items))
	for i, item := range items {
		res[i] = f(item)
	}
	return res
}
`;
      const result = astSkeletonizer.skeletonize(code, 'generic.go');
      expect(result.isValidSyntax).toBe(true);
      expect(result.code).toContain('type Store[T any] interface');
      expect(result.code).toContain('func Map[T any, R any](items []T, f func(T) R) []R { /* ... */ }');
      expect(result.code).not.toContain('make([]R, len(items))');
    });
  });

  // =========================================================================
  // F4: AST Syntax Validity Guard
  // =========================================================================
  describe('F4: AST Syntax Validity Guard', () => {
    it('should validate that skeletonized TypeScript code parses with 0 diagnostics', () => {
      const raw = fs.readFileSync(path.join(BENCHMARK_DIR, 'ts-service/src/services/order-service.ts'), 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, 'order-service.ts');
      expect(skel.isValidSyntax).toBe(true);
      const validation = validateSyntaxDetailed(skel.code, 'typescript', 'order-service.ts');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate that skeletonized JavaScript code parses with 0 diagnostics', () => {
      const raw = fs.readFileSync(path.join(BENCHMARK_DIR, 'js-worker/src/pipeline.js'), 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, 'pipeline.js');
      expect(skel.isValidSyntax).toBe(true);
      const validation = validateSyntaxDetailed(skel.code, 'javascript', 'pipeline.js');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate that skeletonized Python code produces 0 parse error nodes', () => {
      const raw = fs.readFileSync(path.join(BENCHMARK_DIR, 'py-ml/service/feature_extract.py'), 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, 'feature_extract.py');
      expect(skel.isValidSyntax).toBe(true);
      const validation = validateSyntaxDetailed(skel.code, 'python');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate that skeletonized Go code produces 0 parse error nodes', () => {
      const raw = fs.readFileSync(path.join(BENCHMARK_DIR, 'go-raft/storage/wal.go'), 'utf-8');
      const skel = astSkeletonizer.skeletonize(raw, 'wal.go');
      expect(skel.isValidSyntax).toBe(true);
      const validation = validateSyntaxDetailed(skel.code, 'go');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect intentional syntax errors and return valid: false with descriptive errors', () => {
      const brokenTs = fs.readFileSync(path.join(EDGE_CASES_DIR, 'syntax-error.ts'), 'utf-8');
      const valTs = validateSyntaxDetailed(brokenTs, 'typescript', 'syntax-error.ts');
      expect(valTs.valid).toBe(false);
      expect(valTs.errors.length).toBeGreaterThan(0);

      const brokenPy = fs.readFileSync(path.join(EDGE_CASES_DIR, 'syntax-error.py'), 'utf-8');
      const valPy = validateSyntaxDetailed(brokenPy, 'python');
      expect(valPy.valid).toBe(false);
      expect(valPy.errors.length).toBeGreaterThan(0);

      const brokenGo = fs.readFileSync(path.join(EDGE_CASES_DIR, 'syntax-error.go'), 'utf-8');
      const valGo = validateSyntaxDetailed(brokenGo, 'go');
      expect(valGo.valid).toBe(false);
      expect(valGo.errors.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // F5 & F6: Import Scanners & Module Resolution
  // =========================================================================
  describe('F5 & F6: Import Scanners & Module Resolution', () => {
    it.skipIf(!hasGraph)('should extract relative imports from TypeScript/JavaScript files', async () => {
      const graphModule = await import('../../src/graph/scanner.js');
      const tsCode = `
import { Order } from './models/order';
import * as utils from '../utils/helpers';
const service = require('./service');
      `;
      const imports = graphModule.extractImports(tsCode, 'typescript', 'src/app.ts');
      const specifiers = imports.map((i: { specifier: string }) => i.specifier);
      expect(specifiers).toContain('./models/order');
      expect(specifiers).toContain('../utils/helpers');
    });

    it.skipIf(!hasGraph)('should resolve module file extensions (.ts, .js) and directory index files', async () => {
      const resolverModule = await import('../../src/graph/resolver.js');
      const resolver = new resolverModule.ModuleResolver({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const resolved = resolver.resolve(
        path.join(BENCHMARK_DIR, 'ts-service/src/services/order-service.ts'),
        '../models/order',
        'typescript'
      );
      expect(resolved).toBeTruthy();
      expect(resolved).toContain('models/order.ts');
    });

    it.skipIf(!hasGraph)('should resolve tsconfig path aliases (@/* -> src/*)', async () => {
      const resolverModule = await import('../../src/graph/resolver.js');
      const resolver = new resolverModule.ModuleResolver({
        repoRoot: ALIAS_DIR,
        tsconfigPath: path.join(ALIAS_DIR, 'tsconfig.json')
      });
      const resolved = resolver.resolve(
        path.join(ALIAS_DIR, 'src/components/button.ts'),
        '@/utils/math',
        'typescript'
      );
      expect(resolved).toBeTruthy();
      expect(resolved).toContain('src/utils/math.ts');
    });

    it.skipIf(!hasGraph)('should extract relative and absolute imports from Python files immune to comments', async () => {
      const graphModule = await import('../../src/graph/scanner.js');
      const pyCode = `
# import commented_out_module
"""
from fake import DocstringImport
"""
from .schemas import PredictionRequest, PredictionResult
from .feature_extract import FeatureExtractor
import math
      `;
      const imports = graphModule.extractImports(pyCode, 'python', 'service/api.py');
      const specifiers = imports.map((i: { specifier: string }) => i.specifier);
      expect(specifiers).toContain('.schemas');
      expect(specifiers).toContain('.feature_extract');
      expect(specifiers).not.toContain('commented_out_module');
      expect(specifiers).not.toContain('fake');
    });

    it.skipIf(!hasGraph)('should extract Go package imports and map to repository package directories', async () => {
      const graphModule = await import('../../src/graph/scanner.js');
      const goCode = `package raft
import (
	"fmt"
	"github.com/benchmark/raft/storage"
	"github.com/benchmark/raft/transport"
)
`;
      const imports = graphModule.extractImports(goCode, 'go', 'raft.go');
      const specifiers = imports.map((i: { specifier: string }) => i.specifier);
      expect(specifiers).toContain('github.com/benchmark/raft/storage');
      expect(specifiers).toContain('github.com/benchmark/raft/transport');
    });
  });

  // =========================================================================
  // F7: Cycle-Safe Graph Traversal
  // =========================================================================
  describe('F7: Cycle-Safe Graph Traversal', () => {
    it.skipIf(!hasGraph)('should traverse direct 2-node circular dependencies (A <-> B) without crashing', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle2-a.ts')]);
      const fileNames = result.reachableFiles.map(f => path.basename(f));
      expect(fileNames).toContain('cycle2-a.ts');
      expect(fileNames).toContain('cycle2-b.ts');
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it.skipIf(!hasGraph)('should traverse 3-node circular dependencies (A -> B -> C -> A) in finite time', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle3-a.ts')]);
      const fileNames = result.reachableFiles.map(f => path.basename(f));
      expect(fileNames).toContain('cycle3-a.ts');
      expect(fileNames).toContain('cycle3-b.ts');
      expect(fileNames).toContain('cycle3-c.ts');
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it.skipIf(!hasGraph)('should handle self-referencing imports (A -> A) safely', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'self-cycle.ts')]);
      expect(result.reachableFiles).toHaveLength(1);
    });

    it.skipIf(!hasGraph)('should identify cycle back-edges and report them in cycle list', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: CYCLIC_DIR });
      const result = await builder.build([path.join(CYCLIC_DIR, 'cycle2-a.ts')]);
      expect(result.cycles).toBeDefined();
      expect(result.cycles.some(c => c.some(p => p.includes('cycle2-b')))).toBe(true);
    });

    it.skipIf(!hasGraph)('should produce deterministic topological ordering for acyclic portions', async () => {
      const graphModule = await import('../../src/graph/index.js');
      const builder = new graphModule.DependencyGraphBuilder({ repoRoot: path.join(BENCHMARK_DIR, 'ts-service') });
      const result1 = await builder.build([path.join(BENCHMARK_DIR, 'ts-service/src/index.ts')]);
      const result2 = await builder.build([path.join(BENCHMARK_DIR, 'ts-service/src/index.ts')]);
      expect(result1.orderedFiles).toEqual(result2.orderedFiles);
    });
  });

  // =========================================================================
  // F8: Zero-Config Ignore Filtering
  // =========================================================================
  describe('F8: Zero-Config Ignore Filtering', () => {
    it.skipIf(!hasFilter)('should automatically exclude node_modules from packed context', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: IGNORE_TEST_DIR });
      expect(filter.isIgnored('node_modules/fake-lib/index.js')).toBe(true);
    });

    it.skipIf(!hasFilter)('should automatically exclude .git directories and metadata', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: IGNORE_TEST_DIR });
      expect(filter.isIgnored('.git/config')).toBe(true);
    });

    it.skipIf(!hasFilter)('should automatically exclude lockfiles (package-lock.json, yarn.lock, etc.)', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: IGNORE_TEST_DIR });
      expect(filter.isIgnored('package-lock.json')).toBe(true);
      expect(filter.isIgnored('yarn.lock')).toBe(true);
      expect(filter.isIgnored('Cargo.lock')).toBe(true);
    });

    it.skipIf(!hasFilter)('should automatically exclude build artifact directories (dist/, build/, .next/)', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: IGNORE_TEST_DIR });
      expect(filter.isIgnored('dist/bundle.js')).toBe(true);
      expect(filter.isIgnored('.next/cache')).toBe(true);
    });

    it.skipIf(!hasFilter)('should automatically exclude binary and media files (.png, .jpg, .pyc, .so)', async () => {
      const filterModule = await import('../../src/filter/index.js');
      const filter = new filterModule.FilterEngine({ repoRoot: IGNORE_TEST_DIR });
      expect(filter.isIgnored('assets/logo.png')).toBe(true);
      expect(filter.isIgnored('lib.so')).toBe(true);
      expect(filter.isIgnored('compiled.pyc')).toBe(true);
    });
  });

  // =========================================================================
  // F9: Focus-Aware Context Packing
  // =========================================================================
  describe('F9: Focus-Aware Context Packing', () => {
    it.skipIf(!hasPacker)('should retain 100% unabridged source code for target focus file', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const result = await packerModule.packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });
      const focusedFile = result.files.find(f => f.status === 'FOCUS');
      expect(focusedFile).toBeDefined();
      const rawOnDisk = fs.readFileSync(focusPath, 'utf-8');
      expect(focusedFile?.content).toBe(rawOnDisk);
    });

    it.skipIf(!hasPacker)('should skeletonize direct and transitive dependencies of focus file', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const result = await packerModule.packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });
      const skeletonFiles = result.files.filter(f => f.status === 'SKELETON');
      expect(skeletonFiles.length).toBeGreaterThan(0);
      skeletonFiles.forEach(f => {
        expect(f.content).toContain('/* ... */');
      });
    });

    it.skipIf(!hasPacker)('should completely prune unreachable files in the repository', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focusPath = path.join(BENCHMARK_DIR, 'ts-service/src/models/user.ts');
      const result = await packerModule.packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focusPath]
      });
      const paths = result.files.map(f => f.relativePath);
      // Controllers and services do not import user.ts backwards
      expect(paths.some(p => p.includes('order-controller'))).toBe(false);
    });

    it.skipIf(!hasPacker)('should support multiple focus files simultaneously', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const focus1 = path.join(BENCHMARK_DIR, 'ts-service/src/models/user.ts');
      const focus2 = path.join(BENCHMARK_DIR, 'ts-service/src/models/order.ts');
      const result = await packerModule.packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service'),
        focusFiles: [focus1, focus2]
      });
      const focusedFiles = result.files.filter(f => f.status === 'FOCUS');
      expect(focusedFiles).toHaveLength(2);
    });

    it.skipIf(!hasPacker)('should pack whole repository as skeletons when no focus file is specified', async () => {
      const packerModule = await import('../../src/packer/index.js');
      const result = await packerModule.packContext({
        repoRoot: path.join(BENCHMARK_DIR, 'ts-service')
      });
      expect(result.files.every(f => f.status === 'SKELETON')).toBe(true);
    });
  });

  // =========================================================================
  // F10 & F11: Token Metrics & Comparison Table
  // =========================================================================
  describe('F10 & F11: Token Metrics & Comparison Table', () => {
    it('should accurately calculate cl100k BPE token counts for text snippets', () => {
      const text = 'ContextDiet optimizes repository context for AI coding agents.';
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThan(5);
      expect(tokens).toBeLessThan(20);
    });

    it.skipIf(!hasToken)('should accurately compute tokens saved (originalTokens - packedTokens)', async () => {
      const tokenModule = await import('../../src/token/index.js');
      const estimator = new tokenModule.TiktokenEstimator();
      const orig = 'function process(data: string): string { const x = 1; const y = 2; return data + x + y; }';
      const packed = 'function process(data: string): string { /* ... */ }';
      const origTokens = estimator.countTokens(orig);
      const packedTokens = estimator.countTokens(packed);
      const saved = origTokens - packedTokens;
      expect(saved).toBeGreaterThan(0);
      expect(origTokens).toBe(packedTokens + saved);
    });

    it.skipIf(!hasToken)('should compute reduction percentage according to mathematical formula', async () => {
      const tokenModule = await import('../../src/token/index.js');
      const metric = tokenModule.calculateFileMetric('test.ts', 'SKELETON', 1000, 250);
      expect(metric.savedTokens).toBe(750);
      expect(metric.reductionPercentage).toBe(75.0);
    });

    it.skipIf(!hasToken)('should handle edge cases: 0 original tokens without division by zero', async () => {
      const tokenModule = await import('../../src/token/index.js');
      const metric = tokenModule.calculateFileMetric('empty.ts', 'SKELETON', 0, 0);
      expect(metric.savedTokens).toBe(0);
      expect(metric.reductionPercentage).toBe(0.0);
    });

    it.skipIf(!hasToken)('should format an ANSI comparison table showing original, packed, and saved tokens', async () => {
      const tableModule = await import('../../src/token/table-reporter.js');
      const table = tableModule.renderComparisonTable({
        files: [
          { path: 'src/app.ts', status: 'FOCUS', originalTokens: 500, packedTokens: 500, savedTokens: 0, reductionPercentage: 0 },
          { path: 'src/util.ts', status: 'SKELETON', originalTokens: 1000, packedTokens: 200, savedTokens: 800, reductionPercentage: 80 }
        ],
        totalOriginalTokens: 1500,
        totalPackedTokens: 700,
        totalSavedTokens: 800,
        overallReductionPercentage: 53.33
      });
      expect(table).toContain('src/app.ts');
      expect(table).toContain('src/util.ts');
      expect(table).toContain('1,500');
      expect(table).toContain('700');
      expect(table).toContain('53.3%');
    });
  });

  // =========================================================================
  // F12: Format Exporters
  // =========================================================================
  describe('F12: Format Exporters', () => {
    it.skipIf(!hasFormat)('should format context pack as Markdown with headers and metadata', async () => {
      const formatModule = await import('../../src/format/index.js');
      const md = formatModule.formatMarkdown({
        files: [{ relativePath: 'src/index.ts', language: 'typescript', status: 'FOCUS', content: 'export const x = 1;' }],
        audit: { totalOriginalTokens: 100, totalPackedTokens: 100, totalSavedTokens: 0, overallReductionPercentage: 0, files: [] }
      });
      expect(md).toContain('# ContextDiet');
      expect(md).toContain('src/index.ts');
      expect(md).toContain('```typescript');
    });

    it.skipIf(!hasFormat)('should generate a table of contents in Markdown format', async () => {
      const formatModule = await import('../../src/format/index.js');
      const md = formatModule.formatMarkdown({
        files: [
          { relativePath: 'src/a.ts', language: 'typescript', status: 'FOCUS', content: 'export const a = 1;' },
          { relativePath: 'src/b.ts', language: 'typescript', status: 'SKELETON', content: 'export const b = 2;' }
        ],
        audit: { totalOriginalTokens: 200, totalPackedTokens: 100, totalSavedTokens: 100, overallReductionPercentage: 50, files: [] }
      });
      expect(md).toContain('Table of Contents');
      expect(md).toContain('src/a.ts');
      expect(md).toContain('src/b.ts');
    });

    it.skipIf(!hasFormat)('should format context pack as valid XML with <context_pack> schema', async () => {
      const formatModule = await import('../../src/format/index.js');
      const xml = formatModule.formatXml({
        files: [{ relativePath: 'src/app.ts', language: 'typescript', status: 'FOCUS', content: 'export function app() {}' }],
        audit: { totalOriginalTokens: 50, totalPackedTokens: 50, totalSavedTokens: 0, overallReductionPercentage: 0, files: [] }
      });
      expect(xml).toContain('<context_pack');
      expect(xml).toContain('</context_pack>');
      expect(xml).toContain('<file path="src/app.ts"');
    });

    it.skipIf(!hasFormat)('should encapsulate file code in CDATA blocks and properly escape internal ]]>', async () => {
      const formatModule = await import('../../src/format/index.js');
      const trickyCode = 'const s = "Hello ]]> World";';
      const xml = formatModule.formatXml({
        files: [{ relativePath: 'tricky.ts', language: 'typescript', status: 'FOCUS', content: trickyCode }],
        audit: { totalOriginalTokens: 20, totalPackedTokens: 20, totalSavedTokens: 0, overallReductionPercentage: 0, files: [] }
      });
      expect(xml).toContain('<![CDATA[');
      expect(xml).toContain(']]]]><![CDATA[>');
    });

    it.skipIf(!hasFormat)('should format context pack as strictly valid JSON matching schema', async () => {
      const formatModule = await import('../../src/format/index.js');
      const jsonStr = formatModule.formatJson({
        files: [{ relativePath: 'src/app.ts', language: 'typescript', status: 'FOCUS', content: 'const a = 1;' }],
        audit: { totalOriginalTokens: 10, totalPackedTokens: 10, totalSavedTokens: 0, overallReductionPercentage: 0, files: [] }
      });
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('files');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed.files[0].path).toBe('src/app.ts');
    });
  });

  // =========================================================================
  // F13: CLI Execution
  // =========================================================================
  describe('F13: CLI Execution', () => {
    it.skipIf(!hasCli)('should print help instructions and exit with code 0 on contextdiet --help', () => {
      const res = runCli(['--help']);
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('contextdiet');
      expect(res.stdout).toContain('pack');
      expect(res.stdout).toContain('--focus');
    });

    it.skipIf(!hasCli)('should print version number and exit with code 0 on contextdiet --version', () => {
      const res = runCli(['--version']);
      expect(res.status).toBe(0);
      expect(res.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it.skipIf(!hasCli)('should execute pack command with --focus and write to output file with exit 0', () => {
      const outPath = path.join(REPO_ROOT, 'test/temp-pack-tier1.md');
      const focusFile = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const res = runCli(['pack', path.join(BENCHMARK_DIR, 'ts-service'), '--focus', focusFile, '-o', outPath]);
      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);
      const content = fs.readFileSync(outPath, 'utf-8');
      expect(content).toContain('OrderApplication');
      fs.unlinkSync(outPath);
    });

    it.skipIf(!hasCli)('should support --no-diet flag to retain raw uncompressed code for baseline', () => {
      const outPath = path.join(REPO_ROOT, 'test/temp-nodiet-tier1.md');
      const focusFile = path.join(BENCHMARK_DIR, 'ts-service/src/index.ts');
      const res = runCli(['pack', path.join(BENCHMARK_DIR, 'ts-service'), '--focus', focusFile, '--no-diet', '-o', outPath]);
      expect(res.status).toBe(0);
      expect(fs.existsSync(outPath)).toBe(true);
      const content = fs.readFileSync(outPath, 'utf-8');
      // In --no-diet mode, dependencies should NOT have /* ... */
      expect(content).not.toContain('/* ... */');
      fs.unlinkSync(outPath);
    });

    it.skipIf(!hasCli)('should exit with code 1 when target directory or focus file does not exist', () => {
      const res = runCli(['pack', 'non-existent-directory-xyz-123']);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('error');
    });
  });
});
