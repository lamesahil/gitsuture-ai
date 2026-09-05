/**
 * src/index.ts
 *
 * GitSuture Backend — Server Entry Point.
 *
 * Middleware registration order (critical for webhook signature verification):
 *   1. express.json() with `verify` callback — captures raw Buffer onto
 *      req.rawBody while ALSO parsing the body into req.body as usual.
 *   2. Route mounts — api, webhooks
 *   3. Error handler — centralized async-safe error handling
 *
 * Using the `verify` callback on express.json() is the correct pattern:
 * it gives us the raw bytes for HMAC verification without blocking JSON
 * parsing for any route.
 */

import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRouter } from './server/routes/api.js';
import { webhooksRouter } from './server/routes/webhooks.js';

const app = express();

app.use(cors());

// ── Middleware: JSON Parser with Raw Body Capture ─────────────────────────────
//
// The `verify` callback fires BEFORE the body is parsed, giving us the original
// raw bytes. We attach them as req.rawBody for HMAC-SHA256 signature verification
// on webhook routes, while req.body still receives the parsed JSON object.

app.use(
  express.json({
    limit: '10mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      req.rawBody = buf;
    },
  })
);

// Also handle non-JSON (e.g. application/x-www-form-urlencoded) with raw capture.
app.use(
  express.raw({
    type: (req) => {
      const ct = req.headers['content-type'] ?? '';
      // Only capture raw for non-JSON content types (JSON is handled above).
      return !ct.includes('application/json');
    },
    limit: '10mb',
    verify: (req: Request, _res: Response, buf: Buffer) => {
      if (!req.rawBody) req.rawBody = buf;
    },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);
app.use('/api/webhooks', webhooksRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// ── Centralized Error Handler ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[ERROR] ${err.message}`, err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message:
      env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log(
    `[SERVER_STARTED] GitSuture backend listening on port ${env.PORT} (${env.NODE_ENV})`
  );
  console.log(`[SERVER_STARTED] Health: http://localhost:${env.PORT}/api/health`);
});

export { app };
