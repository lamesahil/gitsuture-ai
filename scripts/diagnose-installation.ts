import 'dotenv/config';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

async function diagnose() {
  const appId = parseInt(process.env['GITHUB_APP_ID']!, 10);
  const installationId = parseInt(process.env['GITHUB_APP_INSTALLATION_ID']!, 10);
  const keyPath = process.env['GITHUB_APP_PRIVATE_KEY_PATH']!;
  const privateKey = fs.readFileSync(keyPath, 'utf8').trim();

  console.log(`Diagnosing App ID: ${appId}, Installation ID: ${installationId}`);

  // 1. Authenticate as the App itself (JWT)
  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });

  try {
    // Fetch installation details
    const { data: installation } = await appOctokit.rest.apps.getInstallation({
      installation_id: installationId,
    });
    console.log('\n--- Installation Details ---');
    console.log(`Account: ${installation.account?.login}`);
    console.log(`Repository Selection: ${installation.repository_selection}`);
    console.log(`Permissions granted to this installation:`);
    console.log(JSON.stringify(installation.permissions, null, 2));

    // 2. Authenticate as the Installation (Installation Token)
    const auth = createAppAuth({ appId, privateKey, installationId });
    const { token } = await auth({ type: 'installation' });
    const instOctokit = new Octokit({ auth: token });

    // Fetch repositories accessible to this installation
    const { data: repos } = await instOctokit.rest.apps.listReposAccessibleToInstallation();
    console.log('\n--- Repositories accessible to this installation ---');
    console.log(`Total count: ${repos.total_count}`);
    for (const repo of repos.repositories) {
      console.log(`- ${repo.full_name}`);
      console.log(`  Permissions: ${JSON.stringify(repo.permissions)}`);
    }

  } catch (err: any) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
  }
}

diagnose().catch(console.error);
