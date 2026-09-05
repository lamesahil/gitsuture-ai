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
});
