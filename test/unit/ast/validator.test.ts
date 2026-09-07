import { describe, it, expect } from 'vitest';
import {
  validateSyntax,
  validateSyntaxDetailed,
  validateTypeScript,
  validatePython,
  validateGo
} from '../../../src/ast/validator.js';

describe('AST Syntax Validators', () => {
  describe('TypeScript / JavaScript Validation', () => {
    it('returns valid: true for well-formed TypeScript', () => {
      const code = `
export interface Item { id: string; }
export function getItem(id: string): Item { /* ... */ }
`;
      const res = validateTypeScript(code, 'item.ts');
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(validateSyntax(code, 'typescript', 'item.ts')).toBe(true);
    });

    it('returns valid: false for broken TypeScript syntax', () => {
      const broken = `export function foo( { ((( broken`;
      const res = validateTypeScript(broken, 'broken.ts');
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(validateSyntax(broken, 'typescript', 'broken.ts')).toBe(false);
    });

    it('validates TSX syntax with JSX tags', () => {
      const validTsx = `export const Header = () => <h1>Title</h1>;`;
      const res = validateTypeScript(validTsx, 'header.tsx');
      expect(res.valid).toBe(true);
    });
  });

  describe('Python Validation', () => {
    it('returns valid: true for well-formed Python', () => {
      const code = `
def process(data: dict) -> list[str]:
    """Process dictionary."""
    ...
`;
      const res = validatePython(code);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(validateSyntax(code, 'python')).toBe(true);
    });

    it('returns valid: false for broken Python syntax', () => {
      const broken = `def process(data: dict -> invalid ::: (((`;
      const res = validatePython(broken);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(validateSyntax(broken, 'python')).toBe(false);
    });
  });

  describe('Go Validation', () => {
    it('returns valid: true for well-formed Go', () => {
      const code = `
package main

type Storage interface {
    Get(id string) error
}

func Run() { /* ... */ }
`;
      const res = validateGo(code);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(validateSyntax(code, 'go')).toBe(true);
    });

    it('returns valid: false for broken Go syntax', () => {
      const broken = `package main\nfunc Run( { broken syntax`;
      const res = validateGo(broken);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(validateSyntax(broken, 'go')).toBe(false);
    });
  });

  describe('validateSyntaxDetailed dispatcher', () => {
    it('routes correctly to respective language validators', () => {
      expect(validateSyntaxDetailed('let x = 1;', 'javascript', 'x.js').valid).toBe(true);
      expect(validateSyntaxDetailed('x: int = 1', 'python').valid).toBe(true);
      expect(validateSyntaxDetailed('package main\nvar x = 1', 'go').valid).toBe(true);
    });
  });
});
