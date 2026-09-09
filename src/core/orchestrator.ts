/**
 * src/core/orchestrator.ts
 *
 * Phase 1 Orchestrator Stub.
 *
 * Receives normalized pull_request events and issues healing job
 * acknowledgements. Does NOT execute agents yet.
 *
 * Architecture:
 *   handlePullRequestEvent(event)
 *     → creates a QUEUED job
 *     → logs that a healing job would be started
 *     → returns a structured JobAck
 *
 * Phase 2 extension point:
 *   Replace the TODO comment below with:
 *     await agent1Tester.run(job, event);
 *   The JobAck interface and job queue interface remain stable.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { prisma } from '../db/client.js';
import { runTestsInSandbox } from '../agents/agent1_tester.js';
import { diagnoseAndRepair } from '../agents/agent2_repair.js';
import { applyAndVerifyPatch } from '../agents/agent3_verify.js';
import { cloneRepository, pushSignedCommit, postDiagnosticComment } from '../git/octokit.js';
import { extractEnclosingBlock } from '../ast/pruner.js';
import type { NormalizedPREvent, JobAck } from './types.js';

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Accept a normalized PR event and acknowledge a healing job.
 *
 * @param event - A validated, normalized pull_request event from the webhook layer.
 * @returns     - A JobAck containing the job ID and initial QUEUED status.
 */
export async function handlePullRequestEvent(
  event: NormalizedPREvent
): Promise<JobAck> {
  // Ensure PullRequest exists and create a HealJob record
  let pr = await prisma.pullRequest.findFirst({
    where: { repoFullName: event.repoFullName, prNumber: event.prNumber },
  });

  if (!pr) {
    pr = await prisma.pullRequest.create({
      data: {
        repoFullName: event.repoFullName,
        prNumber: event.prNumber,
        headBranch: event.headBranch,
        headSha: event.headSha,
        sender: event.sender,
      },
    });
  } else {
    // Update branch and SHA in case they changed (e.g. synchronize event)
    pr = await prisma.pullRequest.update({
      where: { id: pr.id },
      data: {
        headBranch: event.headBranch,
        headSha: event.headSha,
        sender: event.sender,
      },
    });
  }

  const job = await prisma.healJob.create({
    data: {
      pullRequestId: pr.id,
      status: 'QUEUED',
    },
  });

  console.log(
    `[ORCHESTRATOR] [HEALING_JOB_QUEUED] ` +
      `job=${job.id} ` +
      `repo=${event.repoFullName} ` +
      `pr=#${event.prNumber} ` +
      `sha=${event.headSha.slice(0, 7)} ` +
      `action=${event.action}`
  );

  // ── Phase 2 extension point ──────────────────────────────────────────────
  // TODO: Dispatch Agent 1 (TEST EXECUTOR) here.
  //   Example:
  //     await agent1Tester.run(job, event);
  //   Agent 1 will clone the repo into an isolated Docker sandbox,
  //   execute the test suite, and capture stdout/stderr/exit code.
  //   On failure it will hand off to Agent 2 (DIAGNOSE + REPAIR).
  //   Agent 3 (VERIFY) re-runs tests to confirm the patch works.
  // ────────────────────────────────────────────────────────────────────────

  console.log(
    `[ORCHESTRATOR] Healing job queued. ` +
      `Agent 1 dispatch deferred to async execution. ` +
      `job=${job.id}`
  );

  return {
    jobId: job.id,
    status: job.status as import('./types.js').JobStatus,
    message: `Healing job queued. Job ID: ${job.id}`,
  };
}

// ── Jest failure parser ───────────────────────────────────────────────────────

/**
 * Parses Jest/Node test output to find the first failing SOURCE file path
 * and the line number where the error occurred.
 *
 * Jest prints failure traces like:
 *   ● calculateTotal correctly adds two numbers
 *       expect(received).toBe(expected)
 *       at Object.<anonymous> (math.test.js:4:5)
 *
 * We want the source file (math.js), not the test file. We look for lines in
 * the trace that reference non-test JS/TS files inside the workspace.
 *
 * @param output     - Combined stdout + stderr from the test run.
 * @param workDir    - The cloned repo root (used to verify file existence).
 * @returns { filePath, lineNumber } relative path and 1-based line, or null.
 */
