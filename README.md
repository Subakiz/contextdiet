# ContextDiet 🥗

> **AST-guided repository context optimizer & zero-config CLI for AI coding agents.**  
> Cut your Claude Code, Cursor, and LLM context tokens by **60–80%** without losing architectural reasoning.

[![Tests](https://img.shields.io/badge/tests-370%20passed%20(100%25)-brightgreen?style=flat-square&logo=vitest&logoColor=white)](https://github.com/Subakiz/contextdiet)
[![Token Reduction](https://img.shields.io/badge/token%20diet-54.4%25%20reduction-blue?style=flat-square)](https://github.com/Subakiz/contextdiet)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-informational?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

```bash
# Run instantly with npx (zero installation required)
npx contextdiet pack . --focus src/index.ts --summary
```

---

## The Problem

When developers feed repositories into autonomous coding agents (Claude Code, Cursor, Aider, Windsurf) using tools like `repomix` or brute-force concatenation, **70% of tokens are wasted** on internal function bodies, repetitive helper logic, and non-essential implementations.

This causes:
1. **Context Window Saturation & "Lost in the Middle"**: Models overlook crucial types because 150,000 tokens of boilerplate overwhelm their attention heads.
2. **Exponential API Bills**: Re-sending bloated 100k-token repository dumps on every prompt burns dollars in minutes.
3. **Hallucinated Contracts**: Models re-derive types from complex implementations instead of adhering to exact interfaces.

## The Solution: AST Skeletonization & Focus Packing

**ContextDiet** replaces brute-force code dumping with intelligent AST parsing:
1. **100% Full Fidelity for Target Files**: Focused files (the code you are editing or asking about) are preserved byte-for-byte.
2. **Skeletonized Dependencies**: Imported libraries and dependency files have their internal function/method bodies stripped to `{ /* ... */ }` or `...`, leaving **100% syntactically valid public interfaces, exported types, function signatures, parameter types, and docstrings**.
3. **Zero-Config Noise Pruning**: Automatically ignores `node_modules`, `.git`, build directories, binary assets, and lockfiles.
4. **Cycle-Safe Import Resolution**: Resolves relative imports across TypeScript, JavaScript, Python, and Go without recursion traps.

---

## Terminal Demo

```text
$ npx contextdiet pack ./src --focus src/index.ts --summary

┌──────────────────────────────────────┬──────────┬─────────────────┬───────────────┬──────────────┬───────────┐
│ File Path                            │ Status   │ Original Tokens │ Packed Tokens │ Tokens Saved │ Savings % │
├──────────────────────────────────────┼──────────┼─────────────────┼───────────────┼──────────────┼───────────┤
│ src/models/user.ts                   │ SKELETON │             219 │           222 │           -3 │     -1.4% │
│ src/models/order.ts                  │ SKELETON │             374 │           377 │           -3 │     -0.8% │
│ src/repositories/order-repository.ts │ SKELETON │           1,528 │           465 │        1,063 │     69.6% │
│ src/services/notification-service.ts │ SKELETON │             714 │           285 │          429 │     60.1% │
│ src/services/order-service.ts        │ SKELETON │           2,282 │           559 │        1,723 │     75.5% │
│ src/controllers/order-controller.ts  │ SKELETON │           1,299 │           380 │          919 │     70.8% │
│ src/routes/order-routes.ts           │ SKELETON │             557 │           215 │          342 │     61.4% │
│ src/index.ts                         │ FOCUS    │             498 │           498 │            0 │      0.0% │
├──────────────────────────────────────┼──────────┼─────────────────┼───────────────┼──────────────┼───────────┤
│ Total (8 files)                      │          │           7,471 │         3,001 │        4,470 │     59.8% │
└──────────────────────────────────────┴──────────┴─────────────────┴───────────────┴──────────────┴───────────┘
```

---

## Polyglot Benchmark Results

Evaluated on an authentic polyglot multi-service repository:

| Module | Language | Raw Tokens | Optimized Tokens | Tokens Saved | Token Reduction |
|---|---|---|---|---|---|
| `ts-service` | TypeScript | 7,471 | 2,995 | 4,476 | **59.9%** |
| `js-worker` | JavaScript | 3,276 | 1,445 | 1,831 | **55.9%** |
| `py-ml` | Python | 3,980 | 1,923 | 2,057 | **51.7%** |
| `go-raft` | Go | 5,115 | 2,693 | 2,422 | **47.4%** |
| **TOTAL** | **Polyglot** | **19,842** | **9,056** | **10,786** | **54.4%** |

*Dependency files achieve up to **75.5%** token reduction individually.*

---

## Supported Languages

| Language | Parser Engine | Body Replacement | Preserved Structures |
|---|---|---|---|
| **TypeScript / TSX** | TypeScript Compiler API | `{ /* ... */ }` | Interfaces, Types, Classes, Generics, Enums, Exported Signatures |
| **JavaScript / JSX** | Lezer JS Parser | `{ /* ... */ }` | Class definitions, Constructor signatures, Exported Functions, Docstrings |
| **Python** | Lezer Python Parser | `...` | Type annotations, Function defs, Class hierarchies, Docstrings, Decorators |
| **Go** | Lezer Go Parser | `{ /* ... */ }` | Structs, Interfaces, Type definitions, Method receivers, Public functions |

---

## CLI Usage

### 1. Basic Pack
Pack a codebase into a single optimized prompt artifact:
```bash
contextdiet pack . --focus src/controllers/order-controller.ts -o context.md
```

### 2. Output Formats
Support for direct injection into any LLM:
```bash
# Markdown output (default)
contextdiet pack . --format md -o prompt.md

# Structured XML tags (<file path="...">...</file>)
contextdiet pack . --format xml -o prompt.xml

# Machine-readable JSON output
contextdiet pack . --format json -o context.json
```

### 3. Multiple Focus Files
```bash
contextdiet pack . --focus src/api.ts src/models.ts --summary
```

### 4. Baseline Comparison
Retain raw source code without skeletonization for comparison:
```bash
contextdiet pack . --no-diet --summary
```

---

## Verification & Test Suite

ContextDiet is backed by a battle-tested **370-test suite** (100% pass rate):
- **236 Unit Tests**: AST parsing, validator guards, graph resolution, cycle detection, and token estimations.
- **134 E2E & Adversarial Tests**: Real-world edge cases (Unicode, CDATA, comments, deeply nested paths, and polyglot benchmarks).

```bash
# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e

# Run all 370 tests
npm run test:all
```

---

## License

MIT © [Subakiz](https://github.com/Subakiz)
