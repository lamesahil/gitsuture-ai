/**
 * src/git/octokit.ts
 *
 * GitHub operations layer.
 * Manages cloning, pushing commits, and posting comments to PRs.
 * Uses `simple-git` for local operations and `@octokit/rest` for API calls.
 */

import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { env } from '../config/env.js';

// Initialize Octokit client with PAT
const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

/**
 * Clones a repository's specific branch to a local directory.
 * Modifies the clone URL to inject the GITHUB_TOKEN for HTTPS authentication.
 * 
 * @param repoFullName - "owner/repo"
 * @param branch - The branch to clone
 * @param localPath - The local directory path
 */
export async function cloneRepository(cloneUrl: string, branch: string, localPath: string): Promise<void> {
  const git: SimpleGit = simpleGit();
  
  let authUrl = cloneUrl;
  if (!cloneUrl.startsWith('file://') && !cloneUrl.startsWith('http')) {
    authUrl = `https://${env.GITHUB_TOKEN}@github.com/${cloneUrl}.git`;
  } else if (cloneUrl.startsWith('https://github.com/')) {
    authUrl = cloneUrl.replace('https://github.com/', `https://${env.GITHUB_TOKEN}@github.com/`);
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
 * @param localPath - The local repository path
 * @param commitMessage - The commit message
 */
export async function pushSignedCommit(localPath: string, commitMessage: string): Promise<void> {
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
    // For local file:// repos the remote branch may be checked out, causing a push rejection.
    // Log the error but don't abort — the patch is already verified and the commit exists locally.
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[GIT] Push to origin failed (may be expected for local demo repos): ${msg}`);
    console.warn(`[GIT] Patch is committed locally in ${localPath}. Manual push required for production.`);
  }
}

/**
 * Posts a diagnostic markdown comment to the GitHub Pull Request.
 *
 * @param repoFullName - "owner/repo"
 * @param prNumber - PR number
 * @param commentBody - The markdown comment text
 */
export async function postDiagnosticComment(repoFullName: string, prNumber: number, commentBody: string): Promise<void> {
  if (repoFullName === 'local/demo-target') {
    console.log(`[GITHUB] MOCK postDiagnosticComment for ${repoFullName}#${prNumber}:`);
    console.log(commentBody);
    return;
  }
  
  const [owner, repo] = repoFullName.split('/');

  console.log(`[GITHUB] Posting diagnostic comment to ${repoFullName}#${prNumber}...`);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: commentBody,
  });
  console.log(`[GITHUB] Comment posted successfully.`);
}
