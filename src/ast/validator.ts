import ts from 'typescript';
import { parser as pythonParser } from '@lezer/python';
import { parser as goParser } from '@lezer/go';
import type { SupportedLanguage, SyntaxValidationResult } from './types.js';

function getLineAndCol(text: string, pos: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(pos, text.length));
  const before = text.slice(0, clamped);
  const lines = before.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1
  };
}

/**
 * Validates TypeScript/JavaScript code using the official TypeScript compiler API.
 */
export function validateTypeScript(
  sourceText: string,
  filePath: string = 'file.ts'
): SyntaxValidationResult {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  let scriptKind = ts.ScriptKind.TS;
  if (ext === '.tsx') scriptKind = ts.ScriptKind.TSX;
  else if (ext === '.jsx') scriptKind = ts.ScriptKind.JSX;
  else if (ext === '.js' || ext === '.mjs' || ext === '.cjs') scriptKind = ts.ScriptKind.JS;

  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const diagnostics: readonly ts.Diagnostic[] =
    (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] }).parseDiagnostics ?? [];

  if (!diagnostics || diagnostics.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors = diagnostics.map((d: ts.Diagnostic) => {
    const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    return `Line ${line + 1}:${character + 1}: ${msg}`;
  });

  return { valid: false, errors };
}

/**
 * Validates Python code using the @lezer/python pure-JS parser.
 */
export function validatePython(sourceText: string): SyntaxValidationResult {
  const tree = pythonParser.parse(sourceText);
  const cursor = tree.cursor();
  const errors: string[] = [];

  do {
    if (cursor.name === '⚠' || cursor.name.includes('Error')) {
      const { line, col } = getLineAndCol(sourceText, cursor.from);
      errors.push(`Syntax error at line ${line}:${col} (node: ${cursor.name})`);
    }
  } while (cursor.next());

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates Go code using the @lezer/go pure-JS parser.
 */
export function validateGo(sourceText: string): SyntaxValidationResult {
  const tree = goParser.parse(sourceText);
  const cursor = tree.cursor();
  const errors: string[] = [];

  do {
    if (cursor.name === '⚠' || cursor.name.includes('Error')) {
      const { line, col } = getLineAndCol(sourceText, cursor.from);
      errors.push(`Syntax error at line ${line}:${col} (node: ${cursor.name})`);
    }
  } while (cursor.next());

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validates code syntax across supported languages and returns detailed diagnostics.
 */
export function validateSyntaxDetailed(
  sourceCode: string,
  language: SupportedLanguage,
  filePath?: string
): SyntaxValidationResult {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return validateTypeScript(
        sourceCode,
        filePath || (language === 'typescript' ? 'file.ts' : 'file.js')
      );
    case 'python':
      return validatePython(sourceCode);
    case 'go':
      return validateGo(sourceCode);
    default:
      return { valid: true, errors: [] };
  }
}

/**
 * Returns true if the provided source code produces 0 syntax errors in the target language.
 */
export function validateSyntax(
  sourceCode: string,
  language: SupportedLanguage,
  filePath?: string
): boolean {
  return validateSyntaxDetailed(sourceCode, language, filePath).valid;
}