function parseFailingFile(
  output: string,
  workDir: string
): { filePath: string; lineNumber: number } | null {
  // Strategy 1: find explicit "FAIL <file>" lines Jest prints at the top
  // e.g.: "FAIL ./math.test.js (8.063 s)"
  const failLineMatch = output.match(/^FAIL\s+(\S+\.(?:js|ts|jsx|tsx))(?:\s+\(.*?\))?$/m);
  if (failLineMatch) {
    const testFile = failLineMatch[1];
    // Derive the corresponding source file (e.g., math.test.js -> math.js)
    const sourceFile = testFile.replace(/\.test\.(js|ts|jsx|tsx)$/, '.$1');
    if (fs.existsSync(path.join(workDir, sourceFile))) {
      return { filePath: sourceFile, lineNumber: 1 };
    }
    // The test file IS the relevant context if source isn't found
    if (fs.existsSync(path.join(workDir, testFile))) {
      return { filePath: testFile, lineNumber: 1 };
    }
  }

  // Strategy 2: scan stack frames for (.js|.ts) references that are NOT node_modules
  // e.g.: "at Object.<anonymous> (math.js:3:10)"
  const frameRegex = /at\s+\S+\s+\(([^)]+\.(?:js|ts|jsx|tsx)):(\d+):\d+\)/g;
  let match: RegExpExecArray | null;
  while ((match = frameRegex.exec(output)) !== null) {
    const [, rawPath, lineStr] = match;
    if (rawPath.includes('node_modules')) continue;
    // rawPath may be absolute or relative; normalise to relative inside workDir
    const rel = rawPath.startsWith(workDir)
      ? path.relative(workDir, rawPath)
      : rawPath;
    const absPath = path.join(workDir, rel);
    if (fs.existsSync(absPath)) {
      return { filePath: rel.replace(/\\/g, '/'), lineNumber: parseInt(lineStr, 10) };
    }
  }

  // Strategy 3: list JS files in the root of workDir excluding test files
  // (last-resort: pass all source files as context)
  // Guard with Array.isArray so a vi.mock('fs') in unit tests (which returns undefined
  // from readdirSync) doesn't throw and short-circuit the healing loop.
  const dirEntries = fs.readdirSync(workDir);
  const rootFiles = Array.isArray(dirEntries)
    ? dirEntries.filter(
        (f) => /\.(js|ts)$/.test(f) && !f.includes('.test.') && f !== 'jest.config.js'
      )
    : [];
  if (rootFiles.length > 0) {
    console.warn(`[ORCHESTRATOR] Could not parse failing file from output. Guessing: ${rootFiles[0]}`);
    return { filePath: rootFiles[0], lineNumber: 1 };
  }

  return null;
}

/**
 * Asynchronously executes the 3-Agent healing loop for a queued job.
 * 
 * @param jobId - The ID of the queued job
 * @param event - The PR event details
 */
