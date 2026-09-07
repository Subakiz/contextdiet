# ContextDiet

An AST-guided repository context optimizer and CLI for AI coding agents.

ContextDiet analyzes project dependency graphs, retains full implementation for targeted focus files while skeletonizing dependencies down to exported interfaces, signatures, and type contracts. This cuts token consumption by 60–80% without losing reasoning context.

## Features

- **AST Skeletonization & Signature Extraction Engine**: Parses source code across TypeScript, JavaScript, Python, and Go, stripping internal function/method bodies while retaining exported types, interfaces, function/method signatures, parameter annotations, return types, and docstrings.
- **Dependency Graph Resolution & Focus-Aware Context Packing**: Traces the repository's local import graph to assemble an optimized context pack. Target focus files retain full implementation bodies, imported modules are included in skeletonized form, and non-dependent files, test fixtures, lockfiles, build artifacts, and binary assets are excluded.
- **Token Metric & Compression Audit**: Calculates and reports token consumption before and after compression using standard token estimation (cl100k/BPE equivalent), displaying token savings, reduction percentage, and file-by-file breakdown in a terminal summary report.
- **Flexible Output Formats**: Supports structured output in Markdown, XML, or JSON formats suitable for direct injection into LLM prompts.

## Usage

```bash
npx contextdiet pack --focus src/main.ts --output-format markdown > context.md
```

## Supported Languages
- TypeScript
- JavaScript
- Python
- Go
