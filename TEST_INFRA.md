# ContextDiet Test Infrastructure & Methodology (`TEST_INFRA.md`)

## 1. Overview & Objectives

ContextDiet is an AST-guided repository context optimizer for AI coding agents. To guarantee absolute correctness, syntax validity across 4 programming languages (TypeScript, JavaScript, Python, Go), and mathematical token reduction ($\ge 50\%$), the testing infrastructure is organized around an **Opaque-Box, 4-Tier Verification Architecture**.

All tests operate strictly against public APIs, CLI executables (`bin/contextdiet.js`), and input/output contracts. No tests couple to internal private implementation details.

---

## 2. The 4-Tier Testing Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 4: Real-World Polyglot Benchmark Project                           │
│   • Multi-module real application (TS, JS, Python, Go)                  │
│   • Mathematical token reduction >= 50% (target 60-80%)                 │
│   • 100% byte-for-byte focus fidelity & AST validity across all deps    │
└─────────────────────────────────────────────────────────────────────────┘
                                     ▲
┌────────────────────────────────────┴────────────────────────────────────┐
│ Tier 3: Cross-Feature Pairwise Combinations                             │
│   • Circular dependencies + focus packing + token audit                 │
│   • XML exporter + TS generics (<T>) + CDATA escaping                   │
│   • Markdown exporter + triple backtick code fence collisions           │
│   • CLI --no-diet baseline vs normal diet comparison                    │
│   • Multi-focus + tsconfig alias resolution + ignore filters            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▲
┌────────────────────────────────────┴────────────────────────────────────┐
│ Tier 2: Boundary & Corner Cases                                         │
│   • Empty files (0 bytes)                                               │
│   • Comment-only files (JSDoc, block comments, hash comments)           │
│   • Type-only files (interfaces, structs, mapped types, no functions)   │
│   • Circular import graphs (2-node, 3-node, self-loops)                 │
│   • Deeply nested directories (5+ levels deep)                          │
│   • Unicode, emojis, Japanese/French accented text                      │
│   • Syntax error graceful reporting without uncaught crashes            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     ▲
┌────────────────────────────────────┴────────────────────────────────────┐
│ Tier 1: Comprehensive Feature Coverage (>=5 tests per feature)          │
│   • F1, F2, F3: Multi-language AST Skeletonizers (TS, JS, Python, Go)   │
│   • F4: Dual-Layer Syntax Validity Guard                                │
│   • F5, F6: Import Scanners & Module Resolver                           │
│   • F7: Cycle-Safe Graph Traversal (3-color DFS)                        │
│   • F8: Zero-Config Ignore Filtering Engine                             │
│   • F9: Focus-Aware Context Packer & Pruning                            │
│   • F10, F11: BPE cl100k Token Estimator & Comparison Table             │
│   • F12: Format Exporters (Markdown, XML, JSON)                         │
│   • F13: Production CLI Execution & Exit Codes                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Test Fixtures Matrix (`test/fixtures/`)

| Directory | Module / Target | Language | Key Structural Features Tested |
|---|---|---|---|
| `benchmark-project/ts-service` | E-Commerce Microservice | TypeScript | Order state machines, repositories, controllers, routers, JSDoc, interfaces |
| `benchmark-project/js-worker` | Streaming Event Worker | JavaScript | Ring buffer, reservoir sampling, P95/P99 quantiles, retry backoff |
| `benchmark-project/py-ml` | ML Pipeline | Python | `@timed_execution`, `@dataclass`, TF-IDF, n-grams, softmax, top-k ranking |
| `benchmark-project/go-raft` | Consensus Node | Go | Write-Ahead Log, CRC32 verification, pointer receivers, RPC transport |
| `cyclic-imports/` | Graph Cycles | TypeScript | 2-node cycle ($A \leftrightarrow B$), 3-node cycle ($A \rightarrow B \rightarrow C \rightarrow A$), self-loop |
| `alias-imports/` | Path Aliases | TypeScript | `tsconfig.json` baseUrl & `paths: { "@/*": ["src/*"] }` resolution |
| `edge-cases/` | Boundary Fixtures | Polyglot | Empty files, comments-only, types-only, unicode/emojis, CDATA end markers, broken syntax |
| `ignore-test/` | Blacklist Verification | Polyglot | `node_modules`, `.git`, `package-lock.json`, `dist/`, `.DS_Store`, `.png` assets |

---

## 4. Progressive Testability Lifecycle

ContextDiet employs parallel milestone execution:
- **Milestone 1 (M1)**: AST Engine & Syntax Validators (F1–F4)
- **Milestone 2 (M2)**: Dependency Graph & Context Packer (F5–F9)
- **Milestone 3 (M3)**: Token Engine, Format Exporters & CLI (F10–F13)
- **Milestone 4 (M4)**: Full E2E Integration & Verification

The E2E test suite automatically detects which subsystems are available using zero-overhead feature detection guards (`hasGraph`, `hasPacker`, `hasToken`, `hasFormat`, `hasCli`). 

- During M1: Tests for F1–F4, BPE token counting, boundary cases, and benchmark token reduction execute and achieve **100% pass rate**. Unimplemented downstream modules are cleanly skipped.
- During M2: Import scanning, module resolution, cycle handling, and focus packing activate automatically.
- During M3/M4: Exporters, terminal table reporters, and CLI commands activate, achieving 100% coverage across all 104 tests.

---

## 5. How to Run the Tests

```bash
# Run the complete test suite
npm test

# Run only E2E tests
npx vitest run test/e2e/

# Run individual tiers
npx vitest run test/e2e/tier1-feature-coverage.test.ts
npx vitest run test/e2e/tier2-boundary-cases.test.ts
npx vitest run test/e2e/tier3-pairwise-combinations.test.ts
npx vitest run test/e2e/tier4-benchmark-project.test.ts

# Type-check and lint tests
npm run lint
```
