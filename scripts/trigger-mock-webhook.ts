/**
 * scripts/trigger-mock-webhook.ts
 * 
 * LOCAL TESTING ONLY: This script simulates a GitHub webhook event
 * to trigger the local orchestrator pipeline for end-to-end testing.
 * Do not use in production.
 */
import crypto from 'crypto';
import 'dotenv/config';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error("Missing GITHUB_WEBHOOK_SECRET in environment");
  process.exit(1);
}

// Use environment variables for local testing payload, with safe generic defaults
const TARGET_REPO_URL = process.env.TARGET_REPO_URL || "file:///path/to/local/repo";
const TARGET_BRANCH = process.env.TARGET_BRANCH || "feature/fix-bug";
const TARGET_FULL_NAME = process.env.TARGET_FULL_NAME || "local/demo-repo";

const payload = {
  action: "opened",
  number: 1,
  pull_request: {
    number: 1,
    head: {
      ref: TARGET_BRANCH,
      sha: "0000000000000000000000000000000000000000"
    }
  },
  repository: {
    full_name: TARGET_FULL_NAME,
    clone_url: TARGET_REPO_URL
  },
  sender: {
    login: "demo-user"
  }
};

const payloadString = JSON.stringify(payload);

const signature = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(payloadString)
  .digest('hex');

const signatureHeader = `sha256=${signature}`;

async function triggerWebhook() {
  try {
    const res = await fetch('http://localhost:3001/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'pull_request',
        'x-github-delivery': 'mock-delivery-id-1234',
        'x-hub-signature-256': signatureHeader
      },
      body: payloadString
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to trigger webhook: ${res.status} ${res.statusText}`);
      console.error(errorText);
      process.exit(1);
    }

    const data = await res.json();
    console.log("Webhook triggered successfully:", data);
  } catch (err) {
    console.error("Error triggering webhook:", err);
    process.exit(1);
  }
}

triggerWebhook();
