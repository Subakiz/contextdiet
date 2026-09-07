import { describe, it, expect } from 'vitest';
import path from 'path';
import { FilterEngine } from '../../../src/filter/index.js';

const MOCK_REPO_ROOT = '/Users/nabils/antigravity/github_maxxing/contextdiet';

describe('Adversarial FilterEngine Stress Tests', () => {
  describe('1. Pure-Path Evaluation (Non-Existent Paths)', () => {
    const filter = new FilterEngine({ repoRoot: MOCK_REPO_ROOT });

    it('evaluates non-existent build outputs and binaries purely by path string', () => {
      expect(filter.isIgnored('/non/existent/path/dist/bundle.js')).toBe(true);
      expect(filter.isIgnored('non/existent/virtual/lib.so')).toBe(true);
      expect(filter.isIgnored('virtual/path/binary.exe')).toBe(true);
      expect(filter.isIgnored('does/not/exist/out/file.o')).toBe(true);
      expect(filter.isIgnored('fake/cache/.parcel-cache/data')).toBe(true);
    });

    it('evaluates non-existent lockfiles without touching disk', () => {
      expect(filter.isIgnored('subpackages/nested/yarn.lock')).toBe(true);
      expect(filter.isIgnored('rust_crate/Cargo.lock')).toBe(true);
      expect(filter.isIgnored('python_pkg/poetry.lock')).toBe(true);
      expect(filter.isIgnored('go_mod/go.sum')).toBe(true);
      expect(filter.isIgnored('deno/pnpm-lock.yaml')).toBe(true);
    });

    it('evaluates non-existent media assets without touching disk', () => {
      expect(filter.isIgnored('assets/icons/favicon.ico')).toBe(true);
      expect(filter.isIgnored('public/videos/hero.webm')).toBe(true);
      expect(filter.isIgnored('fonts/roboto.woff2')).toBe(true);
      expect(filter.isIgnored('documents/report.pdf')).toBe(true);
      expect(filter.isIgnored('data/store.sqlite3')).toBe(true);
    });

    it('does not falsely ignore valid non-existent source files', () => {
      expect(filter.isIgnored('src/virtual/deep/feature.ts')).toBe(false);
      expect(filter.isIgnored('pkg/controllers/auth_controller.go')).toBe(false);
      expect(filter.isIgnored('services/user/service.py')).toBe(false);
      expect(filter.isIgnored('frontend/components/App.jsx')).toBe(false);
    });
  });

  describe('2. Windows Backslashes & Path Normalization', () => {
    const filter = new FilterEngine({ repoRoot: MOCK_REPO_ROOT });

    it('handles Windows backslash separators in ignored paths', () => {
      expect(filter.isIgnored('node_modules\\express\\index.js')).toBe(true);
      expect(filter.isIgnored('dist\\cjs\\bundle.min.js')).toBe(true);
      expect(filter.isIgnored('.next\\static\\chunks\\main.js')).toBe(true);
      expect(filter.isIgnored('vendor\\bundle\\ruby.rb')).toBe(true);
      expect(filter.isIgnored('src\\__snapshots__\\app.snap')).toBe(true);
    });

    it('handles mixed forward and backward slashes', () => {
      expect(filter.isIgnored('src/components\\node_modules/fake.js')).toBe(true);
      expect(filter.isIgnored('build\\outputs/public\\assets/logo.png')).toBe(true);
      expect(filter.isIgnored('src/valid\\nested/code.ts')).toBe(false);
    });

    it('handles Windows relative prefixes', () => {
      expect(filter.isIgnored('.\\src\\index.ts')).toBe(false);
      expect(filter.isIgnored('.\\node_modules\\dep.js')).toBe(true);
    });
  });

  describe('3. Negation Rules (!) and Precedence Ordering', () => {
    it('correctly rescues files excluded by earlier glob patterns', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          'logs/**',
          '!logs/critical.log',
          '*.tmp',
          '!safe.tmp'
        ]
      });

      expect(filter.isIgnored('logs/debug.log')).toBe(true);
      expect(filter.isIgnored('logs/nested/audit.log')).toBe(true);
      expect(filter.isIgnored('logs/critical.log')).toBe(false);
      expect(filter.isIgnored('scratch.tmp')).toBe(true);
      expect(filter.isIgnored('safe.tmp')).toBe(false);
    });

    it('re-ignores a file when a later pattern matches after a negation', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          '*.secret',
          '!safe.secret',
          'safe.*' // later rule re-ignores
        ]
      });

      expect(filter.isIgnored('other.secret')).toBe(true);
      expect(filter.isIgnored('safe.secret')).toBe(true);
    });

    it('handles directory negation patterns', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          'generated/',
          '!generated/types/'
        ]
      });

      expect(filter.isIgnored('generated/client.ts')).toBe(true);
      expect(filter.isIgnored('generated/types/schema.ts')).toBe(false);
    });
  });

  describe('4. Root-Anchored vs Unanchored Rules', () => {
    it('distinguishes root-anchored rules from unanchored rules', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          '/root-only.txt',
          'anywhere.txt'
        ]
      });

      // Root-anchored rule
      expect(filter.isIgnored('root-only.txt')).toBe(true);
      expect(filter.isIgnored('sub/root-only.txt')).toBe(false);
      expect(filter.isIgnored('a/b/c/root-only.txt')).toBe(false);

      // Unanchored rule
      expect(filter.isIgnored('anywhere.txt')).toBe(true);
      expect(filter.isIgnored('sub/anywhere.txt')).toBe(true);
      expect(filter.isIgnored('deep/nested/dir/anywhere.txt')).toBe(true);
    });

    it('handles paths with slashes treated as root-relative per gitignore spec', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          'docs/internal/*.md'
        ]
      });

      expect(filter.isIgnored('docs/internal/secret.md')).toBe(true);
      expect(filter.isIgnored('sub/docs/internal/secret.md')).toBe(false);
    });
  });

  describe('5. Deep Wildcard Matching (**)', () => {
    it('handles leading, trailing, and middle double asterisks', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          '**/fixtures/**',
          'src/**/*.spec.ts',
          '**/*.gen.*'
        ]
      });

      expect(filter.isIgnored('fixtures/data.json')).toBe(true);
      expect(filter.isIgnored('tests/fixtures/mock.ts')).toBe(true);
      expect(filter.isIgnored('a/b/c/fixtures/d/e.ts')).toBe(true);

      expect(filter.isIgnored('src/auth.spec.ts')).toBe(true);
      expect(filter.isIgnored('src/users/services/user.spec.ts')).toBe(true);
      expect(filter.isIgnored('test/users/user.spec.ts')).toBe(false);

      expect(filter.isIgnored('models.gen.ts')).toBe(true);
      expect(filter.isIgnored('src/api/v1/client.gen.go')).toBe(true);
    });
  });

  describe('6. Dotfiles & Metadata', () => {
    it('ignores OS metadata files', () => {
      const filter = new FilterEngine({ repoRoot: MOCK_REPO_ROOT });
      expect(filter.isIgnored('.DS_Store')).toBe(true);
      expect(filter.isIgnored('nested/.DS_Store')).toBe(true);
      expect(filter.isIgnored('Thumbs.db')).toBe(true);
      expect(filter.isIgnored('sub/desktop.ini')).toBe(true);
    });

    it('handles custom dotfile ignore and unignore rules', () => {
      const filter = new FilterEngine({
        repoRoot: MOCK_REPO_ROOT,
        customPatterns: [
          '.env*',
          '!.env.example',
          '.idea/'
        ]
      });

      expect(filter.isIgnored('.env')).toBe(true);
      expect(filter.isIgnored('.env.local')).toBe(true);
      expect(filter.isIgnored('.env.production')).toBe(true);
      expect(filter.isIgnored('.env.example')).toBe(false);
    });
  });

  describe('7. Case Sensitivity & Extensions', () => {
    it('ignores uppercase and mixed-case binary extensions', () => {
      const filter = new FilterEngine({ repoRoot: MOCK_REPO_ROOT });
      expect(filter.isIgnored('image.PNG')).toBe(true);
      expect(filter.isIgnored('photo.JpEg')).toBe(true);
      expect(filter.isIgnored('script.PYC')).toBe(true);
      expect(filter.isIgnored('lib.SO')).toBe(true);
      expect(filter.isIgnored('app.EXE')).toBe(true);
      expect(filter.isIgnored('font.WOFF2')).toBe(true);
    });
  });

  describe('8. Boundary & Anomalous Inputs', () => {
    const filter = new FilterEngine({ repoRoot: MOCK_REPO_ROOT });

    it('gracefully handles empty and single-dot paths without error', () => {
      expect(filter.isIgnored('')).toBe(false);
      expect(filter.isIgnored('.')).toBe(false);
      expect(filter.isIgnored('./')).toBe(false);
    });

    it('rejects / ignores paths escaping outside the repository root', () => {
      const outside = path.resolve(MOCK_REPO_ROOT, '../outside-file.ts');
      expect(filter.isIgnored(outside)).toBe(true);
    });

    it('filterFiles correctly filters adversarial arrays of paths', () => {
      const input = [
        'src/core.ts',
        '',
        'node_modules\\test\\index.js',
        'dist/main.js',
        'src/utils/math.ts',
        'assets/logo.SVG',
        'docs/readme.md'
      ];
      const result = filter.filterFiles(input);
      expect(result).toEqual(['src/core.ts', '', 'src/utils/math.ts', 'docs/readme.md']);
    });
  });
});
