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
exports.runCLI = runCLI;
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const packer_1 = require("./packer");
const program = new commander_1.Command();
program
    .name('contextdiet')
    .description('AST-guided repository context optimizer for AI coding agents')
    .version('1.0.0');
program
    .command('pack')
    .description('Pack context starting from focus files')
    .requiredOption('-f, --focus <files...>', 'Focus files (entry points), comma separated or multiple flags')
    .option('-d, --dir <directory>', 'Root directory of the project (defaults to current directory)', process.cwd())
    .option('-o, --output-format <format>', 'Output format: markdown, xml, json', 'markdown')
    .action((options) => {
    // Process comma-separated list if provided
    let focusFiles = [];
    for (const f of options.focus) {
        if (f.includes(',')) {
            focusFiles.push(...f.split(','));
        }
        else {
            focusFiles.push(f);
        }
    }
    const rootDir = path.resolve(options.dir);
    const validFormats = ['markdown', 'xml', 'json'];
    const outputFormat = validFormats.includes(options.outputFormat) ? options.outputFormat : 'markdown';
    // Ensure focus files exist
    for (const f of focusFiles) {
        if (!fs.existsSync(path.resolve(rootDir, f))) {
            console.error(`Error: Focus file not found: ${f}`);
            process.exit(1);
        }
    }
    const result = (0, packer_1.packContext)({
        focusFiles,
        rootDir,
        outputFormat: outputFormat
    });
    // Output the report to stderr so the actual content can be piped
    console.error('--- ContextDiet Audit ---');
    console.error(`Files processed: ${result.files.length}`);
    console.error(`Original tokens: ${result.totalOriginalTokens}`);
    console.error(`Skeletonized tokens: ${result.totalSkeletonizedTokens}`);
    console.error(`Total Savings: ${result.totalSavings} tokens (${result.totalSavingsPercentage.toFixed(2)}%)`);
    console.error('-------------------------\n');
    // Output content to stdout
    console.log(result.formattedOutput);
});
function runCLI(args) {
    program.parse(args);
}
