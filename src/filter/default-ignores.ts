/**
 * Built-in default exclusion patterns for ContextDiet.
 * Eliminates repository noise, dependencies, build outputs, lockfiles, and media.
 */

export const BUILTIN_IGNORE_DIRS = new Set<string>([
  // Version Control Systems
  '.git',
  '.svn',
  '.hg',
  '.bzr',

  // Package Managers & Dependencies
  'node_modules',
  'vendor',
  '.pnpm-store',
  '.yarn',

  // Python Environments & Caches
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  'env',
  '.tox',

  // Build Outputs & Bundlers
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  'target',
  '.next',
  '.nuxt',
  '.turbo',
  '.astro',
  '.svelte-kit',
  'coverage',
  '.nyc_output',
  '.parcel-cache',

  // IDE & Editor Metadata
  '.idea',
  '.vscode',
  '.vs',

  // Test Snapshots
  '__snapshots__'
]);

export const BUILTIN_IGNORE_FILES = new Set<string>([
  // Lockfiles
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'Pipfile.lock',
  'composer.lock',
  'flake.lock',

  // OS Metadata
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini'
]);

export const BUILTIN_IGNORE_EXTENSIONS = new Set<string>([
  // Compiled Objects & Binaries
  '.pyc',
  '.pyo',
  '.pyd',
  '.o',
  '.obj',
  '.a',
  '.lib',
  '.so',
  '.dylib',
  '.dll',
  '.exe',
  '.bin',
  '.class',
  '.jar',
  '.wasm',
  '.tsbuildinfo',

  // Raster & Vector Images
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.webp',
  '.avif',
  '.bmp',
  '.tiff',

  // Audio & Video Media
  '.mp3',
  '.mp4',
  '.wav',
  '.mov',
  '.avi',
  '.mkv',
  '.flac',
  '.webm',
  '.m4a',
  '.ogg',

  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',

  // Archives
  '.zip',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.xz',
  '.7z',
  '.rar',
  '.dmg',
  '.iso',

  // Documents & Databases
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.epub',
  '.sqlite',
  '.db',
  '.sqlite3'
]);
