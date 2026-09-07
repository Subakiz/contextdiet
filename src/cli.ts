import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { packContext } from './packer';

const program = new Command();

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
      } else {
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

    const result = packContext({
      focusFiles,
      rootDir,
      outputFormat: outputFormat as 'markdown' | 'xml' | 'json'
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

export function runCLI(args: string[]) {
  program.parse(args);
}
