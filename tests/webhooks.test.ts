/**
 * tests/webhooks.test.ts
 *
 * Tests for POST /api/webhooks/github
 *
 * Covers:
 *   1. Valid webhook signature accepted (200)
 *   2. Invalid signature rejected (401)
 *   3. Missing signature rejected (401)
 *   4. Supported pull_request.opened event normalized correctly (200 + JobAck)
 *   5. Supported pull_request.synchronize event normalized correctly (200 + JobAck)
 *   6. Unsupported event type handled correctly (422)
 *   7. Unsupported pull_request action handled correctly (422)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createHmac } from 'crypto';
import type { Server } from 'http';

// ── Test constants ────────────────────────────────────────────────────────────

const TEST_SECRET = 'super-secret-test-key-for-webhooks';

// Set a test webhook secret before importing the app so env.ts doesn't throw.
process.env['GITHUB_WEBHOOK_SECRET'] = TEST_SECRET;
process.env['GEMINI_API_KEY'] = 'test-gemini-key';
process.env['PORT'] = '0';
process.env['NODE_ENV'] = 'test';

const { app } = await import('../src/index.js');

let server: Server;

beforeAll(() => {
  server = app.listen(0);
});

afterAll(() => {
  server.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute a valid x-hub-signature-256 for a payload string. */
function sign(body: string): string {
  const hmac = createHmac('sha256', TEST_SECRET).update(body).digest('hex');
  return `sha256=${hmac}`;
}

/** Minimal valid GitHub pull_request payload. */
function makePRPayload(action: string = 'opened'): object {
  return {
    action,
    number: 42,
    pull_request: {
      number: 42,
      head: {
        ref: 'feature/add-tests',
        sha: 'abc1234def5678901234567890123456789012345',
      },
    },
    repository: {
      full_name: 'octocat/hello-world',
      clone_url: 'https://github.com/octocat/hello-world.git',
    },
    sender: {
      login: 'octocat',
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/github — Signature Verification', () => {
  it('3. rejects missing x-hub-signature-256 with 401', async () => {
    const body = JSON.stringify(makePRPayload());

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
    expect(res.body.message).toMatch(/missing/i);
  });

  it('2. rejects invalid x-hub-signature-256 with 401', async () => {
    const body = JSON.stringify(makePRPayload());

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', 'sha256=deadbeefdeadbeefdeadbeefdeadbeef')
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Unauthorized');
    expect(res.body.message).toMatch(/invalid/i);
  });

  it('1. accepts a valid x-hub-signature-256 (pull_request.opened)', async () => {
    const body = JSON.stringify(makePRPayload('opened'));

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    // Signature is valid — expect orchestrator ack, not auth rejection.
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobId');
    expect(res.body).toHaveProperty('status', 'QUEUED');
  });
});

describe('POST /api/webhooks/github — Event Normalization', () => {
  it('4. normalizes pull_request.opened event and returns JobAck', async () => {
    const payload = makePRPayload('opened');
    const body = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'QUEUED',
      message: expect.stringContaining('Healing job queued'),
    });
    expect(typeof res.body.jobId).toBe('string');
    expect(res.body.jobId.length).toBeGreaterThan(0);
  });

  it('5. normalizes pull_request.synchronize event and returns JobAck', async () => {
    const payload = makePRPayload('synchronize');
    const body = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'QUEUED',
    });
    expect(typeof res.body.jobId).toBe('string');
  });

  it('6a. returns 422 for unsupported event type (push)', async () => {
    const body = JSON.stringify({ ref: 'refs/heads/main', commits: [] });

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/push/);
  });

  it('6b. returns 422 for unsupported pull_request action (closed)', async () => {
    const payload = makePRPayload('closed');
    const body = JSON.stringify(payload);

    const res = await request(app)
      .post('/api/webhooks/github')
      .set('Content-Type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-hub-signature-256', sign(body))
      .send(body);

    expect(res.status).toBe(422);
    // The response message includes the unsupported action name.
    expect(res.body.message).toMatch(/not supported/i);
  });
});
