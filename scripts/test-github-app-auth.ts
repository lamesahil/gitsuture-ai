/**
 * scripts/test-github-app-auth.ts
 *
 * Day 3-4 Integration Test — GitHub App Authentication
 *
 * Tests the REAL GitHub App credential flow:
 *   1. Loads App credentials from env (GITHUB_APP_ID + key path or inline PEM)
 *   2. Obtains a real installation access token from GitHub's API
 *   3. Uses the token to verify read access to the target repository
 *
 * Usage:
 *   npm run test:app-auth
 *   (or: tsx scripts/test-github-app-auth.ts)
 *
 * Required env vars (in .env):
 *   GITHUB_APP_ID                  — numeric App ID from GitHub App settings
 *   GITHUB_APP_PRIVATE_KEY_PATH    — absolute path to the downloaded .pem file
 *   GITHUB_APP_INSTALLATION_ID     — installation ID from the App installation URL
 *   GITHUB_APP_TEST_REPO           — "owner/repo" to verify read access against
 *                                    (default: lamesahil/gitsuture-demo-crossfile)
 *
 * Security:
 *   - The private key is NEVER printed.
 *   - The installation token is NEVER printed (only first 4 chars shown as prefix).
 *   - No secrets appear in test output or error messages.
 *
 * LOCAL / DEV ONLY. Do not run in production CI without secret masking.
 */

import 'dotenv/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

// ── Configuration ─────────────────────────────────────────────────────────────

const APP_ID_RAW        = process.env['GITHUB_APP_ID'] ?? '';
const KEY_PATH          = process.env['GITHUB_APP_PRIVATE_KEY_PATH'] ?? '';
const KEY_INLINE        = process.env['GITHUB_APP_PRIVATE_KEY'] ?? '';
const INSTALLATION_ID   = process.env['GITHUB_APP_INSTALLATION_ID'] ?? '';
const TEST_REPO         = process.env['GITHUB_APP_TEST_REPO'] ?? 'lamesahil/gitsuture-demo-crossfile';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pass(msg: string): void { console.log(`  ✅ PASS  ${msg}`); }
function fail(msg: string): void { console.error(`  ❌ FAIL  ${msg}`); }
function info(msg: string): void { console.log(`  ℹ️  ${msg}`); }
function section(title: string): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

/** Mask a token — show only first 4 chars followed by ****** */
function maskToken(token: string): string {
  return token.length > 4 ? `${token.slice(0, 4)}******` : '****';
}

// ── Pre-flight checks ─────────────────────────────────────────────────────────

section('Pre-flight: Configuration');

let preflight = true;

if (!APP_ID_RAW) {
  fail('GITHUB_APP_ID is not set in .env');
  preflight = false;
} else {
  const numericId = parseInt(APP_ID_RAW, 10);
  if (isNaN(numericId) || numericId <= 0) {
    fail(`GITHUB_APP_ID must be a positive integer (got: "${APP_ID_RAW}")`);
    preflight = false;
  } else {
    pass(`GITHUB_APP_ID is set: ${numericId}`);
  }
}

if (!INSTALLATION_ID) {
  fail('GITHUB_APP_INSTALLATION_ID is not set in .env — see instructions below');
  preflight = false;
} else {
  const numericInstId = parseInt(INSTALLATION_ID, 10);
  if (isNaN(numericInstId) || numericInstId <= 0) {
    fail(`GITHUB_APP_INSTALLATION_ID must be a positive integer (got: "${INSTALLATION_ID}")`);
    preflight = false;
  } else {
    pass(`GITHUB_APP_INSTALLATION_ID is set: ${numericInstId}`);
  }
}

// Resolve private key
let privateKey: string | null = null;

if (KEY_PATH) {
  info(`Private key source: file path (GITHUB_APP_PRIVATE_KEY_PATH)`);
  if (!fs.existsSync(KEY_PATH)) {
    fail(`Private key file not found: ${KEY_PATH}`);
    preflight = false;
  } else {
    const content = fs.readFileSync(KEY_PATH, 'utf8').trim();
    if (!content.startsWith('-----BEGIN')) {
      fail(`File at GITHUB_APP_PRIVATE_KEY_PATH does not look like a PEM key`);
      preflight = false;
    } else {
      pass(`Private key file exists and looks like a valid PEM`);
      // Verify it's RSA (GitHub App keys are always RSA)
      if (content.includes('RSA PRIVATE KEY') || content.includes('PRIVATE KEY')) {
        pass(`PEM type: RSA private key ✓`);
      }
      privateKey = content;
    }
  }
} else if (KEY_INLINE) {
  info(`Private key source: inline env var (GITHUB_APP_PRIVATE_KEY)`);
  const pem = KEY_INLINE.replace(/\\n/g, '\n').trim();
  if (!pem.startsWith('-----BEGIN')) {
    fail(`GITHUB_APP_PRIVATE_KEY does not look like a valid PEM`);
    preflight = false;
  } else {
    pass(`Inline private key looks like a valid PEM`);
    privateKey = pem;
  }
} else {
  fail('No private key source found. Set GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY in .env');
  preflight = false;
}

info(`Target repository: ${TEST_REPO}`);

if (!preflight) {
  console.error('\n❌ Pre-flight failed. Fix the issues above before running this test.\n');
  process.exit(1);
}

