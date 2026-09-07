import Parser from 'tree-sitter';
import TS from 'tree-sitter-typescript';
import JS from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';
import Go from 'tree-sitter-go';
import * as fs from 'fs';
import * as path from 'path';

export function extractImportsTSJS(source: string, isTypeScript: boolean): string[] {
  const parser = new Parser();
  parser.setLanguage(isTypeScript ? TS.typescript : JS);
  const tree = parser.parse(source);
  const imports: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === 'import_statement') {
      // Find the string child representing the source
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === 'string') {
          // Remove quotes
          imports.push(source.substring(child.startIndex + 1, child.endIndex - 1));
        }
      }
    } else if (node.type === 'call_expression' && node.child(0)?.text === 'require') {
      const args = node.child(1);
      if (args && args.type === 'arguments' && args.childCount > 1) {
        const strNode = args.child(1);
        if (strNode && strNode.type === 'string') {
          imports.push(source.substring(strNode.startIndex + 1, strNode.endIndex - 1));
        }
      }
    }
    
    // Also dynamic imports: import('...')
    if (node.type === 'call_expression' && node.child(0)?.text === 'import') {
      const args = node.child(1);
      if (args && args.type === 'arguments' && args.childCount > 1) {
        const strNode = args.child(1);
        if (strNode && strNode.type === 'string') {
          imports.push(source.substring(strNode.startIndex + 1, strNode.endIndex - 1));
        }
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  traverse(tree.rootNode);
  return imports;
}

export function isLocalImport(importPath: string): boolean {
  return importPath.startsWith('.') || importPath.startsWith('/');
}

export function resolveTSJSImport(currentFile: string, importPath: string): string | null {
  if (!isLocalImport(importPath)) return null;
  const baseDir = path.dirname(currentFile);
  let resolved = path.resolve(baseDir, importPath);
  
  const extensions = ['.ts', '.js', '.tsx', '.jsx'];
  
  // If it points directly to a file
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;

  // If it's lacking extension
  for (const ext of extensions) {
    if (fs.existsSync(resolved + ext)) return resolved + ext;
  }
  
  // If it's a directory, check for index files
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    for (const ext of extensions) {
      const indexFile = path.join(resolved, 'index' + ext);
      if (fs.existsSync(indexFile)) return indexFile;
    }
  }

  return null;
}

export function resolvePythonImport(currentFile: string, importPath: string): string | null {
  // Python imports can be local if they are relative (start with '.') or if they match a local module in same dir or root.
  // For simplicity we will handle explicit relative and check if the module exists locally.
  const baseDir = path.dirname(currentFile);
  
  // Relative like .mymodule or ..mymodule
  let resolvedParts: string[] = [];
  let currentDir = baseDir;

  if (importPath.startsWith('.')) {
    const parts = importPath.match(/^(\.+)(.*)$/);
    if (parts) {
      const dots = parts[1].length;
      const rest = parts[2];
      
      for (let i = 1; i < dots; i++) {
        currentDir = path.dirname(currentDir);
      }
      resolvedParts = rest ? rest.split('.') : [];
    }
  } else {
    // Treat as absolute within project root? For now just check locally
    resolvedParts = importPath.split('.');
  }

  if (resolvedParts.length > 0) {
    const asFile = path.resolve(currentDir, ...resolvedParts) + '.py';
    if (fs.existsSync(asFile)) return asFile;
    
    const asDir = path.resolve(currentDir, ...resolvedParts, '__init__.py');
    if (fs.existsSync(asDir)) return asDir;
  }
  return null;
}

export function resolveGoImport(currentFile: string, importPath: string, rootDir: string): string | null {
  // In Go, imports are usually absolute to the module. 
  // Very simplistic: just check if importPath matches a folder inside rootDir.
  const resolved = path.resolve(rootDir, importPath);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    // Return the directory, as Go imports are directories. We'd have to read files in it.
    // For this simple resolver, let's just return the directory path.
    return resolved;
  }
  return null;
}

export function isNonSourceAsset(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  
  if (normalized.includes('/node_modules/') || 
      normalized.includes('/dist/') || 
      normalized.includes('/build/') || 
      normalized.includes('/.git/')) {
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const validExts = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go'];
  
  // For Go, the filePath might be a directory
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      return false; // Will explore inside
  }

  return !validExts.includes(ext);
}

export function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('/test/') || 
         normalized.includes('/tests/') || 
         normalized.includes('.test.') || 
         normalized.includes('.spec.') ||
         normalized.endsWith('_test.go') ||
         normalized.includes('test_');
}

export function getDependencies(filePaths: string[], rootDir: string): Set<string> {
  const visited = new Set<string>();
  const queue = [...filePaths];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (isNonSourceAsset(current) || isTestFile(current)) continue;

    // Handle Go directories by reading all .go files inside
    if (fs.existsSync(current) && fs.statSync(current).isDirectory()) {
        const files = fs.readdirSync(current);
        for (const file of files) {
            if (file.endsWith('.go')) {
                queue.push(path.join(current, file));
            }
        }
        continue; // The directory itself is not a source file
    }

    if (!fs.existsSync(current) || !fs.statSync(current).isFile()) continue;

    const ext = path.extname(current);
    const source = fs.readFileSync(current, 'utf-8');
    let imports: string[] = [];

    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
      imports = extractImportsTSJS(source, ext.startsWith('.ts'));
      for (const imp of imports) {
        const resolved = resolveTSJSImport(current, imp);
        if (resolved && !visited.has(resolved) && !isNonSourceAsset(resolved) && !isTestFile(resolved)) {
          queue.push(resolved);
        }
      }
    } else if (ext === '.py') {
      imports = extractImportsPython(source);
      for (const imp of imports) {
        const resolved = resolvePythonImport(current, imp);
        if (resolved && !visited.has(resolved) && !isNonSourceAsset(resolved) && !isTestFile(resolved)) {
          queue.push(resolved);
        }
      }
    } else if (ext === '.go') {
      imports = extractImportsGo(source);
      for (const imp of imports) {
        const resolved = resolveGoImport(current, imp, rootDir);
        if (resolved && !visited.has(resolved) && !isNonSourceAsset(resolved) && !isTestFile(resolved)) {
          queue.push(resolved);
        }
      }
    }
  }

  // Remove the initial focus files from the dependencies set (if desired),
  // but typically we want the full graph, we'll separate focus files later.
  return visited;
}

export function extractImportsPython(source: string): string[] {
  const parser = new Parser();
  parser.setLanguage(Python);
  const tree = parser.parse(source);
  const imports: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === 'import_statement') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === 'dotted_name' || child?.type === 'aliased_import') {
          imports.push(child.text);
        }
      }
    } else if (node.type === 'import_from_statement') {
      // e.g. from x import y. child(1) usually is dotted_name
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === 'dotted_name' || child?.type === 'relative_import') {
          imports.push(child.text);
          break; // Only want the module, not what we're importing from it
        }
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  traverse(tree.rootNode);
  return imports;
}

export function extractImportsGo(source: string): string[] {
  const parser = new Parser();
  parser.setLanguage(Go);
  const tree = parser.parse(source);
  const imports: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === 'import_spec') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child?.type === 'interpreted_string_literal' || child?.type === 'raw_string_literal') {
          imports.push(source.substring(child.startIndex + 1, child.endIndex - 1));
        }
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        traverse(child);
      }
    }
  }
  traverse(tree.rootNode);
  return imports;
}
