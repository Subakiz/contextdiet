import { describe, it, expect } from 'vitest';
import { PythonSkeletonizer } from '../../../src/ast/python-skeletonizer.js';
import { validatePython } from '../../../src/ast/validator.js';
import { execSync } from 'child_process';

function canRunPython3(): boolean {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('PythonSkeletonizer', () => {
  const skeletonizer = new PythonSkeletonizer();
  const hasHostPython = canRunPython3();

  it('handles supported file extensions', () => {
    expect(skeletonizer.canHandle('app.py')).toBe(true);
    expect(skeletonizer.canHandle('types.pyi')).toBe(true);
    expect(skeletonizer.canHandle('index.ts')).toBe(false);
    expect(skeletonizer.canHandle('main.go')).toBe(false);
  });

  it('skeletonizes function with docstring and retains docstring', () => {
    const code = `def calculate(a: int, b: int = 10) -> int:
    """Calculate the sum with default offset.

    Args:
        a: Base number
        b: Offset
    """
    res = a + b
    return res
`;
    const result = skeletonizer.skeletonize(code, 'calc.py');
    expect(result.isValidSyntax).toBe(true);
    expect(result.diagnostics).toBeUndefined();
    expect(result.code).toContain('def calculate(a: int, b: int = 10) -> int:');
    expect(result.code).toContain('"""Calculate the sum with default offset.');
    expect(result.code).toContain('    ...');
    expect(result.code).not.toContain('res = a + b');
    expect(result.skeletonLength).toBeLessThan(result.originalLength);

    if (hasHostPython) {
      expect(() => {
        execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
          input: result.code
        });
      }).not.toThrow();
    }
  });

  it('skeletonizes function without docstring cleanly', () => {
    const code = `def no_doc(x: str) -> str:
    cleaned = x.strip()
    return cleaned.lower()
`;
    const result = skeletonizer.skeletonize(code, 'no_doc.py');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toBe(`def no_doc(x: str) -> str:
    ...
`);
    if (hasHostPython) {
      expect(() => {
        execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
          input: result.code
        });
      }).not.toThrow();
    }
  });

  it('handles classes with class attributes, docstrings, property getters/setters, classmethods', () => {
    const code = `class DataRecord:
    """Represents a database record."""
    schema_version: int = 2
    table_name: str = "records"

    def __init__(self, record_id: str, tags: list[str] = []) -> None:
        """Initialize record."""
        self.record_id = record_id
        self.tags = tags

    @property
    def id(self) -> str:
        """Get ID."""
        return self.record_id

    @id.setter
    def id(self, value: str) -> None:
        self.record_id = value

    @classmethod
    def from_json(cls, raw: str) -> 'DataRecord':
        """Construct from JSON string."""
        import json
        data = json.loads(raw)
        return cls(record_id=data["id"])

    @staticmethod
    def validate_id(record_id: str) -> bool:
        return len(record_id) > 0
`;
    const result = skeletonizer.skeletonize(code, 'record.py');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('class DataRecord:');
    expect(result.code).toContain('"""Represents a database record."""');
    expect(result.code).toContain('schema_version: int = 2');
    expect(result.code).toContain('table_name: str = "records"');
    expect(result.code).toContain('def __init__(self, record_id: str, tags: list[str] = []) -> None:');
    expect(result.code).toContain('"""Initialize record."""');
    expect(result.code).toContain('@property');
    expect(result.code).toContain('@id.setter');
    expect(result.code).toContain('@classmethod');
    expect(result.code).toContain('@staticmethod');
    expect(result.code).not.toContain('json.loads');

    if (hasHostPython) {
      expect(() => {
        execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
          input: result.code
        });
      }).not.toThrow();
    }
  });

  it('handles async functions and decorators', () => {
    const code = `@audit_log
@retry(attempts=3)
async def fetch_async(url: str, timeout: float = 30.0) -> dict:
    """Fetch endpoint asynchronously."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
`;
    const result = skeletonizer.skeletonize(code, 'async_client.py');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('@audit_log');
    expect(result.code).toContain('@retry(attempts=3)');
    expect(result.code).toContain('async def fetch_async(url: str, timeout: float = 30.0) -> dict:');
    expect(result.code).toContain('"""Fetch endpoint asynchronously."""');
    expect(result.code).toContain('    ...');
    expect(result.code).not.toContain('aiohttp.ClientSession');

    if (hasHostPython) {
      expect(() => {
        execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
          input: result.code
        });
      }).not.toThrow();
    }
  });

  it('strips docstrings when preserveDocstrings option is false', () => {
    const code = `def foo():
    """Docstring to remove."""
    return 1
`;
    const result = skeletonizer.skeletonize(code, 'foo.py', { preserveDocstrings: false });
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).not.toContain('Docstring to remove');
    expect(result.code).toContain('def foo():');
    expect(result.code).toContain('    ...');
  });

  it('supports custom pythonPlaceholder (e.g. pass)', () => {
    const code = `def run():
    print("run")
`;
    const result = skeletonizer.skeletonize(code, 'run.py', { pythonPlaceholder: 'pass' });
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('def run():\n    pass\n');
  });

  it('swallows nested inner functions without syntax error', () => {
    const code = `def outer():
    """Outer docstring."""
    def inner():
        return 42
    return inner()
`;
    const result = skeletonizer.skeletonize(code, 'nested.py');
    expect(result.isValidSyntax).toBe(true);
    expect(result.code).toContain('def outer():');
    expect(result.code).toContain('"""Outer docstring."""');
    expect(result.code).not.toContain('def inner()');

    if (hasHostPython) {
      expect(() => {
        execSync('python3 -c "import ast, sys; ast.parse(sys.stdin.read())"', {
          input: result.code
        });
      }).not.toThrow();
    }
  });

  it('handles empty files and class-only/constant-only files', () => {
    const empty = '';
    const resEmpty = skeletonizer.skeletonize(empty, 'empty.py');
    expect(resEmpty.isValidSyntax).toBe(true);
    expect(resEmpty.code).toBe('');

    const modelOnly = `from dataclasses import dataclass
from typing import Optional

@dataclass
class UserDto:
    """User data transfer object."""
    id: str
    username: str
    email: Optional[str] = None
`;
    const resModel = skeletonizer.skeletonize(modelOnly, 'dto.py');
    expect(resModel.isValidSyntax).toBe(true);
    expect(resModel.code).toBe(modelOnly);
  });
});
