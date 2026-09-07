import { extractImportsTSJS, extractImportsPython, extractImportsGo, isLocalImport, isTestFile } from '../src/dependencies';

describe('Dependencies', () => {
  describe('Import Extraction', () => {
    it('extracts imports from TypeScript', () => {
      const source = `
        import { a } from './a';
        import b from "../b";
        require('c');
      `;
      const imports = extractImportsTSJS(source, true);
      expect(imports).toContain('./a');
      expect(imports).toContain('../b');
      expect(imports).toContain('c');
    });

    it('extracts imports from Python', () => {
      const source = `
        import os
        from .local import my_func
        import .other
      `;
      const imports = extractImportsPython(source);
      expect(imports).toContain('os');
      expect(imports).toContain('.local');
      expect(imports).toContain('other'); // tree-sitter treats '.other' in 'import .other' as a dotted_name 'other' depending on python version
    });

    it('extracts imports from Go', () => {
      const source = `
        package main
        import (
            "fmt"
            "my_module/local"
        )
      `;
      const imports = extractImportsGo(source);
      expect(imports).toContain('fmt');
      expect(imports).toContain('my_module/local');
    });
  });

  describe('Utils', () => {
    it('identifies local imports', () => {
      expect(isLocalImport('./a')).toBe(true);
      expect(isLocalImport('../a')).toBe(true);
      expect(isLocalImport('/a')).toBe(true);
      expect(isLocalImport('react')).toBe(false);
    });

    it('identifies test files', () => {
      expect(isTestFile('my.test.ts')).toBe(true);
      expect(isTestFile('my.spec.ts')).toBe(true);
      expect(isTestFile('test_main.py')).toBe(true);
      expect(isTestFile('main_test.go')).toBe(true);
      expect(isTestFile('src/test/utils.ts')).toBe(true);
      expect(isTestFile('src/main.ts')).toBe(false);
    });
  });
});