/**
 * src/git/githubAppAuth.ts
 *
 * GitHub App Authentication Helper.
 *
 * Uses the official @octokit/auth-app package to:
 *   1. Load the App private key from disk (GITHUB_APP_PRIVATE_KEY_PATH) or
 *      from an inline PEM env var (GITHUB_APP_PRIVATE_KEY), with the path
 *      taking priority when both are set.
 *   2. Generate a short-lived App JWT for GitHub API calls.
 *   3. Exchange the JWT for a per-installation access token (valid 1 hour).
 *   4. Return a fully configured Octokit client for that installation.
 *
 * Security notes:
 *   - The private key is NEVER logged.
 *   - Installation tokens are short-lived (1 hour) and scoped to one installation.
 *   - This module only activates when GITHUB_APP_ID + a key source are present.
 *     If either is missing it throws a clear, actionable error.
 *
 * Authentication scheme for git operations:
 *   GitHub App installation tokens must use the x-access-token username scheme:
 *     https://x-access-token:<token>@github.com/<owner>/<repo>.git
 *   This is distinct from PAT auth which may use the token directly as a username.
 */

import * as fs from 'fs';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
// Note: we read App credentials directly from process.env rather than the frozen
// env singleton so that they can be set dynamically (e.g., in tests or reloaded
// configs) without requiring a server restart. Required values (GITHUB_TOKEN,
// GEMINI_API_KEY, etc.) are still validated eagerly in env.ts at startup.
import { env } from '../config/env.js';

// ── Helpers to read optional App env vars live ────────────────────────────────

const appId = () => process.env['GITHUB_APP_ID'] ?? '';
const appKeyPath = () => process.env['GITHUB_APP_PRIVATE_KEY_PATH'] ?? '';
const appKeyInline = () => process.env['GITHUB_APP_PRIVATE_KEY'] ?? '';

// ── Private key resolution ────────────────────────────────────────────────────

/**
 * Resolves the GitHub App private key PEM string.
 *
 * Priority order:
 *   1. GITHUB_APP_PRIVATE_KEY_PATH — reads the PEM from a file on disk.
 *   2. GITHUB_APP_PRIVATE_KEY      — uses the inline PEM from the env var
 *      (newlines may be encoded as literal \n which we normalise).
 *
 * @throws If neither source is configured or the file cannot be read.
 */
export function resolveAppPrivateKey(): string {
  // Path takes priority
  if (appKeyPath()) {
    const filePath = appKeyPath();
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `[GITHUB_APP] Private key file not found: ${filePath} ` +
          `(GITHUB_APP_PRIVATE_KEY_PATH is set but the file does not exist)`
      );
    }
    const pem = fs.readFileSync(filePath, 'utf8').trim();
    if (!pem.startsWith('-----BEGIN')) {
      throw new Error(
        `[GITHUB_APP] File at GITHUB_APP_PRIVATE_KEY_PATH does not look like a PEM key.`
      );
    }
    return pem;
  }

  // Inline PEM fallback
  if (appKeyInline()) {
    // GitHub private keys stored as single-line env vars often use literal \n sequences.
    // Normalise them so the crypto library receives proper newlines.
    const pem = appKeyInline().replace(/\\n/g, '\n').trim();
    if (!pem.startsWith('-----BEGIN')) {
      throw new Error(
        `[GITHUB_APP] GITHUB_APP_PRIVATE_KEY does not look like a valid PEM key. ` +
          `Ensure newlines are encoded as \\n if stored on a single line.`
      );
    }
    return pem;
  }

  throw new Error(
    `[GITHUB_APP] No private key source configured. ` +
      `Set either GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY in your environment.`
  );
}

// ── App credential validation ─────────────────────────────────────────────────

/**
 * Returns true if all required GitHub App credentials are present in the
 * environment and the system can attempt App authentication.
 * Does NOT validate the key contents or make any network calls.
 */
export function isAppAuthConfigured(): boolean {
  if (!appId()) return false;
  if (!appKeyPath() && !appKeyInline()) return false;
  return true;
}

// ── Octokit factory for a specific installation ───────────────────────────────

/**
 * Creates an Octokit client authenticated as a specific GitHub App installation.
 *
 * The @octokit/auth-app strategy handles:
 *   - App JWT generation (RS256, valid 10 minutes)
 *   - Installation token exchange via POST /app/installations/{id}/access_tokens
 *   - Automatic token refresh before expiry
 *
 * @param installationId - The numeric installation ID from the webhook payload
 *                         (`payload.installation.id`).
 * @returns An Octokit instance ready to make API calls on behalf of that installation.
 * @throws If App credentials are not configured or the token exchange fails.
 */
export async function getOctokitForInstallation(
  installationId: number
): Promise<Octokit> {
  if (!appId()) {
    throw new Error(
      `[GITHUB_APP] GITHUB_APP_ID is not set. ` +
        `Cannot create an installation-scoped Octokit client.`
    );
  }

  const privateKey = resolveAppPrivateKey();
  const numericAppId = parseInt(appId(), 10);
  if (isNaN(numericAppId) || numericAppId <= 0) {
    throw new Error(
      `[GITHUB_APP] GITHUB_APP_ID must be a positive integer. Got: "${appId()}"`
    );
  }

  console.log(
    `[GITHUB_APP] Creating installation-scoped Octokit. ` +
      `appId=${numericAppId} installationId=${installationId}`
  );

  const auth = createAppAuth({
    appId: numericAppId,
    privateKey,
    installationId,
  });

  // Pre-fetch the installation token to validate credentials eagerly.
  // This will throw with a descriptive GitHub error if the App ID, key,
  // or installation ID is wrong — better to fail here than mid-pipeline.
  const installationAuth = await auth({ type: 'installation' });

  console.log(
    `[GITHUB_APP] Installation token obtained. ` +
      `installationId=${installationId} ` +
      `expiresAt=${installationAuth.expiresAt ?? 'unknown'}`
  );

  // Return an Octokit instance using the installation token directly.
  return new Octokit({ auth: installationAuth.token });
}

/**
 * Returns the raw installation access token string for a given installation.
 * Used by cloneRepository / pushSignedCommit which need to embed the token
 * in an authenticated HTTPS URL using the x-access-token scheme.
 *
 * GitHub App installation tokens must use the x-access-token username:
 *   https://x-access-token:<token>@github.com/<owner>/<repo>.git
 *
 * @param installationId - The numeric installation ID.
 * @returns The installation access token string (format: ghs_...).
 */
export async function getInstallationToken(
  installationId: number
): Promise<string> {
  if (!appId()) {
    throw new Error(`[GITHUB_APP] GITHUB_APP_ID is not set.`);
  }

  const privateKey = resolveAppPrivateKey();
  const numericAppId = parseInt(appId(), 10);

  const auth = createAppAuth({
    appId: numericAppId,
    privateKey,
    installationId,
  });

  const installationAuth = await auth({ type: 'installation' });
  return installationAuth.token;
}
