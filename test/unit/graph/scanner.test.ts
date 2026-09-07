import { describe, it, expect } from 'vitest';
import { extractImports } from '../../../src/graph/scanner.js';

describe('extractImports', () => {
  describe('TypeScript & JavaScript', () => {
    it('extracts named, default, namespace, and type imports', () => {
      const code = `
        import { Order, OrderStatus } from './models/order';
        import Config from '../config';
        import * as helpers from './utils/helpers';
        import type { UserProfile } from './types/user';
        export { calculateTax } from './tax';
        export * from './constants';
      `;
      const imports = extractImports(code, 'typescript', 'src/app.ts');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('./models/order');
      expect(specifiers).toContain('../config');
      expect(specifiers).toContain('./utils/helpers');
      expect(specifiers).toContain('./types/user');
      expect(specifiers).toContain('./tax');
      expect(specifiers).toContain('./constants');
    });

    it('extracts dynamic imports and commonjs requires', () => {
      const code = `
        const fs = require('fs');
        const local = require('./local-module');
        async function load() {
          const mod = await import('./dynamic-module');
        }
      `;
      const imports = extractImports(code, 'javascript', 'src/worker.js');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('./local-module');
      expect(specifiers).toContain('./dynamic-module');
    });

    it('is immune to single-line comments, block comments, and string literals', () => {
      const code = `
        // import { Fake1 } from './fake-comment-1';
        /*
           import { Fake2 } from './fake-comment-2';
        */
        const text = "import { Fake3 } from './fake-string-3'";
        import { Real } from './real-module';
      `;
      const imports = extractImports(code, 'typescript', 'src/service.ts');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('./real-module');
      expect(specifiers).not.toContain('./fake-comment-1');
      expect(specifiers).not.toContain('./fake-comment-2');
      expect(specifiers).not.toContain('./fake-string-3');
    });

    it('returns empty array for empty or comment-only code', () => {
      expect(extractImports('', 'typescript', 'empty.ts')).toEqual([]);
      expect(extractImports('// just comments\n/* more comments */', 'typescript', 'comments.ts')).toEqual([]);
    });
  });

  describe('Python', () => {
    it('extracts relative from-imports and absolute imports', () => {
      const code = `
        from .schemas import PredictionRequest, PredictionResult
        from ..models import order
        from ...core.utils import helper
        from . import sibling
        import math
        import sys, os
        import numpy as np, pandas as pd
      `;
      const imports = extractImports(code, 'python', 'service/api.py');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('.schemas');
      expect(specifiers).toContain('..models');
      expect(specifiers).toContain('...core.utils');
      expect(specifiers).toContain('.');
      expect(specifiers).toContain('math');
      expect(specifiers).toContain('sys');
      expect(specifiers).toContain('os');
      expect(specifiers).toContain('numpy');
      expect(specifiers).toContain('pandas');
    });

    it('is immune to Python comments and multiline docstrings', () => {
      const code = `
        # import commented_out
        # from .fake import FakeService
        """
        from fake_docstring import NotReal
        import dummy_lib
        """
        from .valid_module import ValidClass
        import json
      `;
      const imports = extractImports(code, 'python', 'service/valid.py');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('.valid_module');
      expect(specifiers).toContain('json');
      expect(specifiers).not.toContain('commented_out');
      expect(specifiers).not.toContain('.fake');
      expect(specifiers).not.toContain('fake_docstring');
      expect(specifiers).not.toContain('dummy_lib');
    });
  });

  describe('Go', () => {
    it('extracts single and grouped package imports with aliases and dot imports', () => {
      const code = `package raft
        import "fmt"
        import (
          "github.com/benchmark/raft/storage"
          alias "github.com/benchmark/raft/transport"
          . "github.com/benchmark/raft/dot"
          _ "net/http/pprof"
        )
      `;
      const imports = extractImports(code, 'go', 'raft.go');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('fmt');
      expect(specifiers).toContain('github.com/benchmark/raft/storage');
      expect(specifiers).toContain('github.com/benchmark/raft/transport');
      expect(specifiers).toContain('github.com/benchmark/raft/dot');
      expect(specifiers).toContain('net/http/pprof');
    });

    it('is immune to Go comments', () => {
      const code = `package main
        // import "fake/line/comment"
        /*
          import "fake/block/comment"
        */
        import "os"
      `;
      const imports = extractImports(code, 'go', 'main.go');
      const specifiers = imports.map(i => i.specifier);

      expect(specifiers).toContain('os');
      expect(specifiers).not.toContain('fake/line/comment');
      expect(specifiers).not.toContain('fake/block/comment');
    });
  });
});
