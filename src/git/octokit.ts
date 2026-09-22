/**
 * src/git/octokit.ts
 *
 * GitHub operations layer.
 * Manages cloning, pushing commits, and posting comments to PRs.
 * Uses `simple-git` for local operations and `@octokit/rest` for API calls.
 *
 * Authentication modes (selected automatically at runtime):
 *
 *   PAT mode (default / fallback):
 *     - Uses env.GITHUB_TOKEN (Personal Access Token).
 *     - Clone URL: https://<token>@github.com/<owner>/<repo>.git
 *     - Activated when installationId is undefined or App credentials are absent.
 *
 *   GitHub App mode:
 *     - Uses a short-lived installation access token obtained via @octokit/auth-app.
 *     - Clone URL: https://x-access-token:<token>@github.com/<owner>/<repo>.git
 *       (The "x-access-token" username is REQUIRED for App installation tokens —
 *        they do NOT work when injected directly as a username the way PATs do.)
 *     - Activated when installationId is provided AND GITHUB_APP_ID + key are set.
 *
 * The healing engine (orchestrator) is auth-mode agnostic: it passes an optional
 * installationId through the NormalizedPREvent, and this layer handles the rest.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { env } from '../config/env.js';
import {
  isAppAuthConfigured,
  getOctokitForInstallation,
  getInstallationToken,
} from './githubAppAuth.js';

// ── Octokit factory ───────────────────────────────────────────────────────────

/**
 * Returns an Octokit instance authenticated for the correct auth mode.
 *
 * - App mode:  installationId provided + App credentials configured → installation token.
 * - PAT mode:  fallback — uses env.GITHUB_TOKEN.
 *
 * @param installationId - Optional installation ID from the webhook payload.
 */
async function getOctokit(installationId?: number): Promise<Octokit> {
  if (installationId !== undefined && isAppAuthConfigured()) {
    console.log(`[GITHUB] Auth mode: GitHub App (installationId=${installationId})`);
    return getOctokitForInstallation(installationId);
  }
  console.log(`[GITHUB] Auth mode: PAT`);
  return new Octokit({ auth: env.GITHUB_TOKEN });
}

/**
 * Resolves the authentication token string to embed in HTTPS git URLs.
 *
 * - App mode:  returns "x-access-token:<ghs_token>" (required format for App tokens).
 * - PAT mode:  returns the raw PAT (used directly as the URL username/password).
 *
 * @param installationId - Optional installation ID from the webhook payload.
 */
async function resolveGitAuthToken(
  installationId?: number
): Promise<{ token: string; scheme: 'app' | 'pat' }> {
  if (installationId !== undefined && isAppAuthConfigured()) {
    const token = await getInstallationToken(installationId);
    return { token, scheme: 'app' };
  }
  return { token: env.GITHUB_TOKEN, scheme: 'pat' };
}

// ── buildAuthenticatedCloneUrl ─────────────────────────────────────────────────

/**
 * Injects credentials into a GitHub HTTPS clone URL.
 *
 * PAT scheme:   https://<PAT>@github.com/<owner>/<repo>.git
 * App scheme:   https://x-access-token:<ghs_token>@github.com/<owner>/<repo>.git
 *
 * The "x-access-token" username is the GitHub-documented convention for
 * embedding installation tokens in HTTPS URLs. Using a bare token (the PAT
 * approach) does NOT work for App installation tokens.
 */
