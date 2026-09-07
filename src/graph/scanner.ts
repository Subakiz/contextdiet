import ts from 'typescript';
import { parser as pyParser } from '@lezer/python';
import { parser as goParser } from '@lezer/go';
import type { SupportedLanguage } from '../types.js';
import type { ImportInfo } from './types.js';

/**
 * Extract module and relative imports across TypeScript, JavaScript, Python, and Go.
 * Immune to comments, docstrings, and string literals.
 */
export function extractImports(
  code: string,
  language?: SupportedLanguage,
  filePath?: string
): ImportInfo[] {
  const lang = language || detectLanguage(filePath);

  switch (lang) {
    case 'typescript':
    case 'javascript':
      return extractTsJsImports(code);
    case 'python':
      return extractPythonImports(code);
    case 'go':
      return extractGoImports(code);
    default:
      return [];
  }
}

function detectLanguage(filePath?: string): SupportedLanguage {
  if (!filePath) return 'typescript';
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.mts') || lower.endsWith('.cts')) {
    return 'typescript';
  }
  if (lower.endsWith('.js') || lower.endsWith('.jsx') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return 'javascript';
  }
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.go')) return 'go';
  return 'typescript';
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('.\\') ||
    specifier.startsWith('..\\')
  );
}

function extractTsJsImports(code: string): ImportInfo[] {
  // ts.preProcessFile parses using TS internal scanner, ignoring comments and string literals
  const info = ts.preProcessFile(code, true, true);
  const results: ImportInfo[] = [];
  const seen = new Set<string>();

  for (const imp of info.importedFiles) {
    if (!imp.fileName) continue;
    if (!seen.has(imp.fileName)) {
      seen.add(imp.fileName);
      results.push({
        specifier: imp.fileName,
        kind: 'import',
        isRelative: isRelativeSpecifier(imp.fileName),
        start: imp.pos,
        end: imp.end
      });
    }
  }

  return results;
}

function extractPythonImports(code: string): ImportInfo[] {
  const tree = pyParser.parse(code);
  const cursor = tree.cursor();
  const results: ImportInfo[] = [];
  const seen = new Set<string>();

  do {
    if (cursor.name === 'ImportStatement') {
      const node = cursor.node;
      const firstChild = node.firstChild;
      if (!firstChild) continue;

      if (firstChild.name === 'from') {
        let curr = firstChild.nextSibling;
        let start = -1;
        let end = -1;
        while (curr && curr.name !== 'import') {
          if (start === -1) start = curr.from;
          end = curr.to;
          curr = curr.nextSibling;
        }
        if (start !== -1 && end !== -1) {
          const specifier = code.slice(start, end).replace(/\s+/g, '');
          if (specifier && !seen.has(specifier)) {
            seen.add(specifier);
            results.push({
              specifier,
              kind: 'import',
              isRelative: specifier.startsWith('.'),
              start: node.from,
              end: node.to
            });
          }
        }
      } else if (firstChild.name === 'import') {
        let curr = firstChild.nextSibling;
        let segStart = -1;
        let segEnd = -1;
        let inAs = false;
        while (curr) {
          if (curr.name === ',') {
            if (segStart !== -1 && segEnd !== -1) {
              const specifier = code.slice(segStart, segEnd).replace(/\s+/g, '');
              if (specifier && !seen.has(specifier)) {
                seen.add(specifier);
                results.push({
                  specifier,
                  kind: 'import',
                  isRelative: specifier.startsWith('.'),
                  start: node.from,
                  end: node.to
                });
              }
            }
            segStart = -1;
            segEnd = -1;
            inAs = false;
          } else if (curr.name === 'as') {
            inAs = true;
          } else if (!inAs) {
            if (segStart === -1) segStart = curr.from;
            segEnd = curr.to;
          }
          curr = curr.nextSibling;
        }
        if (segStart !== -1 && segEnd !== -1) {
          const specifier = code.slice(segStart, segEnd).replace(/\s+/g, '');
          if (specifier && !seen.has(specifier)) {
            seen.add(specifier);
            results.push({
              specifier,
              kind: 'import',
              isRelative: specifier.startsWith('.'),
              start: node.from,
              end: node.to
            });
          }
        }
      }
    }
  } while (cursor.next());

  return results;
}

function extractGoImports(code: string): ImportInfo[] {
  const tree = goParser.parse(code);
  const results: ImportInfo[] = [];
  const seen = new Set<string>();

  tree.iterate({
    enter(node) {
      if (node.name === 'ImportSpec') {
        let child = node.node.firstChild;
        while (child) {
          if (child.name === 'String') {
            const raw = code.slice(child.from, child.to);
            const specifier = raw.replace(/^["'`]|["'`]$/g, '');
            if (specifier && !seen.has(specifier)) {
              seen.add(specifier);
              results.push({
                specifier,
                kind: 'import',
                isRelative: specifier.startsWith('.'),
                start: node.from,
                end: node.to
              });
            }
          }
          child = child.nextSibling;
        }
      }
    }
  });

  return results;
}