export async function executeHealingLoop(jobId: string, event: NormalizedPREvent): Promise<void> {
  const MAX_RETRIES = 3;
  // Create a temporary directory for cloning
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitsuture-'));
  
  try {
    console.log(`[ORCHESTRATOR] [STATE: QUEUED -> CLONING] job=${jobId}`);
    await prisma.healJob.update({ where: { id: jobId }, data: { status: 'CLONING' } });
    
    // Clone repo
    await cloneRepository(event.cloneUrl, event.headBranch, workDir);

    console.log(`[ORCHESTRATOR] [STATE: CLONING -> TESTING] job=${jobId}`);
    await prisma.healJob.update({ where: { id: jobId }, data: { status: 'TESTING' } });
    
    // Agent 1: Run initial tests
    const initialTestResult = await runTestsInSandbox(workDir);

    if (initialTestResult.exitCode === 0) {
      console.log(`[ORCHESTRATOR] [STATE: TESTING -> RESOLVED] Initial tests passed. job=${jobId}`);
      await prisma.healJob.update({ where: { id: jobId }, data: { status: 'RESOLVED' } });
      return;
    }

    console.log(`[ORCHESTRATOR] Initial tests failed. Entering healing loop. job=${jobId}`);
    const combinedOutput = [initialTestResult.stdout, initialTestResult.stderr]
      .filter(Boolean)
      .join('\n');
    console.log(`[ORCHESTRATOR] Combined test output (first 500 chars):\n${combinedOutput.slice(0, 500)}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(`[ORCHESTRATOR] --- HEALING ATTEMPT ${attempt}/${MAX_RETRIES} ---`);
      
      console.log(`[ORCHESTRATOR] [STATE: TESTING -> DIAGNOSING] job=${jobId}`);
      await prisma.healJob.update({ 
        where: { id: jobId }, 
        data: { 
          status: 'DIAGNOSING', 
          attempt,
          initialError: attempt === 1 ? combinedOutput.slice(0, 2000) : undefined,
        } 
      });

      // ── Determine the failing file via Jest output parsing ───────────────
      const parsed = parseFailingFile(combinedOutput, workDir);
      
      let failingFilePath: string;
      let fileContext: string;

      if (parsed) {
        failingFilePath = parsed.filePath;
        const absFailingFile = path.join(workDir, failingFilePath);
        const rawCode = fs.readFileSync(absFailingFile, 'utf8');
        // Use AST pruner to extract the narrowest enclosing block around the error
        fileContext = extractEnclosingBlock(rawCode, parsed.lineNumber);
        console.log(`[ORCHESTRATOR] Failing file identified: ${failingFilePath} (line ${parsed.lineNumber})`);
        console.log(`[ORCHESTRATOR] AST-pruned context (${fileContext.length} chars):`);
        console.log(fileContext);
      } else {
        // Fallback: list all source files and concatenate them (best-effort)
        failingFilePath = 'unknown';
        fileContext = '';
        console.warn(`[ORCHESTRATOR] Could not identify failing file. Sending full test output as context.`);
      }

      // Agent 2: Diagnose and Repair
      const repairResult = await diagnoseAndRepair(
        combinedOutput,
        fileContext,
        failingFilePath
      );

      // Normalise the filePath returned by Gemini (strip leading slashes / workDir prefix)
      const repairFilePath = repairResult.filePath
        .replace(/^\/+/, '')         // strip leading slashes
        .replace(/^workspace\//, ''); // strip /workspace/ prefix that Gemini sometimes adds
      repairResult.filePath = repairFilePath;
      
      console.log(`[ORCHESTRATOR] Agent 2 suggests patching: ${repairResult.filePath} (confidence=${repairResult.confidenceScore})`);
      console.log(`[ORCHESTRATOR] Root cause: ${repairResult.rootCauseAnalysis}`);

      console.log(`[ORCHESTRATOR] [STATE: DIAGNOSING -> VERIFYING] job=${jobId}`);
      await prisma.healJob.update({ 
        where: { id: jobId }, 
        data: { 
          status: 'VERIFYING',
          appliedDiff: repairResult.unifiedDiff
        } 
      });

      // Agent 3: Apply patch and verify
      const verificationResult = await applyAndVerifyPatch(workDir, repairResult);

      if (verificationResult.status === 'VERIFIED') {
        console.log(`[ORCHESTRATOR] Patch verified. Committing changes...`);
        
        await pushSignedCommit(workDir, `fix: AI auto-repair by GitSuture\n\nRoot cause: ${repairResult.rootCauseAnalysis}`);
        
        const comment = `### 🩺 GitSuture Auto-Repair\n\n**Root Cause:** ${repairResult.rootCauseAnalysis}\n**Confidence:** ${(repairResult.confidenceScore * 100).toFixed(0)}%\n\n\`\`\`diff\n${repairResult.unifiedDiff}\n\`\`\``;
        await postDiagnosticComment(event.repoFullName, event.prNumber, comment);

        console.log(`[ORCHESTRATOR] [STATE: VERIFYING -> HEALED] job=${jobId}`);
        await prisma.healJob.update({ where: { id: jobId }, data: { status: 'RESOLVED' } });
        return; // Success — E2E healing complete
      }

      console.log(`[ORCHESTRATOR] Verification failed on attempt ${attempt}.`);
      if (attempt === MAX_RETRIES) {
        throw new Error(`Maximum retries (${MAX_RETRIES}) reached. Escalating to human intervention.`);
      }
    }

  } catch (err) {
    console.error(`[ORCHESTRATOR] [STATE: FAILED] Healing failed: ${err instanceof Error ? err.message : String(err)}`);
    await prisma.healJob.update({ where: { id: jobId }, data: { status: 'FAILED' } });
  } finally {
    // Cleanup workDir
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`[ORCHESTRATOR] Failed to clean up work dir ${workDir}`);
    }
  }
}
