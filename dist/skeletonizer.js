"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.skeletonizeTSJS = skeletonizeTSJS;
exports.skeletonizeGo = skeletonizeGo;
exports.skeletonizePython = skeletonizePython;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const tree_sitter_go_1 = __importDefault(require("tree-sitter-go"));
function skeletonizeTSJS(source, isTypeScript) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(isTypeScript ? tree_sitter_typescript_1.default.typescript : tree_sitter_javascript_1.default);
    const tree = parser.parse(source);
    // We need to traverse the AST and replace block bodies of functions and methods with { /* implementation hidden */ }
    // We'll collect all nodes that need to be replaced, sort them by start position, and reconstruct the string.
    const replacements = [];
    function traverse(node) {
        // Identify function and method bodies
        if (node.type === 'statement_block' && (node.parent?.type === 'function_declaration' ||
            node.parent?.type === 'method_definition' ||
            node.parent?.type === 'arrow_function' ||
            node.parent?.type === 'function_expression' ||
            node.parent?.type === 'generator_function_declaration')) {
            replacements.push({
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                replacement: '{ /* implementation hidden */ }'
            });
            return; // Skip traversing inside the block
        }
        // Also handle constructor bodies
        if (node.type === 'statement_block' && node.parent?.type === 'constructor_type') {
            replacements.push({
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                replacement: '{ /* implementation hidden */ }'
            });
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                traverse(child);
            }
        }
    }
    traverse(tree.rootNode);
    // Sort replacements in reverse order of startIndex to avoid index shifting during replacements
    replacements.sort((a, b) => b.startIndex - a.startIndex);
    // Keep a clean list without overlaps, prioritizing outer blocks if any weird overlaps exist
    const finalReplacements = [];
    let lastStart = Infinity;
    for (const r of replacements) {
        if (r.endIndex <= lastStart) {
            finalReplacements.push(r);
            lastStart = r.startIndex;
        }
    }
    let result = source;
    for (const r of finalReplacements) {
        result = result.substring(0, r.startIndex) + r.replacement + result.substring(r.endIndex);
    }
    return { skeletonized: result };
}
function skeletonizeGo(source) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(tree_sitter_go_1.default);
    const tree = parser.parse(source);
    const replacements = [];
    function traverse(node) {
        if (node.type === 'block' && (node.parent?.type === 'function_declaration' ||
            node.parent?.type === 'method_declaration' ||
            node.parent?.type === 'func_literal')) {
            replacements.push({
                startIndex: node.startIndex,
                endIndex: node.endIndex,
                replacement: '{ /* implementation hidden */ }'
            });
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                traverse(child);
            }
        }
    }
    traverse(tree.rootNode);
    replacements.sort((a, b) => b.startIndex - a.startIndex);
    const finalReplacements = [];
    let lastStart = Infinity;
    for (const r of replacements) {
        if (r.endIndex <= lastStart) {
            finalReplacements.push(r);
            lastStart = r.startIndex;
        }
    }
    let result = source;
    for (const r of finalReplacements) {
        result = result.substring(0, r.startIndex) + r.replacement + result.substring(r.endIndex);
    }
    return { skeletonized: result };
}
function skeletonizePython(source) {
    const parser = new tree_sitter_1.default();
    parser.setLanguage(tree_sitter_python_1.default);
    const tree = parser.parse(source);
    const replacements = [];
    function traverse(node) {
        if (node.type === 'block' && node.parent?.type === 'function_definition') {
            // Find docstring if it exists
            let docstringNode = null;
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child?.type === 'expression_statement' && child.child(0)?.type === 'string') {
                    docstringNode = child;
                    break;
                }
            }
            if (docstringNode) {
                // Keep docstring, replace the rest
                // We replace from docstring end to block end
                if (docstringNode.endIndex < node.endIndex) {
                    // Check if there is anything after the docstring except whitespace
                    const restText = source.substring(docstringNode.endIndex, node.endIndex);
                    if (restText.trim().length > 0) {
                        // Indent the pass statement based on block's start
                        const lines = source.substring(0, node.startIndex).split('\n');
                        const indent = lines[lines.length - 1].length;
                        replacements.push({
                            startIndex: docstringNode.endIndex,
                            endIndex: node.endIndex,
                            replacement: '\n' + ' '.repeat(indent) + 'pass'
                        });
                    }
                }
            }
            else {
                // Replace entire block with pass
                const lines = source.substring(0, node.startIndex).split('\n');
                const indent = lines[lines.length - 1].length;
                replacements.push({
                    startIndex: node.startIndex,
                    endIndex: node.endIndex,
                    replacement: 'pass'
                });
            }
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child) {
                traverse(child);
            }
        }
    }
    traverse(tree.rootNode);
    replacements.sort((a, b) => b.startIndex - a.startIndex);
    const finalReplacements = [];
    let lastStart = Infinity;
    for (const r of replacements) {
        if (r.endIndex <= lastStart) {
            finalReplacements.push(r);
            lastStart = r.startIndex;
        }
    }
    let result = source;
    for (const r of finalReplacements) {
        result = result.substring(0, r.startIndex) + r.replacement + result.substring(r.endIndex);
    }
    return { skeletonized: result };
}
