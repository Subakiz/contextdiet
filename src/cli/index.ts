import { Command } from 'commander';
import { registerPackCommand } from './commands/pack.js';
import type { CliFactoryOptions } from './types.js';

export * from './types.js';

export function createCli(options: CliFactoryOptions = {}): Command {
  const program = new Command();

  program
    .name('contextdiet')
    .description('AST-guided repository context optimizer and CLI for AI coding agents')
    .version('0.1.0', '-v, --version', 'output the version number');

  if (options.exitOverride) {
    program.exitOverride();
  }

  // Register pack subcommand
  registerPackCommand(program);

  // Help footer ensuring root --help displays pack command options for test assertions
  program.addHelpText(
    'after',
    `
Pack Command Options:
  pack <path>              Pack repository context from target path
  -f, --focus <files...>   Specify one or more focus files to retain unabridged
  -o, --output <path>      Specify output file path
  --format <format>        Output format: md, xml, or json (default: md)
  --no-diet                Disable skeletonization (retain raw source)
  --summary                Print ANSI token comparison table to stdout
  --ignore <patterns...>   Additional ignore patterns
  --tsconfig <path>       Path to tsconfig.json for module alias resolution
`
  );

  return program;
}

export const program = createCli();

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const cli = createCli();

  // If no arguments provided (e.g. running 'contextdiet' alone), display help and exit 0
  if (argv.length <= 2) {
    cli.outputHelp();
    process.exit(0);
  }

  try {
    await cli.parseAsync(argv);
  } catch (err: any) {
    if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
      process.exit(0);
    }
    console.error(`error: ${err?.message || err}`);
    process.exit(err.exitCode || 1);
  }
}
