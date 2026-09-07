#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distCli = path.resolve(__dirname, '../dist/cli/index.js');

if (!fs.existsSync(distCli)) {
  console.error('error: ContextDiet must be built before running the CLI. Please run: npm run build');
  process.exit(1);
}

const { runCli } = await import('../dist/cli/index.js');

runCli(process.argv).catch((err) => {
  console.error(`error: ${err?.message || err}`);
  process.exit(1);
});
