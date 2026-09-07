import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { packContext } from '../../packer/index.js';
import { calculateAudit } from '../../token/index.js';
import { renderComparisonTable } from '../../token/table-reporter.js';
import { formatContext } from '../../format/index.js';
import type { OutputFormat, PackOptions } from '../../types.js';
import type { PackCommandOptions } from '../types.js';

export function registerPackCommand(program: Command): Command {
  return program
    .command('pack <path>')
    .description('Analyze repository dependency graph and assemble an optimized context pack')
    .option('-f, --focus <files...>', 'specify one or more focus files to retain unabridged')
    .option('-o, --output <path>', 'specify output file path')
    .option('--format <format>', 'output format: md, xml, or json (default: md)', 'md')
    .option('--no-diet', 'disable skeletonization (retain raw source)')
    .option('--summary', 'print ANSI token comparison table to stdout')
    .option('--ignore <patterns...>', 'additional glob patterns to ignore')
    .option('--tsconfig <path>', 'path to tsconfig.json for module alias resolution')
    .action(async (targetPath: string, options: PackCommandOptions) => {
      try {
        await executePack(targetPath, options);
      } catch (err: any) {
        console.error(`error: ${err?.message || err}`);
        process.exit(1);
      }
    });
}

export async function executePack(targetPath: string, options: PackCommandOptions): Promise<void> {
  // 1. Validate target directory
  const repoRoot = path.resolve(targetPath);
  if (!fs.existsSync(repoRoot)) {
    console.error(`error: target path does not exist: ${targetPath}`);
    process.exit(1);
  }
  const stat = fs.statSync(repoRoot);
  if (!stat.isDirectory()) {
    console.error(`error: target path is not a directory: ${targetPath}`);
    process.exit(1);
  }

  // 2. Validate focus files
  let focusFiles: string[] | undefined;
  if (options.focus && options.focus.length > 0) {
    const rawFocus = Array.isArray(options.focus) ? options.focus : [options.focus];
    focusFiles = [];
    for (const f of rawFocus) {
      let resolved: string;
      if (path.isAbsolute(f)) {
        resolved = f;
      } else if (fs.existsSync(path.resolve(repoRoot, f))) {
        resolved = path.resolve(repoRoot, f);
      } else if (fs.existsSync(path.resolve(process.cwd(), f))) {
        resolved = path.resolve(process.cwd(), f);
      } else {
        resolved = path.resolve(repoRoot, f);
      }

      if (!fs.existsSync(resolved)) {
        console.error(`error: focus file does not exist: ${f}`);
        process.exit(1);
      }
      focusFiles.push(resolved);
    }
  }

  // 3. Validate format choice
  const rawFormat = (options.format || 'md').toLowerCase();
  if (!['md', 'xml', 'json'].includes(rawFormat)) {
    console.error(`error: invalid format '${options.format}', must be one of: md, xml, json`);
    process.exit(1);
  }
  const format = rawFormat as OutputFormat;

  // 4. Resolve --no-diet boolean inversion
  const isNoDiet = options.diet === false || options.noDiet === true;

  // 5. Resolve custom ignore patterns
  const ignorePatterns =
    options.ignore && options.ignore.length > 0
      ? Array.isArray(options.ignore)
        ? options.ignore
        : [options.ignore]
      : undefined;

  // 6. Validate tsconfig path if provided
  let tsconfigPath: string | undefined;
  if (options.tsconfig) {
    if (path.isAbsolute(options.tsconfig)) {
      tsconfigPath = options.tsconfig;
    } else if (fs.existsSync(path.resolve(repoRoot, options.tsconfig))) {
      tsconfigPath = path.resolve(repoRoot, options.tsconfig);
    } else if (fs.existsSync(path.resolve(process.cwd(), options.tsconfig))) {
      tsconfigPath = path.resolve(process.cwd(), options.tsconfig);
    } else {
      tsconfigPath = path.resolve(repoRoot, options.tsconfig);
    }

    if (!fs.existsSync(tsconfigPath)) {
      console.error(`error: tsconfig file does not exist: ${options.tsconfig}`);
      process.exit(1);
    }
  }

  // 7. Execute context packing
  const packOptions: PackOptions = {
    repoRoot,
    focusFiles,
    ignorePatterns,
    noDiet: isNoDiet,
    tsconfigPath
  };

  const packResult = await packContext(packOptions);

  // 8. Compute token audit metrics
  const audit = calculateAudit(packResult.files);

  // 9. Format context pack
  const formattedContent = formatContext(format, {
    files: packResult.files,
    audit
  });

  // 10. Write output to file or stdout
  if (options.output) {
    const outPath = path.isAbsolute(options.output)
      ? path.resolve(options.output)
      : path.resolve(process.cwd(), options.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, formattedContent, 'utf-8');
  } else {
    process.stdout.write(formattedContent);
    if (!formattedContent.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }

  // 11. Render summary table if requested
  if (options.summary) {
    const tableReport = renderComparisonTable(audit);
    if (options.output) {
      console.log(tableReport);
    } else {
      console.error(tableReport);
    }
  }
}
