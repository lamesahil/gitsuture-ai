/**
 * src/agents/agent3_verify.ts
 *
 * Agent 3 — VERIFY
 *
 * Takes the unified diff produced by Agent 2, applies it to the local file,
 * and re-runs Agent 1 (the Docker Sandbox) to verify the test suite passes.
 * If the test suite fails, it rigorously rolls back the changes to ensure
 * the repository is never left in a partially patched state.
 */

import * as fs from 'fs';
import * as path from 'path';
import { applyPatch } from 'diff';
import { runTestsInSandbox } from './agent1_tester.js';
import type { RepairResult, VerificationResult } from '../core/types.js';

/**
 * Applies a patch and verifies the repair by running the test sandbox.
 * 
 * @param repoPath - The root path of the repository.
 * @param repairResult - The result from Agent 2 containing the filePath and unifiedDiff.
 * @returns VerificationResult indicating success or failure.
 */
export async function applyAndVerifyPatch(
  repoPath: string,
  repairResult: RepairResult
): Promise<VerificationResult> {
  const fullFilePath = path.join(repoPath, repairResult.filePath);

  // 1. Verify target file exists
  if (!fs.existsSync(fullFilePath)) {
    console.error(`[AGENT3] Target file does not exist: ${fullFilePath}`);
    return { status: 'FAILED' };
  }

  // 2. Backup the original file contents
  const originalCode = fs.readFileSync(fullFilePath, 'utf8');

  // 3. Apply the Unified Diff patch
  const patchedCode = applyPatch(originalCode, repairResult.unifiedDiff);
  
  if (patchedCode === false) {
    console.error(`[AGENT3] Failed to apply patch cleanly to ${repairResult.filePath}`);
    return { status: 'FAILED' };
  }

  try {
    // 4. Write the patched code to disk
    fs.writeFileSync(fullFilePath, patchedCode, 'utf8');
    console.log(`[AGENT3] Patch applied locally to ${repairResult.filePath}. Verifying...`);

    // 5. Verify the fix using Agent 1
    // The sandbox will run `npm test` against the newly modified files.
    const sandboxResult = await runTestsInSandbox(repoPath);

    if (sandboxResult.exitCode === 0) {
      console.log(`[AGENT3] Verification SUCCESS. Patch is valid.`);
      return { 
        status: 'VERIFIED',
        diff: repairResult.unifiedDiff 
      };
    } else {
      console.error(`[AGENT3] Verification FAILED (Exit Code: ${sandboxResult.exitCode}). Rolling back...`);
      // Fall through to finally block for rollback
      throw new Error('Tests failed after patch application');
    }

  } catch (err) {
    // 6. Rollback to original state on any failure
    fs.writeFileSync(fullFilePath, originalCode, 'utf8');
    console.log(`[AGENT3] Rollback complete for ${repairResult.filePath}.`);
    return { status: 'FAILED' };
  }
}
