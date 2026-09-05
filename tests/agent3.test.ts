import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { applyAndVerifyPatch } from '../src/agents/agent3_verify.js';
import * as agent1Tester from '../src/agents/agent1_tester.js';
import type { RepairResult } from '../src/core/types.js';

vi.mock('fs');
vi.mock('../src/agents/agent1_tester.js');

describe('Agent 3 - Verify', () => {
  const repoPath = '/dummy/repo';
  const filePath = 'src/test.js';
  const fullFilePath = path.join(repoPath, filePath);

  const originalCode = 'function add(a, b) {\n  a + b;\n}';
  const patchedCode = 'function add(a, b) {\n  return a + b;\n}';
  const patch = `
--- src/test.js
+++ src/test.js
@@ -1,3 +1,3 @@
 function add(a, b) {
-  a + b;
+  return a + b;
 }
`;

  const repairResult: RepairResult = {
    rootCauseAnalysis: 'Missing return',
    confidenceScore: 0.9,
    filePath,
    unifiedDiff: patch,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue(originalCode);
  });

  it('should apply patch, run tests, and return VERIFIED if successful', async () => {
    // Mock sandbox returning success (exit code 0)
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({
      exitCode: 0,
      durationMs: 100,
    });

    const result = await applyAndVerifyPatch(repoPath, repairResult);

    expect(result.status).toBe('VERIFIED');
    expect(result.diff).toBe(patch);

    // Verify fs writes
    expect(fs.writeFileSync).toHaveBeenCalledWith(fullFilePath, patchedCode, 'utf8');
    
    // Sandbox should be called
    expect(agent1Tester.runTestsInSandbox).toHaveBeenCalledWith(repoPath);
    
    // Should NOT have rolled back
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1); 
  });

  it('should rollback and return FAILED if patch application fails', async () => {
    const badPatch = `
--- src/test.js
+++ src/test.js
@@ -1,3 +1,3 @@
 function subtract(a, b) {
-  a - b;
+  return a - b;
 }
`;
    const badRepair = { ...repairResult, unifiedDiff: badPatch };

    const result = await applyAndVerifyPatch(repoPath, badRepair);

    expect(result.status).toBe('FAILED');
    expect(fs.writeFileSync).not.toHaveBeenCalled(); // No write if patch fails to apply
    expect(agent1Tester.runTestsInSandbox).not.toHaveBeenCalled();
  });

  it('should rollback and return FAILED if sandbox tests fail', async () => {
    // Mock sandbox returning failure (exit code 1)
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({
      exitCode: 1,
      durationMs: 100,
    });

    const result = await applyAndVerifyPatch(repoPath, repairResult);

    expect(result.status).toBe('FAILED');

    // First write is the patch, second write is the rollback
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    expect((fs.writeFileSync as any).mock.calls[0]).toEqual([fullFilePath, patchedCode, 'utf8']);
    expect((fs.writeFileSync as any).mock.calls[1]).toEqual([fullFilePath, originalCode, 'utf8']);
  });

  it('should return FAILED if file does not exist', async () => {
    (fs.existsSync as any).mockReturnValue(false);

    const result = await applyAndVerifyPatch(repoPath, repairResult);

    expect(result.status).toBe('FAILED');
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});
