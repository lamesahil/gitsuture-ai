/**
 * src/core/jobQueue.ts
 *
 * Lightweight in-memory job queue for Phase 1.
 *
 * Backed by a plain Map<string, Job>. Intentionally simple — the interface
 * (createJob / getJob / updateJobStatus / listJobs) is designed to be a
 * drop-in replacement for a Prisma/SQLite implementation in a later phase
 * without touching the orchestrator or routes.
 */

import * as crypto from 'crypto';
import type { Job, JobStatus } from './types.js';

// ── In-memory store ───────────────────────────────────────────────────────────

const jobs = new Map<string, Job>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create and enqueue a new healing job.
 */
export function createJob(params: {
  repoFullName: string;
  prNumber: number;
  commitSha: string;
}): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: crypto.randomUUID(),
    repoFullName: params.repoFullName,
    prNumber: params.prNumber,
    commitSha: params.commitSha,
    status: 'QUEUED',
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(job.id, job);
  return job;
}

/**
 * Retrieve a job by its ID. Returns undefined if not found.
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Update the status of an existing job.
 * Returns the updated job, or undefined if the job was not found.
 */
export function updateJobStatus(id: string, status: JobStatus): Job | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;

  const updated: Job = { ...job, status, updatedAt: new Date().toISOString() };
  jobs.set(id, updated);
  return updated;
}

/**
 * List all jobs currently in memory (useful for debugging / future REST API).
 */
export function listJobs(): Job[] {
  return Array.from(jobs.values());
}

/**
 * Return total count of jobs in the queue.
 */
export function jobCount(): number {
  return jobs.size;
}
