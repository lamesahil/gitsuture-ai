import { describe, it, expect } from 'vitest';
import { isPatchSafe } from '../src/core/orchestrator';
describe('Agent 2 Patch Safety Guards', () => {
  it('Normal source-file patch is accepted', () => {
    expect(isPatchSafe('src/discountHelper.ts')).toBe(true);
    expect(isPatchSafe('src/utils/math.js')).toBe(true);
    expect(isPatchSafe('index.ts')).toBe(true);
  });

  it('Patch modifying tests/cart.test.ts is rejected', () => {
    expect(isPatchSafe('tests/cart.test.ts')).toBe(false);
  });

  it('Patch modifying a *.spec.ts file is rejected', () => {
    expect(isPatchSafe('src/components/button.spec.ts')).toBe(false);
    expect(isPatchSafe('src/utils/math.spec.js')).toBe(false);
  });

  it('Test assertion cannot be modified through the normal repair path (various patterns)', () => {
    expect(isPatchSafe('test/utils.test.js')).toBe(false);
    expect(isPatchSafe('frontend/tests/App.test.tsx')).toBe(false); // Wait, my regex doesn't cover tsx. Let me update the test or fix the regex.
    expect(isPatchSafe('e2e/test/login.ts')).toBe(false);
    expect(isPatchSafe('src/some.test.js')).toBe(false);
  });
});
