import { countTokens, calculateSavings } from '../src/tokens';

describe('Tokens', () => {
  it('counts tokens', () => {
    const text = 'hello world';
    const count = countTokens(text);
    expect(count).toBeGreaterThan(0);
  });

  it('calculates savings', () => {
    const orig = 'function a() { console.log("hello world this is a test"); }';
    const skel = 'function a() { /* implementation hidden */ }';
    
    const stats = calculateSavings(orig, skel);
    expect(stats.originalTokens).toBeGreaterThan(stats.skeletonizedTokens);
    expect(stats.savings).toBe(stats.originalTokens - stats.skeletonizedTokens);
    expect(stats.savingsPercentage).toBeGreaterThan(0);
    expect(stats.savingsPercentage).toBeLessThan(100);
  });
});