function buildAuthenticatedCloneUrl(
  cloneUrl: string,
  token: string,
  scheme: 'app' | 'pat'
): string {
  const credential = scheme === 'app' ? `x-access-token:${token}` : token;

  if (!cloneUrl.startsWith('http')) {
    // bare "owner/repo" style — construct full URL
    return `https://${credential}@github.com/${cloneUrl}.git`;
  }
  if (cloneUrl.startsWith('https://github.com/')) {
    return cloneUrl.replace('https://github.com/', `https://${credential}@github.com/`);
  }
  // Other HTTPS URL (e.g., GitHub Enterprise) — inject before the host
  return cloneUrl.replace('https://', `https://${credential}@`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Clones a repository's specific branch to a local directory.
 * Injects the appropriate auth token (PAT or App installation token) into the
 * HTTPS clone URL using the correct scheme for each auth mode.
 *
 * @param cloneUrl       - HTTPS clone URL or "owner/repo"
 * @param branch         - The branch to clone
 * @param localPath      - The local directory path to clone into
 * @param installationId - Optional App installation ID (from webhook payload)
 */
export async function cloneRepository(
  cloneUrl: string,
  branch: string,
  localPath: string,
  installationId?: number
): Promise<void> {
  const git: SimpleGit = simpleGit();

  let authUrl = cloneUrl;

  // Only inject credentials for real GitHub HTTPS URLs — skip file:// local repos.
  if (!cloneUrl.startsWith('file://')) {
    const { token, scheme } = await resolveGitAuthToken(installationId);
    authUrl = buildAuthenticatedCloneUrl(cloneUrl, token, scheme);
  }

  // simple-git clone will refuse to clone into a non-empty directory.
  // mkdtempSync creates the directory, so we remove it first to let git recreate it cleanly.
  const { existsSync, rmSync } = await import('fs');
  if (existsSync(localPath)) {
    rmSync(localPath, { recursive: true, force: true });
  }

  console.log(`[GIT] Cloning ${cloneUrl} (branch: ${branch}) to ${localPath}...`);
  await git.clone(authUrl, localPath, ['--branch', branch, '--single-branch', '--depth', '1']);
  console.log(`[GIT] Clone successful.`);
}

/**
 * Stages all changes, commits them (with a fallback signature note), and pushes to origin.
 *
 * @param localPath      - The local repository path
 * @param commitMessage  - The commit message
 * @param installationId - Optional App installation ID (unused here — auth is embedded
 *                         in the clone URL at clone time, which sets the remote origin)
 */
export async function pushSignedCommit(
  localPath: string,
  commitMessage: string,
  installationId?: number // reserved for future use; remote auth set at clone time
): Promise<void> {
  const git: SimpleGit = simpleGit(localPath);

  // Ensure git identity is set — required in CI / fresh clones where no global config exists.
  await git.addConfig('user.email', 'bot@gitsuture.ai');
  await git.addConfig('user.name', 'GitSuture Bot');

  // Note: True cryptographic signing requires GPG/SSH keys configured in the local
  // Git environment. As per the spec, if keys are missing, we gracefully fall back
  // to a standard commit but include a "Signed-off-by" trailer.
  const fullMessage = `${commitMessage}\n\nSigned-off-by: GitSuture AI <bot@gitsuture.ai>`;

  console.log(`[GIT] Staging changes in ${localPath}...`);
  await git.add('.');

  console.log(`[GIT] Committing changes...`);
  try {
    await git.commit(fullMessage);
  } catch (err) {
    console.error(`[GIT] Commit failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  console.log(`[GIT] Pushing to origin...`);
  try {
    await git.push('origin', 'HEAD');
    console.log(`[GIT] Push successful.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[GIT] Push to origin failed: ${msg}`);
    console.error(`[GIT] Patch is committed locally in ${localPath}.`);
    throw new Error(`Git push failed: ${msg}`);
  }

  void installationId;
}

/**
 * Gets the current remote head SHA for a Pull Request.
 * Used for stale-head verification before pushing.
 *
 * @param repoFullName   - "owner/repo"
 * @param prNumber       - PR number
 * @param installationId - Optional App installation ID; selects auth mode
 */
export async function getRemoteHeadSha(
  repoFullName: string,
  prNumber: number,
  installationId?: number
): Promise<string | null> {
  if (repoFullName === 'local/demo-target') {
    return null; // Mock implementation for local testing
  }

  const [owner, repo] = repoFullName.split('/');
  const octokit = await getOctokit(installationId);

  try {
    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data.head.sha;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[GITHUB] Failed to get remote head SHA for PR #${prNumber}: ${msg}`);
    throw new Error(`Failed to verify remote head for PR #${prNumber}: ${msg}`);
  }
}

/**
 * Posts a diagnostic markdown comment to the GitHub Pull Request.
 *
 * @param repoFullName   - "owner/repo"
 * @param prNumber       - PR number
 * @param commentBody    - The markdown comment text
 * @param installationId - Optional App installation ID; selects auth mode
 */
export async function postDiagnosticComment(
  repoFullName: string,
  prNumber: number,
  commentBody: string,
  installationId?: number
): Promise<void> {
  if (repoFullName === 'local/demo-target') {
    console.log(`[GITHUB] MOCK postDiagnosticComment for ${repoFullName}#${prNumber}:`);
    console.log(commentBody);
    return;
  }

  const [owner, repo] = repoFullName.split('/');
  const octokit = await getOctokit(installationId);

  console.log(
    `[GITHUB] Posting diagnostic comment to ${repoFullName}#${prNumber}` +
      (installationId ? ` (App installationId=${installationId})` : ' (PAT)') +
      '...'
  );

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: commentBody,
  });

  console.log(`[GITHUB] Comment posted successfully.`);
}
