import 'dotenv/config';
import { cloneRepository, pushSignedCommit, postDiagnosticComment } from '../src/git/octokit.js';
import * as fs from 'fs';
import * as path from 'path';
import { simpleGit } from 'simple-git';

// Utility for formatting output
const log = (msg: string) => console.log(`  ℹ️  ${msg}`);
const pass = (msg: string) => console.log(`  ✅ PASS  ${msg}`);
const fail = (msg: string) => console.log(`  ❌ FAIL  ${msg}`);
const section = (title: string) => console.log(`\n────────────────────────────────────────────────────────────\n  ${title}\n────────────────────────────────────────────────────────────`);

async function run() {
  section('Day 5-6: E2E Git Operations with GitHub App Authentication');

  const appId = process.env.GITHUB_APP_ID;
  const installationIdStr = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKeyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  const testRepo = process.env.GITHUB_APP_TEST_REPO;

  if (!appId || !installationIdStr || !privateKeyPath || !testRepo) {
    fail('Missing required environment variables (GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY_PATH, GITHUB_APP_TEST_REPO)');
    process.exit(1);
  }

  const installationId = parseInt(installationIdStr, 10);
  const cloneUrl = `https://github.com/${testRepo}.git`;
  const branchName = `test/github-app-e2e-${Date.now()}`;
  const localPath = path.resolve(process.cwd(), 'tmp-e2e-test');

  try {
    section('1. Clone Repository');
    log(`Cloning ${cloneUrl} (branch: main) into ${localPath}`);
    // We clone main first, then we'll checkout a new branch locally
    await cloneRepository(cloneUrl, 'main', localPath, installationId);
    pass('Repository cloned successfully using App token credentials');

    section('2. Create Branch & Make Change');
    const git = simpleGit(localPath);
    log(`Checking out new branch: ${branchName}`);
    await git.checkoutLocalBranch(branchName);
    
    const markerFile = path.join(localPath, 'e2e-marker.txt');
    log(`Creating marker file: ${markerFile}`);
    fs.writeFileSync(markerFile, `E2E Test Run: ${new Date().toISOString()}\nAuthenticated via GitHub App Installation Token.\n`);
    pass('Branch created and marker file written');

    section('3. Commit and Push');
    log('Committing changes...');
    await pushSignedCommit(localPath, `test: github app e2e verification ${Date.now()}`, installationId);
    pass('Commit signed, created, and pushed to remote origin');

    section('4. PR Comment Verification');
    const prNumber = 1; // Assuming PR #1 exists on lamesahil/gitsuture-demo-crossfile
    log(`Posting diagnostic comment to ${testRepo}#${prNumber}...`);
    await postDiagnosticComment(
      testRepo,
      prNumber,
      `GitSuture GitHub App E2E authentication test — installation token successfully authenticated. Commit pushed to branch \`${branchName}\`.`,
      installationId
    );
    pass('PR comment posted successfully via App token');

  } catch (err: any) {
    const safeMessage = (err.message || String(err)).replace(/ghs_[A-Za-z0-9]+/g, 'ghs_***');
    fail(`E2E Test Failed: ${safeMessage}`);
    if (err.stack) {
      const safeStack = err.stack.replace(/ghs_[A-Za-z0-9]+/g, 'ghs_***');
      console.error(safeStack.split('\n').map((l: string) => `    ${l}`).join('\n'));
    }
  } finally {
    // Cleanup
    if (fs.existsSync(localPath)) {
      log(`Cleaning up local clone at ${localPath}`);
      fs.rmSync(localPath, { recursive: true, force: true });
    }
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
