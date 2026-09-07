"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImportsTSJS = extractImportsTSJS;
exports.isLocalImport = isLocalImport;
exports.resolveTSJSImport = resolveTSJSImport;
exports.resolvePythonImport = resolvePythonImport;
exports.resolveGoImport = resolveGoImport;
exports.isNonSourceAsset = isNonSourceAsset;
exports.isTestFile = isTestFile;
exports.getDependencies = getDependencies;
exports.extractImportsPython = extractImportsPython;
exports.extractImportsGo = extractImportsGo;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const tree_sitter_go_1 = __importDefault(require("tree-sitter-go"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function extractImportsTSJS(source, isTypeScript) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(isTypeScript ? tree_sitter_typescript_1.default.typescript : tree_sitter_javascript_1.default);
    const tree = parser.parse(source);
    const imports = [];
    function traverse(node) {
        if (node.type === 'import_statement') {
            // Find the string child representing the source
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'string') {
                    // Remove quotes
                    imports.push(source.substring(child.startIndex + 1, child.endIndex - 1));
                }
            }
        }
        else if (node.type === 'call_expression' && node.child(0)?.text === 'require') {
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
function isLocalImport(importPath) {
    return importPath.startsWith('.') || importPath.startsWith('/');
}
function resolveTSJSImport(currentFile, importPath) {
    if (!isLocalImport(importPath))
        return null;
    const baseDir = path.dirname(currentFile);
    let resolved = path.resolve(baseDir, importPath);
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    // If it points directly to a file
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile())
        return resolved;
    // If it's lacking extension
    for (const ext of extensions) {
        if (fs.existsSync(resolved + ext))
            return resolved + ext;
    }
    // If it's a directory, check for index files
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        for (const ext of extensions) {
            const indexFile = path.join(resolved, 'index' + ext);
            if (fs.existsSync(indexFile))
                return indexFile;
        }
    }
    return null;
}
function resolvePythonImport(currentFile, importPath) {
    // Python imports can be local if they are relative (start with '.') or if they match a local module in same dir or root.
    // For simplicity we will handle explicit relative and check if the module exists locally.
    const baseDir = path.dirname(currentFile);
    // Relative like .mymodule or ..mymodule
    let resolvedParts = [];
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
    }
    else {
        // Treat as absolute within project root? For now just check locally
        resolvedParts = importPath.split('.');
    }
    if (resolvedParts.length > 0) {
        const asFile = path.resolve(currentDir, ...resolvedParts) + '.py';
        if (fs.existsSync(asFile))
            return asFile;
        const asDir = path.resolve(currentDir, ...resolvedParts, '__init__.py');
        if (fs.existsSync(asDir))
            return asDir;
    }
    return null;
}
function resolveGoImport(currentFile, importPath, rootDir) {
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
function isNonSourceAsset(filePath) {
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
function isTestFile(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.includes('/test/') ||
        normalized.includes('/tests/') ||
        normalized.includes('.test.') ||
        normalized.includes('.spec.') ||
        normalized.endsWith('_test.go') ||
        normalized.includes('test_');
}
function getDependencies(filePaths, rootDir) {
    const visited = new Set();
    const queue = [...filePaths];
    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current))
            continue;
        visited.add(current);
        if (isNonSourceAsset(current) || isTestFile(current))
            continue;
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
        if (!fs.existsSync(current) || !fs.statSync(current).isFile())
            continue;
        const ext = path.extname(current);
        const source = fs.readFileSync(current, 'utf-8');
        let imports = [];
        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
            imports = extractImportsTSJS(source, ext.startsWith('.ts'));
            for (const imp of imports) {
                const resolved = resolveTSJSImport(current, imp);
                if (resolved && !visited.has(resolved) && !isNonSourceAsset(resolved) && !isTestFile(resolved)) {
                    queue.push(resolved);
                }
            }
        }
        else if (ext === '.py') {
            imports = extractImportsPython(source);
            for (const imp of imports) {
                const resolved = resolvePythonImport(current, imp);
                if (resolved && !visited.has(resolved) && !isNonSourceAsset(resolved) && !isTestFile(resolved)) {
                    queue.push(resolved);
                }
            }
        }
        else if (ext === '.go') {
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
function extractImportsPython(source) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(tree_sitter_python_1.default);
    const tree = parser.parse(source);
    const imports = [];
    function traverse(node) {
        if (node.type === 'import_statement') {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'dotted_name' || child?.type === 'aliased_import') {
                    imports.push(child.text);
                }
            }
        }
        else if (node.type === 'import_from_statement') {
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
function extractImportsGo(source) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(tree_sitter_go_1.default);
    const tree = parser.parse(source);
    const imports = [];
    function traverse(node) {
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
