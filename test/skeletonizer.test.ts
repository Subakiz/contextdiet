import { skeletonizeTSJS, skeletonizePython, skeletonizeGo } from '../src/skeletonizer';

describe('Skeletonizer', () => {
  describe('TypeScript/JavaScript', () => {
    it('skeletonizes function declarations', () => {
      const source = `function hello() { console.log("world"); }`;
      const result = skeletonizeTSJS(source, true);
      expect(result.skeletonized).toBe(`function hello() { /* implementation hidden */ }`);
    });

    it('skeletonizes arrow functions', () => {
      const source = `const x = () => { return 1; };`;
      const result = skeletonizeTSJS(source, true);
      expect(result.skeletonized).toBe(`const x = () => { /* implementation hidden */ };`);
    });

    it('skeletonizes classes and methods', () => {
      const source = `
class MyClass {
  constructor() {
    this.x = 1;
  }
  myMethod() {
    return 2;
  }
}`;
      const result = skeletonizeTSJS(source, true);
      expect(result.skeletonized).toContain(`constructor() { /* implementation hidden */ }`);
      expect(result.skeletonized).toContain(`myMethod() { /* implementation hidden */ }`);
    });
  });

  describe('Python', () => {
    it('skeletonizes function retaining docstrings', () => {
      const source = `
def hello():
    """Docstring"""
    print("world")
`;
      const result = skeletonizePython(source);
      expect(result.skeletonized).toContain('"""Docstring"""');
      expect(result.skeletonized).toContain('pass');
      expect(result.skeletonized).not.toContain('print');
    });

    it('skeletonizes function without docstring', () => {
      const source = `
def hello():
    print("world")
`;
      const result = skeletonizePython(source);
      expect(result.skeletonized).toContain('def hello():\n    pass');
    });
  });

  describe('Go', () => {
    it('skeletonizes functions', () => {
      const source = `
package main
func myFunc() {
    fmt.Println("test")
}
`;
      const result = skeletonizeGo(source);
      expect(result.skeletonized).toContain(`func myFunc() { /* implementation hidden */ }`);
    });

    it('skeletonizes methods', () => {
      const source = `
type MyStruct struct {}
func (m *MyStruct) MyMethod() string {
    return "hello"
}
`;
      const result = skeletonizeGo(source);
      expect(result.skeletonized).toContain(`func (m *MyStruct) MyMethod() string { /* implementation hidden */ }`);
    });
  });
});