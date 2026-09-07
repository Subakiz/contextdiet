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
Object.defineProperty(exports, "__esModule", { value: true });
exports.packContext = packContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dependencies_1 = require("./dependencies");
const skeletonizer_1 = require("./skeletonizer");
const tokens_1 = require("./tokens");
function packContext(options) {
    const { focusFiles, rootDir, outputFormat } = options;
    const absoluteFocusFiles = focusFiles.map(f => path.resolve(rootDir, f));
    // Resolve dependencies
    const allDeps = (0, dependencies_1.getDependencies)(absoluteFocusFiles, rootDir);
    const focusSet = new Set(absoluteFocusFiles);
    const packedFiles = [];
    let totalOriginalTokens = 0;
    let totalSkeletonizedTokens = 0;
    for (const dep of allDeps) {
        if (!fs.existsSync(dep))
            continue;
        const source = fs.readFileSync(dep, 'utf-8');
        const isFocus = focusSet.has(dep);
        let finalContent = source;
        const ext = path.extname(dep).toLowerCase();
        if (!isFocus) {
            if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                finalContent = (0, skeletonizer_1.skeletonizeTSJS)(source, ext.startsWith('.ts')).skeletonized;
            }
            else if (ext === '.py') {
                finalContent = (0, skeletonizer_1.skeletonizePython)(source).skeletonized;
            }
            else if (ext === '.go') {
                finalContent = (0, skeletonizer_1.skeletonizeGo)(source).skeletonized;
            }
        }
        const stats = (0, tokens_1.calculateSavings)(source, finalContent);
        totalOriginalTokens += stats.originalTokens;
        totalSkeletonizedTokens += stats.skeletonizedTokens;
        // Use relative path for output
        let relativePath = path.relative(rootDir, dep);
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }
        packedFiles.push({
            filePath: relativePath,
            content: finalContent,
            isFocus,
            stats
        });
    }
    const totalSavings = totalOriginalTokens - totalSkeletonizedTokens;
    const totalSavingsPercentage = totalOriginalTokens > 0 ? (totalSavings / totalOriginalTokens) * 100 : 0;
    // Format output
    let formattedOutput = '';
    if (outputFormat === 'json') {
        formattedOutput = JSON.stringify(packedFiles.map(f => ({ path: f.filePath, content: f.content })), null, 2);
    }
    else if (outputFormat === 'xml') {
        formattedOutput = '<context>\n';
        for (const f of packedFiles) {
            formattedOutput += `  <file path="${f.filePath}">\n`;
            formattedOutput += `<![CDATA[\n${f.content}\n]]>\n`;
            formattedOutput += `  </file>\n`;
        }
        formattedOutput += '</context>\n';
    }
    else {
        // Markdown
        for (const f of packedFiles) {
            formattedOutput += `## File: ${f.filePath}\n\n`;
            formattedOutput += '```' + getLanguageFromExt(f.filePath) + '\n';
            formattedOutput += f.content;
            if (!f.content.endsWith('\n')) {
                formattedOutput += '\n';
            }
            formattedOutput += '```\n\n';
        }
    }
    return {
        files: packedFiles,
        totalOriginalTokens,
        totalSkeletonizedTokens,
        totalSavings,
        totalSavingsPercentage,
        formattedOutput
    };
}
function getLanguageFromExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.ts':
        case '.tsx': return 'typescript';
        case '.js':
        case '.jsx': return 'javascript';
        case '.py': return 'python';
        case '.go': return 'go';
        default: return 'text';
    }
}
