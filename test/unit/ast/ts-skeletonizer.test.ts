import { describe, it, expect } from 'vitest';
import { TypeScriptSkeletonizer } from '../../../src/ast/ts-skeletonizer.js';
import { validateTypeScript } from '../../../src/ast/validator.js';

describe('TypeScriptSkeletonizer', () => {
  const skeletonizer = new TypeScriptSkeletonizer();

  it('handles supported file extensions', () => {
    expect(skeletonizer.canHandle('index.ts')).toBe(true);
    expect(skeletonizer.canHandle('app.tsx')).toBe(true);
    expect(skeletonizer.canHandle('main.js')).toBe(true);
    expect(skeletonizer.canHandle('comp.jsx')).toBe(true);
    expect(skeletonizer.canHandle('module.mjs')).toBe(true);
    expect(skeletonizer.canHandle('common.cjs')).toBe(true);
    expect(skeletonizer.canHandle('main.py')).toBe(false);
    expect(skeletonizer.canHandle('server.go')).toBe(false);
  });

  it('correctly identifies language as typescript or javascript', () => {
    expect(skeletonizer.getLanguage('index.ts')).toBe('typescript');
    expect(skeletonizer.getLanguage('app.tsx')).toBe('typescript');
    expect(skeletonizer.getLanguage('main.js')).toBe('javascript');
    expect(skeletonizer.getLanguage('comp.jsx')).toBe('javascript');
  });

  it('skeletonizes simple function declaration and preserves signatures', () => {
    const code = `
export function add(a: number, b: number): number {
  const result = a + b;
  console.log("Adding numbers", a, b);
  return result;
}
`;
    const result = skeletonizer.skeletonize(code, 'add.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.diagnostics).toBeUndefined();
    expect(result.code).toContain('export function add(a: number, b: number): number { /* ... */ }');
    expect(result.code).not.toContain('console.log');
    expect(result.skeletonLength).toBeLessThan(result.originalLength);
  });

  it('preserves function overloads and only strips implementation body', () => {
    const code = `
export function process(val: string): string;
export function process(val: number): number;
export function process(val: any): any {
  if (typeof val === "string") return val.trim();
  return val * 2;
}
`;
    const result = skeletonizer.skeletonize(code, 'process.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('export function process(val: string): string;');
    expect(result.code).toContain('export function process(val: number): number;');
    expect(result.code).toContain('export function process(val: any): any { /* ... */ }');
  });

  it('preserves classes, interfaces, types, enums and strips method/constructor bodies', () => {
    const code = `
import { BaseService } from './base';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type ID = string | number;

export enum Role {
  Admin = 'ADMIN',
  User = 'USER'
}

export abstract class BaseRunner<T> {
  protected context: T;
  
  constructor(context: T) {
    this.context = context;
  }

  abstract execute(step: number): Promise<void>;

  public async run(): Promise<void> {
    await this.execute(0);
  }

  get active(): boolean {
    return true;
  }

  set active(val: boolean) {
    console.log(val);
  }
}
`;
    const result = skeletonizer.skeletonize(code, 'runner.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('export interface User');
    expect(result.code).toContain('export type ID');
    expect(result.code).toContain('export enum Role');
    expect(result.code).toContain('abstract execute(step: number): Promise<void>;');
    expect(result.code).toContain('constructor(context: T) { /* ... */ }');
    expect(result.code).toContain('public async run(): Promise<void> { /* ... */ }');
    expect(result.code).toContain('get active(): boolean { /* ... */ }');
    expect(result.code).toContain('set active(val: boolean) { /* ... */ }');
  });

  it('handles arrow functions (concise and block) and function expressions', () => {
    const code = `
export const concise = (x: number): number => x * 2;
export const blockArrow = (name: string): string => {
  const upper = name.toUpperCase();
  return \`Hello \${upper}\`;
};
export const fnExpr = function(a: string, b: string): string {
  return a + b;
};
`;
    const result = skeletonizer.skeletonize(code, 'arrows.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('export const concise = (x: number): number => { /* ... */ };');
    expect(result.code).toContain('export const blockArrow = (name: string): string => { /* ... */ };');
    expect(result.code).toContain('export const fnExpr = function(a: string, b: string): string { /* ... */ };');
  });

  it('preserves generators and async generators', () => {
    const code = `
export function* idGen(): Generator<number, void, unknown> {
  let i = 0;
  while (true) yield i++;
}

export async function* streamGen(): AsyncGenerator<string> {
  yield "chunk";
}
`;
    const result = skeletonizer.skeletonize(code, 'gen.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('export function* idGen(): Generator<number, void, unknown> { /* ... */ }');
    expect(result.code).toContain('export async function* streamGen(): AsyncGenerator<string> { /* ... */ }');
  });

  it('preserves decorators and JSDoc comments', () => {
    const code = `
/**
 * Service for handling authentication.
 * @param token The bearer token
 */
@Injectable()
export class AuthService {
  /** Logs the user in */
  @Trace()
  public login(token: string): boolean {
    return token.length > 0;
  }
}
`;
    const result = skeletonizer.skeletonize(code, 'auth.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('@Injectable()');
    expect(result.code).toContain('@Trace()');
    expect(result.code).toContain('Service for handling authentication.');
    expect(result.code).toContain('Logs the user in');
    expect(result.code).toContain('public login(token: string): boolean { /* ... */ }');
  });

  it('handles TSX and JSX components', () => {
    const tsxCode = `
import React from 'react';

export interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return (
    <button onClick={onClick} className="btn">
      <span>{label}</span>
    </button>
  );
};
`;
    const result = skeletonizer.skeletonize(tsxCode, 'button.tsx');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('export interface ButtonProps');
    expect(result.code).toContain('export const Button: React.FC<ButtonProps> = ({ label, onClick }) => { /* ... */ };');
  });

  it('handles nested helper functions cleanly without duplication', () => {
    const code = `
export function outerService(id: string) {
  function innerHelper(x: string) {
    return x.toLowerCase();
  }
  const helperArrow = () => 42;
  return innerHelper(id) + helperArrow();
}
`;
    const result = skeletonizer.skeletonize(code, 'nested.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toBe(`
export function outerService(id: string) { /* ... */ }
`);
  });

  it('handles object literal methods and properties', () => {
    const code = `
export const api = {
  version: '1.0.0',
  fetch(endpoint: string): Promise<Response> {
    return fetch(endpoint);
  },
  post: async (url: string, data: any): Promise<any> => {
    const res = await fetch(url);
    return res.json();
  }
};
`;
    const result = skeletonizer.skeletonize(code, 'api.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain("version: '1.0.0'");
    expect(result.code).toContain('fetch(endpoint: string): Promise<Response> { /* ... */ }');
    expect(result.code).toContain('post: async (url: string, data: any): Promise<any> => { /* ... */ }');
  });

  it('respects custom blockPlaceholder option', () => {
    const code = `function run() { doWork(); }`;
    const result = skeletonizer.skeletonize(code, 'run.ts', {
      blockPlaceholder: '{ /* SKELETON_STUB */ }'
    });
    expect(result.code).toBe('function run() { /* SKELETON_STUB */ }');
  });

  it('skeletonizes class static initialization blocks', () => {
    const code = `
export class Registry {
  static registryMap = new Map<string, any>();
  static {
    Registry.registryMap.set('default', 123);
  }
}
`;
    const result = skeletonizer.skeletonize(code, 'registry.ts');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('static { /* ... */ }');
    expect(result.code).not.toContain('Registry.registryMap.set');
  });

  it('returns unchanged code for empty or type-only files', () => {
    const empty = '';
    const resEmpty = skeletonizer.skeletonize(empty, 'empty.ts');
    expect(resEmpty.isValidSyntax).toBe(true);
    expect(resEmpty.code).toBe('');

    const typeOnly = `
export type Numeric = number | bigint;
export interface Identifiable { id: string; }
`;
    const resType = skeletonizer.skeletonize(typeOnly, 'types.ts');
    expect(resType.isValidSyntax).toBe(true);
    expect(resType.code).toBe(typeOnly);
  });
});
