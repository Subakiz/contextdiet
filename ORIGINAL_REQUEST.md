# Original User Request

## 2026-09-07T02:17:47Z

ContextDiet: An AST-guided repository context optimizer and CLI for AI coding agents that analyzes project dependency graphs, retains full implementation for targeted focus files while skeletonizing dependencies down to exported interfaces, signatures, and type contracts, cutting token consumption by 60–80% without losing reasoning context.

Working directory: /Users/nabils/antigravity/github_maxxing/contextdiet
Integrity mode: development

## Requirements

### R1. AST Skeletonization & Signature Extraction Engine
The engine must parse source code across TypeScript, JavaScript, Python, and Go, stripping internal function/method bodies while faithfully retaining exported types, interfaces, function/method signatures, parameter annotations, return types, and docstrings. Extracted skeletons must maintain structural syntax validity in their target languages.

### R2. Dependency Graph Resolution & Focus-Aware Context Packing
Given an optional set of target focus files or entry points, the tool must trace the repository's local import graph to assemble an optimized context pack. Target focus files must retain their full implementation bodies, imported modules must be included in skeletonized form, and non-dependent files, test fixtures, lockfiles, build artifacts, and binary assets must be automatically excluded.

### R3. Token Metric & Compression Audit
The tool must calculate and report the exact token consumption before and after compression using standard token estimation (cl100k/BPE equivalent), displaying token savings, reduction percentage, and file-by-file breakdown in a terminal summary report.

### R4. Production-Ready CLI & Flexible Output Formats
Provide a standalone, zero-config Node.js/TypeScript CLI (`contextdiet`) supporting commands to pack context, inspect token savings, and emit structured output in Markdown, XML, or JSON formats suitable for direct injection into LLM prompts (Claude, OpenAI, Gemini).

## Acceptance Criteria

### AST Parsing & Skeletonization
- [ ] TypeScript/JavaScript parser strips function and method bodies to minimal placeholders (`/* ... */`) while preserving class definitions, exported interfaces, types, and function signatures with exact parameters and return types.
- [ ] Python parser replaces function/method implementations with `...` or `pass` while retaining docstrings, decorators, argument type hints, and class attributes.
- [ ] Skeletonized code snippets remain valid syntax according to respective AST parsers.

### Dependency Resolution & Packaging
- [ ] Resolves relative local imports across target project directories without crashing on circular dependencies.
- [ ] When `--focus <file>` is provided, the output contains the complete unabridged source of the focused file alongside skeletonized contracts of its direct and transitive dependencies.
- [ ] Built-in ignore rules automatically omit `node_modules`, `.git`, lockfiles (`package-lock.json`, `yarn.lock`), build dist folders, and media assets.

### Token Reduction Benchmark
- [ ] Evaluated against a multi-module benchmark test project: total token count of the optimized context pack is reduced by at least 50% compared to raw file concatenation.
- [ ] Terminal output displays a clear comparison table (original tokens, optimized tokens, percentage saved).

### CLI End-to-End Execution
- [ ] `contextdiet pack <path> --focus <file> -o <output_path>` creates the specified output file and exits with code 0.
- [ ] Supports `--format md` and `--format xml` tags wrapping files with file path metadata and language tags.
- [ ] `contextdiet --help` prints usage instructions and exits with code 0.
- [ ] Automated test suite achieves 100% pass rate across unit and integration tests.
