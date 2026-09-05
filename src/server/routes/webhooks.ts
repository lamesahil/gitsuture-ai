/**
 * src/server/routes/webhooks.ts
 *
 * GitHub Webhook Ingestion Routes.
 *
 * Endpoint:
 *   POST /api/webhooks/github
 *
 * Responsibility chain:
 *   1. verifyGitHubSignature middleware authenticates the request
 *   2. x-github-event header is read
 *   3. Only pull_request events with supported actions are processed
 *   4. The raw payload is normalized into a NormalizedPREvent
 *   5. The normalized event is passed to the orchestrator stub
 *   6. A 200 + JobAck is returned to GitHub
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { verifyGitHubSignature } from '../middleware/verifySignature.js';
import { handlePullRequestEvent, executeHealingLoop } from '../../core/orchestrator.js';
import type { NormalizedPREvent } from '../../core/types.js';

export const webhooksRouter = Router();

/** Pull request actions that trigger a healing job. */
const SUPPORTED_ACTIONS = new Set(['opened', 'synchronize']);

// ── POST /api/webhooks/github ─────────────────────────────────────────────────

webhooksRouter.post(
  '/github',
  verifyGitHubSignature,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const githubEvent = req.headers['x-github-event'];

    console.log(
      `[WEBHOOK_RECEIVED] event=${githubEvent ?? 'unknown'} ` +
        `delivery=${req.headers['x-github-delivery'] ?? 'unknown'}`
    );

    // ── 1. Filter: only handle pull_request events ────────────────────────
    if (githubEvent !== 'pull_request') {
      console.log(
        `[WEBHOOK] Unsupported event type "${githubEvent}" — ignoring.`
      );
      res.status(422).json({
        message: `Event type "${githubEvent}" is not supported. GitSuture handles: pull_request`,
      });
      return;
    }

    const payload = req.body as GitHubPullRequestPayload;
    const action = payload?.action;

    // ── 2. Filter: only handle supported actions ──────────────────────────
    if (!action || !SUPPORTED_ACTIONS.has(action)) {
      console.log(
        `[WEBHOOK] Unsupported pull_request action "${action}" — ignoring.`
      );
      res.status(422).json({
        message: `pull_request action "${action}" is not supported. Supported: ${Array.from(SUPPORTED_ACTIONS).join(', ')}`,
      });
      return;
    }

    // ── 3. Normalize payload ──────────────────────────────────────────────
    let event: NormalizedPREvent;
    try {
      event = normalizePullRequestPayload(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[WEBHOOK] Payload normalization failed: ${message}`);
      res.status(400).json({ error: 'Bad Request', message });
      return;
    }

    console.log(
      `[PR_EVENT_NORMALIZED] ` +
        `repo=${event.repoFullName} ` +
        `pr=#${event.prNumber} ` +
        `sha=${event.headSha.slice(0, 7)} ` +
        `branch=${event.headBranch} ` +
        `action=${event.action} ` +
        `sender=${event.sender}`
    );

    // ── 4. Hand off to orchestrator ───────────────────────────────────────
    try {
      const ack = await handlePullRequestEvent(event);
      res.status(200).json(ack);
      
      // Asynchronously start the healing loop
      void executeHealingLoop(ack.jobId, event);
    } catch (err) {
      next(err);
    }
  }
);

// ── Normalization ─────────────────────────────────────────────────────────────

/** Minimal typing of the GitHub pull_request webhook payload. */
interface GitHubPullRequestPayload {
  action?: string;
  number?: number;
  pull_request?: {
    number?: number;
    head?: {
      ref?: string;
      sha?: string;
    };
  };
  repository?: {
    full_name?: string;
    clone_url?: string;
  };
  sender?: {
    login?: string;
  };
}

/**
 * Extract only the fields needed by the healing engine from a raw GitHub
 * pull_request webhook payload. Throws if required fields are missing.
 */
function normalizePullRequestPayload(
  payload: GitHubPullRequestPayload
): NormalizedPREvent {
  const repoFullName = payload.repository?.full_name;
  const cloneUrl = payload.repository?.clone_url;
  const prNumber = payload.pull_request?.number ?? payload.number;
  const headBranch = payload.pull_request?.head?.ref;
  const headSha = payload.pull_request?.head?.sha;
  const sender = payload.sender?.login;
  const action = payload.action as NormalizedPREvent['action'];

  if (!repoFullName) throw new Error('Missing repository.full_name in payload');
  if (!cloneUrl) throw new Error('Missing repository.clone_url in payload');
  if (prNumber === undefined || prNumber === null)
    throw new Error('Missing pull_request.number in payload');
  if (!headBranch)
    throw new Error('Missing pull_request.head.ref in payload');
  if (!headSha) throw new Error('Missing pull_request.head.sha in payload');
  if (!sender) throw new Error('Missing sender.login in payload');

  return {
    action,
    repoFullName,
    cloneUrl,
    prNumber,
    headBranch,
    headSha,
    sender,
    receivedAt: new Date().toISOString(),
  };
}
