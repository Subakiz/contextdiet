import { describe, it, expect } from 'vitest';
import { AstSkeletonEngine, astSkeletonizer } from '../../../src/ast/index.js';

describe('AstSkeletonEngine', () => {
  const engine = new AstSkeletonEngine();

  it('canHandle accurately checks supported file types', () => {
    expect(engine.canHandle('src/index.ts')).toBe(true);
    expect(engine.canHandle('src/components/App.tsx')).toBe(true);
    expect(engine.canHandle('server/main.js')).toBe(true);
    expect(engine.canHandle('scripts/pipeline.py')).toBe(true);
    expect(engine.canHandle('typings/types.pyi')).toBe(true);
    expect(engine.canHandle('pkg/service.go')).toBe(true);

    expect(engine.canHandle('package.json')).toBe(false);
    expect(engine.canHandle('README.md')).toBe(false);
    expect(engine.canHandle('styles.css')).toBe(false);
  });

  it('detectLanguage returns the expected language identifier', () => {
    expect(engine.detectLanguage('foo.ts')).toBe('typescript');
    expect(engine.detectLanguage('foo.tsx')).toBe('typescript');
    expect(engine.detectLanguage('bar.js')).toBe('javascript');
    expect(engine.detectLanguage('bar.jsx')).toBe('javascript');
    expect(engine.detectLanguage('baz.py')).toBe('python');
    expect(engine.detectLanguage('qux.go')).toBe('go');
    expect(engine.detectLanguage('unknown.xyz')).toBeUndefined();
  });

  it('throws error when skeletonizing unsupported file format', () => {
    expect(() => {
      engine.skeletonize('{}', 'data.json');
    }).toThrow(/Unsupported language or file extension/);
  });

  it('skeletonizes polyglot files across all languages with valid syntax and size reduction', () => {
    // 1. TypeScript
    const tsCode = `
export interface Config { timeout: number; }
export class Client {
  private config: Config;
  constructor(config: Config) {
    this.config = config;
  }
  public async execute(query: string): Promise<string> {
    const raw = await fetch(query);
    return raw.text();
  }
}
`;
    const tsRes = engine.skeletonize(tsCode, 'client.ts');
    expect(tsRes.language).toBe('typescript');
    expect(tsRes.isValidSyntax).toBe(true);
    expect(tsRes.code).toContain('constructor(config: Config) { /* ... */ }');
    expect(tsRes.code).toContain('public async execute(query: string): Promise<string> { /* ... */ }');
    expect(tsRes.skeletonLength).toBeLessThan(tsRes.originalLength);

    // 2. Python
    const pyCode = `
class Service:
    """Service class docstring."""
    debug: bool = False

    def __init__(self, name: str) -> None:
        """Init service."""
        self.name = name

    def run(self) -> None:
        print("running...")
`;
    const pyRes = engine.skeletonize(pyCode, 'service.py');
    expect(pyRes.language).toBe('python');
    expect(pyRes.isValidSyntax).toBe(true);
    expect(pyRes.code).toContain('"""Service class docstring."""');
    expect(pyRes.code).toContain('"""Init service."""');
    expect(pyRes.code).toContain('    ...');
    expect(pyRes.skeletonLength).toBeLessThan(pyRes.originalLength);

    // 3. Go
    const goCode = `
package main

type Task struct {
\tID string \`json:"id"\`
}

func RunTask(t Task) error {
\tif t.ID == "" {
\t\tpanic("missing id")
\t}
\treturn nil
}
`;
    const goRes = engine.skeletonize(goCode, 'main.go');
    expect(goRes.language).toBe('go');
    expect(goRes.isValidSyntax).toBe(true);
    expect(goRes.code).toContain('type Task struct {');
    expect(goRes.code).toContain('func RunTask(t Task) error { /* ... */ }');
    expect(goRes.skeletonLength).toBeLessThan(goRes.originalLength);
  });

  it('singleton export astSkeletonizer is properly instantiated and functional', () => {
    expect(astSkeletonizer).toBeInstanceOf(AstSkeletonEngine);
    expect(astSkeletonizer.canHandle('test.ts')).toBe(true);
  });
});
