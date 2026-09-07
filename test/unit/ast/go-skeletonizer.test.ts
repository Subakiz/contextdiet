import { describe, it, expect } from 'vitest';
import { GoSkeletonizer } from '../../../src/ast/go-skeletonizer.js';
import { validateGo } from '../../../src/ast/validator.js';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function canRunGo(): boolean {
  try {
    execSync('go version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('GoSkeletonizer', () => {
  const skeletonizer = new GoSkeletonizer();
  const hasHostGo = canRunGo();

  it('handles supported file extensions', () => {
    expect(skeletonizer.canHandle('main.go')).toBe(true);
    expect(skeletonizer.canHandle('app.py')).toBe(false);
    expect(skeletonizer.canHandle('index.ts')).toBe(false);
  });

  it('skeletonizes functions and methods while preserving structs, interfaces and receivers', () => {
    const code = `package service

import (
\t"context"
\t"errors"
\t"fmt"
)

// Config holds service settings.
type Config struct {
\tPort    int    \`json:"port" yaml:"port"\`
\tHost    string \`json:"host"\`
\tEnabled bool   \`json:"enabled"\`
}

// UserStore defines storage operations.
type UserStore interface {
\tGetUser(ctx context.Context, id string) (string, error)
\tSaveUser(ctx context.Context, id string, name string) error
}

type Server struct {
\tcfg   Config
\tstore UserStore
}

func NewServer(cfg Config, store UserStore) *Server {
\treturn &Server{
\t\tcfg:   cfg,
\t\tstore: store,
\t}
}

// HandleRequest processes an incoming call.
func (s *Server) HandleRequest(ctx context.Context, id string) (string, error) {
\tif id == "" {
\t\treturn "", errors.New("empty id")
\t}
\tfmt.Println("Handling request", id)
\treturn s.store.GetUser(ctx, id)
}
`;

    const result = skeletonizer.skeletonize(code, 'service.go');
    expect(result.isValidSyntax).toBe(true);
    expect(result.diagnostics).toBeUndefined();
    expect(result.code).toContain('package service');
    expect(result.code).toContain('type Config struct {');
    expect(result.code).toContain('`json:"port" yaml:"port"`');
    expect(result.code).toContain('type UserStore interface {');
    expect(result.code).toContain('func NewServer(cfg Config, store UserStore) *Server { /* ... */ }');
    expect(result.code).toContain('func (s *Server) HandleRequest(ctx context.Context, id string) (string, error) { /* ... */ }');
    expect(result.code).not.toContain('errors.New');
    expect(result.skeletonLength).toBeLessThan(result.originalLength);

    if (hasHostGo) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'go_test_'));
      const goFile = path.join(tmpDir, 'service.go');
      const runnerFile = path.join(tmpDir, 'runner.go');
      fs.writeFileSync(goFile, result.code);
      const runnerCode = `package main
import (
\t"fmt"
\t"go/parser"
\t"go/token"
\t"os"
)
func main() {
\tcontent, err := os.ReadFile("${goFile}")
\tif err != nil { panic(err) }
\tfset := token.NewFileSet()
\t_, parseErr := parser.ParseFile(fset, "service.go", string(content), parser.AllErrors)
\tif parseErr != nil {
\t\tfmt.Printf("Parse err: %v\\n", parseErr)
\t\tos.Exit(1)
\t}
}
`;
      fs.writeFileSync(runnerFile, runnerCode);
      expect(() => {
        execSync(`go run ${runnerFile}`);
      }).not.toThrow();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('handles Go 1.18+ generics functions and types', () => {
    const code = `package collections

// Filter applies predicate to items.
func Filter[T any](items []T, predicate func(T) bool) []T {
\tvar res []T
\tfor _, item := range items {
\t\tif predicate(item) {
\t\t\tres = append(res, item)
\t\t}
\t}
\treturn res
}

// Pair holds two typed values.
type Pair[K comparable, V any] struct {
\tKey   K
\tValue V
}

func (p *Pair[K, V]) GetKey() K {
\treturn p.Key
}
`;

    const result = skeletonizer.skeletonize(code, 'collections.go');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('func Filter[T any](items []T, predicate func(T) bool) []T { /* ... */ }');
    expect(result.code).toContain('type Pair[K comparable, V any] struct {');
    expect(result.code).toContain('func (p *Pair[K, V]) GetKey() K { /* ... */ }');
    expect(result.code).not.toContain('append(res, item)');
  });

  it('handles function literals (anonymous functions)', () => {
    const code = `package main

var transform = func(x int) int {
\treturn x * 2
}
`;

    const result = skeletonizer.skeletonize(code, 'main.go');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('var transform = func(x int) int { /* ... */ }');
  });

  it('respects custom blockPlaceholder option', () => {
    const code = `package main
func run() {
\tprintln("hi")
}
`;
    const result = skeletonizer.skeletonize(code, 'main.go', {
      blockPlaceholder: '{ panic("stub") }'
    });
    expect(result.code).toContain('func run() { panic("stub") }');
  });

  it('handles empty files and interface-only or type-only files', () => {
    const empty = '';
    const resEmpty = skeletonizer.skeletonize(empty, 'empty.go');
    expect(resEmpty.isValidSyntax).toBe(true);
    expect(resEmpty.code).toBe('');

    const interfaceOnly = `package api

// Reader provides Read method.
type Reader interface {
\tRead(p []byte) (n int, err error)
}

// Writer provides Write method.
type Writer interface {
\tWrite(p []byte) (n int, err error)
}
`;
    const resInterface = skeletonizer.skeletonize(interfaceOnly, 'interfaces.go');
    expect(resInterface.isValidSyntax).toBe(true);
    expect(resInterface.code).toBe(interfaceOnly);
  });
});