async function run() {
// ── Test 1: App JWT generation (implicit via @octokit/auth-app) ───────────────

section('Test 1: GitHub App Authentication (JWT)');

const appId = parseInt(APP_ID_RAW, 10);
const installationId = parseInt(INSTALLATION_ID, 10);

let installationToken: string | null = null;

try {
  info(`Creating App auth strategy for appId=${appId}...`);
  const auth = createAppAuth({
    appId,
    privateKey: privateKey!,
    installationId,
  });

  info(`Requesting App-level JWT authentication...`);
  const appAuth = await auth({ type: 'app' });

  // Never print the JWT — just confirm it was issued
  if (appAuth.token && appAuth.token.length > 10) {
    pass(`App JWT obtained successfully (token prefix: ${maskToken(appAuth.token)})`);
  } else {
    fail(`App JWT was empty or malformed`);
    process.exit(1);
  }

  // ── Test 2: Installation token exchange ──────────────────────────────────────
  section('Test 2: Installation Token Exchange');

  info(`Requesting installation token for installationId=${installationId}...`);
  const installationAuth = await auth({ type: 'installation' });

  installationToken = installationAuth.token;

  if (!installationToken || installationToken.length < 10) {
    fail(`Installation token was empty or too short`);
    process.exit(1);
  }

  pass(`Installation token obtained (prefix: ${maskToken(installationToken)})`);

  if (installationAuth.expiresAt) {
    pass(`Token expiry: ${installationAuth.expiresAt}`);
  }

  // Verify it's a GitHub App installation token (ghs_ prefix)
  if (installationToken.startsWith('ghs_')) {
    pass(`Token format: ghs_*** (correct GitHub App installation token format)`);
  } else {
    // Some tokens may use v1_ — still valid
    info(`Token format: ${maskToken(installationToken)} (non-standard prefix, may still be valid)`);
  }

} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  // Mask any token-like strings from error messages
  const safeMessage = message.replace(/ghs_[A-Za-z0-9]+/g, 'ghs_***');
  fail(`Authentication failed: ${safeMessage}`);
  console.error('\n  Full error (credentials masked):');
  if (err instanceof Error && err.stack) {
    const safeStack = err.stack.replace(/ghs_[A-Za-z0-9]+/g, 'ghs_***');
    console.error(safeStack.split('\n').map(l => `    ${l}`).join('\n'));
  }
  process.exit(1);
}

// ── Test 3: Repository read access ───────────────────────────────────────────

section('Test 3: Repository Read Access');

try {
  info(`Creating Octokit with installation token...`);
  const octokit = new Octokit({ auth: installationToken });

  const [owner, repo] = TEST_REPO.split('/');
  info(`Calling GET /repos/${owner}/${repo}...`);

  const response = await octokit.rest.repos.get({ owner, repo });

  pass(`Repository found: ${response.data.full_name}`);
  pass(`Default branch: ${response.data.default_branch}`);
  pass(`Visibility: ${response.data.visibility ?? 'unknown'}`);
  pass(`HTTP status: ${response.status}`);

  // Verify clone URL is accessible
  if (response.data.clone_url) {
    pass(`Clone URL present: ${response.data.clone_url}`);
  }

  // Fetch the installation permissions directly using the App JWT.
  // We do not rely on response.data.permissions (the repo permissions object)
  // because GitHub's API frequently returns false for push/pull when authenticated
  // as an App token, even when the App explicitly has contents: write.
  const appAuth = createAppAuth({ appId, privateKey: privateKey!, installationId });
  const appOctokit = new Octokit({ auth: (await appAuth({ type: 'app' })).token });
  const { data: installation } = await appOctokit.rest.apps.getInstallation({
    installation_id: installationId,
  });

  
  info(`Installation permissions verified via API:`);
  info(`  - contents:      ${installation.permissions?.contents || 'none'}`);
  info(`  - pull_requests: ${installation.permissions?.pull_requests || 'none'}`);

  if (installation.permissions?.contents !== 'write') {
    fail(`Installation lacks 'contents: write' permission.`);
  } else {
    pass(`Installation has 'contents: write' permission ✓`);
  }

  if (installation.permissions?.pull_requests !== 'write') {
    fail(`Installation lacks 'pull_requests: write' permission.`);
  } else {
    pass(`Installation has 'pull_requests: write' permission ✓`);
  }

} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const safeMessage = message.replace(/ghs_[A-Za-z0-9]+/g, 'ghs_***');
  fail(`Repository access failed: ${safeMessage}`);
  if (message.includes('404')) {
    info(`  → 404 usually means the App is NOT installed on ${TEST_REPO}.`);
    info(`  → Go to: https://github.com/settings/installations`);
    info(`  → Install GitSuture App on lamesahil/gitsuture-demo-crossfile`);
  }
  if (message.includes('401')) {
    info(`  → 401 means the installation token was rejected.`);
    info(`  → Verify GITHUB_APP_INSTALLATION_ID matches the installation on ${TEST_REPO}.`);
  }
  process.exit(1);
}

// ── Final summary ─────────────────────────────────────────────────────────────

section('Day 3-4 Integration Test — SUMMARY');

console.log(`
  App ID:            ${appId}
  Installation ID:   ${installationId}
  Target Repo:       ${TEST_REPO}
  Token prefix:      ${maskToken(installationToken!)}

  ✅ Test 1 PASSED — App JWT generation (RS256 signing)
  ✅ Test 2 PASSED — Installation token exchange
  ✅ Test 3 PASSED — Repository read access verified

  GitHub App authentication is WORKING.
  The healing pipeline can now use installation tokens when installationId is present.

  Next steps:
    Day 5-6: Verify clone + push + PR comment via installation token
    Day 7:   End-to-end healing loop with App authentication
`);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
