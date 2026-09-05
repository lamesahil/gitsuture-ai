/**
 * src/core/types.ts
 *
 * Shared internal types for the GitSuture healing engine.
 *
 * These types form the clean boundary between raw GitHub webhook payloads
 * and the internal three-agent healing loop described in the master spec.
 */

// ── Normalized Pull Request Event ─────────────────────────────────────────────

/**
 * A normalized, minimal representation of a GitHub pull_request event.
 * Extracted from the raw GitHub webhook payload before being handed to
 * the orchestrator. Contains only what the healing loop needs.
 */
export interface NormalizedPREvent {
  /** The action that triggered the event (e.g. "opened", "synchronize"). */
  action: 'opened' | 'synchronize';

  /** Repository full name in the format "owner/repo". */
  repoFullName: string;

  /** HTTPS clone URL of the repository. */
  cloneUrl: string;

  /** Pull request number. */
  prNumber: number;

  /** The head branch name of the pull request. */
  headBranch: string;

  /** The full SHA of the latest commit on the PR head branch. */
  headSha: string;

  /** GitHub username of the user who opened / last pushed to the PR. */
  sender: string;

  /** ISO 8601 timestamp of when this event was received by the server. */
  receivedAt: string;
}

// ── Job ───────────────────────────────────────────────────────────────────────

/**
 * Status lifecycle for a healing job.
 *
 * QUEUED   → job created, not yet processed by any agent
 * RUNNING  → Agent 1 has been dispatched (future phases)
 * SUCCESS  → all three agents completed, patch verified
 * FAILED   → agents exhausted retries or encountered a fatal error
 */
export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';

/**
 * A lightweight in-memory representation of a healing job.
 * Designed to be replaced with a Prisma/SQLite model in a later phase
 * without changing the orchestrator's interface.
 */
export interface Job {
  /** Unique job identifier (crypto.randomUUID). */
  id: string;

  /** Repository full name ("owner/repo"). */
  repoFullName: string;

  /** Pull request number that triggered this job. */
  prNumber: number;

  /** Commit SHA the job is healing. */
  commitSha: string;

  /** Current lifecycle status. */
  status: JobStatus;

  /** ISO 8601 creation timestamp. */
  createdAt: string;

  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

// ── Orchestrator Response ─────────────────────────────────────────────────────

/**
 * Acknowledgement returned by the orchestrator when a healing job is
 * accepted and queued. Surfaced to the caller (webhook route) and
 * ultimately the external GitHub webhook response.
 */
export interface JobAck {
  jobId: string;
  status: JobStatus;
  message: string;
}

// ── Sandbox Execution (Agent 1 / Agent 3) ────────────────────────────────────

/**
 * Options to customize sandbox execution behavior.
 * All fields are optional — SANDBOX_DEFAULTS are used when omitted.
 */
export interface SandboxOptions {
  /**
   * Docker image to use as the execution environment.
   * @default 'node:20-alpine'
   */
  image?: string;

  /**
   * Shell command to run inside the container.
   * Executed as: sh -c <testCommand>
   * @default 'npm test'
   */
  testCommand?: string;

  /**
   * Hard kill timeout in milliseconds.
   * Container is SIGKILL'd if it does not exit within this window.
   * @default 45_000 (45 seconds)
   */
  timeoutMs?: number;
}

/**
 * Structured result returned by Agent 1 (TEST EXECUTOR) and
 * Agent 3 (VERIFY) after running tests in the Docker sandbox.
 */
export interface SandboxResult {
  /** true iff exitCode === 0 (all tests passed). */
  success: boolean;

  /**
   * Raw container exit code.
   * 0   → pass
   * 1   → test failure (typical)
   * 137 → SIGKILL (timeout or explicit kill)
   */
  exitCode: number;

  /** Combined stdout captured from the container. */
  stdout: string;

  /**
   * Combined stderr captured from the container.
   * Stack traces from failing tests appear here.
   */
  stderr: string;

  /** true if the 45-second hard kill timeout was triggered. */
  timedOut: boolean;

  /** Wall-clock milliseconds the container was running. */
  durationMs: number;
}

// ── Diagnostics & Repair (Agent 2) ──────────────────────────────────────────

/**
 * Structured result returned by Agent 2 (DIAGNOSE + REPAIR).
 * Strictly enforced via Gemini's responseSchema.
 */
export interface RepairResult {
  /** A brief explanation of why the test failed. */
  rootCauseAnalysis: string;

  /** Number from 0.0 to 1.0 indicating confidence in the fix. */
  confidenceScore: number;

  /** The exact file path of the file that was repaired. */
  filePath: string;

  /** The repair patch formatted strictly as a Unified Git Diff. */
  unifiedDiff: string;
}

// ── Verification (Agent 3) ──────────────────────────────────────────────────

/**
 * Result of the Agent 3 patch application and verification sandbox run.
 */
export interface VerificationResult {
  /** VERIFIED if the test suite passes after the patch is applied. FAILED otherwise. */
  status: 'VERIFIED' | 'FAILED';

  /** The successful diff applied, included only if VERIFIED. */
  diff?: string;
}
