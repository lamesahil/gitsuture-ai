/**
 * tests/health.test.ts
 *
 * Tests for GET /api/health
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';

// Set a test webhook secret before importing the app so env.ts doesn't throw.
process.env['GITHUB_WEBHOOK_SECRET'] = 'test-webhook-secret-for-health-tests';
process.env['GEMINI_API_KEY'] = 'test-gemini-key';
process.env['PORT'] = '0';

// Dynamically import app after env is configured.
const { app } = await import('../src/index.js');

let server: Server;

beforeAll(() => {
  server = app.listen(0); // random available port
});

afterAll(() => {
  server.close();
});

describe('GET /api/health', () => {
  it('returns 200 with correct shape', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'gitsuture',
    });
  });

  it('includes a version and timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('returns JSON content-type', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/unknown-route', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
