import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractEnclosingBlock } from '../src/ast/pruner.js';
import * as fs from 'fs';
import * as path from 'path';

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
    const pruned = extractEnclosingBlock(code, 4);
    expect(pruned).toContain('function calculate');
    expect(pruned).not.toContain('class Calculator');
    expect(pruned).toContain('return sum;');
  });

  it('should extract a class method given a line number inside it', () => {
    const pruned = extractEnclosingBlock(code, 10);
    expect(pruned).toContain('add(a: number, b: number)');
    expect(pruned).not.toContain('function calculate');
    expect(pruned).toContain('return a + b;');
  });

  it('should fallback to returning the whole file if no enclosing block is found', () => {
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

  describe('Cross-file context', () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'ast-cross-file');
    
    beforeAll(() => {
      if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir, { recursive: true });
      
      // 1. local.ts (has exported function)
      fs.writeFileSync(path.join(fixtureDir, 'local.ts'), `
export function helper(x: number) {
  return x * 2;
}
export const otherHelper = 42;
`);

      // 2. external.ts (node_modules mock, though we just test the import path logic)
      // Actually, external imports don't start with . or /
      
      // 3. main.ts (imports local and external)
      fs.writeFileSync(path.join(fixtureDir, 'main.ts'), `
import { helper } from './local';
import { missing } from './missing';
import { lodash } from 'lodash';

export function doMath(val: number) {
  const a = helper(val);
  const b = missing(a);
  return lodash(b);
}
`);

      // 4. depth2.ts
      fs.writeFileSync(path.join(fixtureDir, 'depth2.ts'), `
export function depth2Helper() {
  return "hello";
}
`);
      // 5. depth1.ts
      fs.writeFileSync(path.join(fixtureDir, 'depth1.ts'), `
import { depth2Helper } from './depth2';
export function depth1Helper() {
  return depth2Helper();
}
`);
      // 6. circularA.ts
      fs.writeFileSync(path.join(fixtureDir, 'circularA.ts'), `
import { b } from './circularB';
export function a() { return b(); }
`);
      // 7. circularB.ts
      fs.writeFileSync(path.join(fixtureDir, 'circularB.ts'), `
import { a } from './circularA';
export function b() { return a(); }
`);
      // 8. main2.ts
      fs.writeFileSync(path.join(fixtureDir, 'main2.ts'), `
import { depth1Helper } from './depth1';
import { a } from './circularA';

export function testDepth() {
  depth1Helper();
}
export function testCircular() {
  a();
}
`);
    });

    afterAll(() => {
      if (fs.existsSync(fixtureDir)) {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    });

    it('should include local imported function when used in block', () => {
      const mainPath = path.join(fixtureDir, 'main.ts');
      const mainCode = fs.readFileSync(mainPath, 'utf8');
      
      // targetLine inside doMath (line 7: const a = helper(val);)
      const pruned = extractEnclosingBlock(mainCode, 7, mainPath);
      
      // Should contain the original doMath block
      expect(pruned).toContain('export function doMath');
      
      // Should append the imported 'helper' function
      expect(pruned).toContain('// --- Imported from ./local ---');
      expect(pruned).toContain('export function helper(x: number)');
      expect(pruned).toContain('return x * 2;');
      
      // Should NOT contain other unused exports from local.ts
      expect(pruned).not.toContain('otherHelper');
    });

    it('should gracefully ignore external/node_modules imports', () => {
      const mainPath = path.join(fixtureDir, 'main.ts');
      const mainCode = fs.readFileSync(mainPath, 'utf8');
      
      const pruned = extractEnclosingBlock(mainCode, 7, mainPath);
      
      // 'lodash' is used in the block, but its source doesn't start with ./ or /
      expect(pruned).not.toContain('Imported from lodash');
    });

    it('should gracefully ignore missing local files', () => {
      const mainPath = path.join(fixtureDir, 'main.ts');
      const mainCode = fs.readFileSync(mainPath, 'utf8');
      
      // Does not throw
      const pruned = extractEnclosingBlock(mainCode, 7, mainPath);
      
      // 'missing' is used, but './missing.ts' doesn't exist. Should not crash.
      expect(pruned).not.toContain('Imported from ./missing');
    });

    it('should recursively resolve imports up to maxDepth (Depth 2)', () => {
      const mainPath = path.join(fixtureDir, 'main2.ts');
      const mainCode = fs.readFileSync(mainPath, 'utf8');
      
      const pruned = extractEnclosingBlock(mainCode, 5, mainPath);
      
      expect(pruned).toContain('export function testDepth');
      expect(pruned).toContain('export function depth1Helper');
      expect(pruned).toContain('export function depth2Helper');
    });

    it('should gracefully handle circular dependencies', () => {
      const mainPath = path.join(fixtureDir, 'main2.ts');
      const mainCode = fs.readFileSync(mainPath, 'utf8');
      
      const pruned = extractEnclosingBlock(mainCode, 8, mainPath); // line 8 uses a()
      
      expect(pruned).toContain('export function testCircular');
      expect(pruned).toContain('export function a() { return b(); }');
      expect(pruned).toContain('export function b() { return a(); }');
      // No stack overflow should have occurred.
    });
  });
});
