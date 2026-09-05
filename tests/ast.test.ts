import { describe, it, expect } from 'vitest';
import { extractEnclosingBlock } from '../src/ast/pruner.js';

describe('AST Pruner', () => {
  const code = `import { Something } from 'somewhere';

export function calculate(a: number, b: number) {
  const sum = a + b;
  return sum;
}

export class Calculator {
  add(a: number, b: number) {
    return a + b;
  }
}
`;

  it('should extract a function block given a line number inside it', () => {
    // Line 4 is inside calculate()
    const pruned = extractEnclosingBlock(code, 4);
    expect(pruned).toContain('function calculate');
    expect(pruned).not.toContain('class Calculator');
    expect(pruned).toContain('return sum;');
  });

  it('should extract a class method given a line number inside it', () => {
    // Line 10 is inside add()
    const pruned = extractEnclosingBlock(code, 10);
    expect(pruned).toContain('add(a: number, b: number)');
    expect(pruned).not.toContain('function calculate');
    expect(pruned).toContain('return a + b;');
  });

  it('should fallback to returning the whole file if no enclosing block is found', () => {
    // Line 1 is an import, outside any function/class
    const pruned = extractEnclosingBlock(code, 1);
    expect(pruned).toBe(code);
  });

  it('should fallback to returning the whole file if an invalid line is given', () => {
    const pruned = extractEnclosingBlock(code, 999);
    expect(pruned).toBe(code);
  });

  it('should fallback to returning the whole file on parse error', () => {
    const invalidCode = `function foo() { <<-- syntax error }`;
    const pruned = extractEnclosingBlock(invalidCode, 1);
    expect(pruned).toBe(invalidCode);
  });
});
