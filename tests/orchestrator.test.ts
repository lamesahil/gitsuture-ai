import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. Mock the environment
process.env.GITHUB_TOKEN = 'test-token';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';

// 2. Import Orchestrator
import { executeHealingLoop } from '../src/core/orchestrator.js';
import * as agent1Tester from '../src/agents/agent1_tester.js';
import * as agent2Repair from '../src/agents/agent2_repair.js';
import * as agent3Verify from '../src/agents/agent3_verify.js';
import * as octokitGit from '../src/git/octokit.js';
import { prisma } from '../src/db/client.js';
import type { NormalizedPREvent } from '../src/core/types.js';

import * as fs from 'fs';

// Mocks
vi.mock('fs');
vi.mock('../src/agents/agent1_tester.js');
vi.mock('../src/agents/agent2_repair.js');
vi.mock('../src/agents/agent3_verify.js');
vi.mock('../src/git/octokit.js');
vi.mock('../src/db/client.js', () => ({
  prisma: {
    pullRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    healJob: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Orchestrator - executeHealingLoop', () => {
  const jobId = 'job-123';
  const event: NormalizedPREvent = {
    action: 'opened',
    repoFullName: 'test/repo',
    cloneUrl: 'https://github.com/test/repo.git',
    prNumber: 42,
    headBranch: 'feat/test',
    headSha: 'abc1234',
    sender: 'user',
    receivedAt: 'now',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (fs.mkdtempSync as any).mockReturnValue('/mock/workDir');
    (fs.existsSync as any).mockReturnValue(true);
    (fs.readFileSync as any).mockReturnValue('dummy code');
    (prisma.pullRequest.findFirst as any).mockResolvedValue({ id: 'pr-1' });
    (prisma.healJob.create as any).mockResolvedValue({ id: jobId });
  });

  it('should immediately resolve if initial Agent 1 tests pass', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 0 });

    await executeHealingLoop(jobId, event);

    expect(octokitGit.cloneRepository).toHaveBeenCalled();
    expect(agent1Tester.runTestsInSandbox).toHaveBeenCalled();
    expect(agent2Repair.diagnoseAndRepair).not.toHaveBeenCalled();
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'RESOLVED' } });
  });

  it('should run the 3-agent healing loop and resolve on success', async () => {
    // Attempt 1: Agent 1 fails. Agent 3 succeeds.
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValue({
      rootCauseAnalysis: 'Root cause',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff'
    });
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'VERIFIED', diff: 'diff' });

    await executeHealingLoop(jobId, event);

    expect(agent1Tester.runTestsInSandbox).toHaveBeenCalledTimes(1);
    expect(agent2Repair.diagnoseAndRepair).toHaveBeenCalledTimes(1);
    expect(agent3Verify.applyAndVerifyPatch).toHaveBeenCalledTimes(1);
    
    // Git operations
    expect(octokitGit.pushSignedCommit).toHaveBeenCalled();
    expect(octokitGit.postDiagnosticComment).toHaveBeenCalled();
    
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'RESOLVED' } });
  });

  it('should throw an escalation error after 3 failed verification attempts', async () => {
    // Agent 1 fails initially
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    
    // Agent 2 returns a diff
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValue({
      rootCauseAnalysis: 'Root cause',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff'
    });

    // Agent 3 ALWAYS fails (returns FAILED)
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'FAILED' });

    await executeHealingLoop(jobId, event);

    // Should have tried 3 times (the max loop count)
    expect(agent2Repair.diagnoseAndRepair).toHaveBeenCalledTimes(3);
    expect(agent3Verify.applyAndVerifyPatch).toHaveBeenCalledTimes(3);
    
    // No Git operations pushed
    expect(octokitGit.pushSignedCommit).not.toHaveBeenCalled();
    
    // Status updated to FAILED because the loop throws an error caught by the outer block
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'FAILED' } });
  });

  it('should throw and fail if remote head has advanced (stale head protection)', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValue({
      rootCauseAnalysis: 'Root cause',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff'
    });
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'VERIFIED', diff: 'diff' });
    
    // Mock remote sha to be different
    (octokitGit.getRemoteHeadSha as any).mockResolvedValue('advanced-sha-123');

    await executeHealingLoop(jobId, event);

    expect(octokitGit.pushSignedCommit).not.toHaveBeenCalled();
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'FAILED' } });
  });

  it('should throw and fail if remote head cannot be verified (fail-closed API error)', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValue({
      rootCauseAnalysis: 'Root cause',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff'
    });
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'VERIFIED', diff: 'diff' });
    
    // Mock getRemoteHeadSha to throw an error (simulating API failure)
    (octokitGit.getRemoteHeadSha as any).mockRejectedValue(new Error('Failed to verify remote head'));

    await executeHealingLoop(jobId, event);

    expect(octokitGit.pushSignedCommit).not.toHaveBeenCalled();
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'FAILED' } });
  });

  it('should reject unsafe AI file paths (path traversal and absolute paths)', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    
    // Attempt 1: Path Traversal
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValueOnce({
      rootCauseAnalysis: 'Traversal',
      confidenceScore: 0.9,
      filePath: '../../etc/passwd',
      unifiedDiff: 'diff'
    });

    // Attempt 2: Absolute Path (Windows/DOS style to ensure it survives slash stripping and is caught)
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValueOnce({
      rootCauseAnalysis: 'Absolute',
      confidenceScore: 0.9,
      filePath: 'C:/etc/passwd',
      unifiedDiff: 'diff'
    });

    // Attempt 3: Valid Path
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValueOnce({
      rootCauseAnalysis: 'Valid',
      confidenceScore: 0.9,
      filePath: 'src/nested/valid.ts',
      unifiedDiff: 'diff'
    });

    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'VERIFIED', diff: 'diff' });
    (octokitGit.getRemoteHeadSha as any).mockResolvedValue(event.headSha);

    await executeHealingLoop(jobId, event);

    // Agent 3 should only be called once, for the valid path
    expect(agent3Verify.applyAndVerifyPatch).toHaveBeenCalledTimes(1);
    expect(agent3Verify.applyAndVerifyPatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ filePath: 'src/nested/valid.ts' })
    );

    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'RESOLVED' } });
  });

  it('should prevent concurrent write-backs for the same PR (concurrency lock test)', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'error' });
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValue({
      rootCauseAnalysis: 'Root cause',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff'
    });
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValue({ status: 'VERIFIED', diff: 'diff' });
    (octokitGit.getRemoteHeadSha as any).mockResolvedValue(event.headSha);

    // Make the first push block so we can trigger the concurrency lock with the second
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    (octokitGit.pushSignedCommit as any).mockImplementationOnce(() => lockPromise);

    // Start first execution
    const exec1 = executeHealingLoop('job-1', event);

    // Yield to event loop to allow first execution to reach the push (and acquire lock)
    await new Promise(setImmediate);

    // Start second execution for SAME event (same repo/pr)
    await executeHealingLoop('job-2', event);

    // The second execution should immediately fail and be marked FAILED
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: 'job-2' }, data: { status: 'FAILED' } });

    // Release lock to finish exec1
    releaseLock!();
    await exec1;
    
    // The first execution should succeed
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: { status: 'RESOLVED' } });
  });

  it('should use NEW Agent 3 failure output on retry (iterative retry test)', async () => {
    (agent1Tester.runTestsInSandbox as any).mockResolvedValue({ exitCode: 1, stderr: 'INITIAL_ERROR' });
    
    // Attempt 1 patches
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValueOnce({
      rootCauseAnalysis: 'Root cause 1',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff1'
    });

    // Attempt 1 fails verification with specific error
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValueOnce({ 
      status: 'FAILED',
      errorOutput: 'FAILURE_A'
    });

    // Attempt 2 patches
    (agent2Repair.diagnoseAndRepair as any).mockResolvedValueOnce({
      rootCauseAnalysis: 'Root cause 2',
      confidenceScore: 0.9,
      filePath: 'src/test.js',
      unifiedDiff: 'diff2'
    });

    // Attempt 2 succeeds
    (agent3Verify.applyAndVerifyPatch as any).mockResolvedValueOnce({ 
      status: 'VERIFIED',
      diff: 'diff2'
    });

    await executeHealingLoop(jobId, event);

    // Agent 2 should be called twice
    expect(agent2Repair.diagnoseAndRepair).toHaveBeenCalledTimes(2);

    // Second call should contain FAILURE_A
    expect(agent2Repair.diagnoseAndRepair).toHaveBeenNthCalledWith(2,
      'FAILURE_A',        // The updated combined test output (1st argument)
      expect.any(String), // fileContext (2nd argument)
      expect.anything()   // filePath (3rd argument)
    );

    // Should succeed ultimately
    expect(prisma.healJob.update).toHaveBeenCalledWith({ where: { id: jobId }, data: { status: 'RESOLVED' } });
  });
});
