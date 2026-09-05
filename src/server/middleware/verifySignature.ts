/**
 * src/server/middleware/verifySignature.ts
 *
 * GitHub Webhook Signature Verification Middleware.
 *
 * Implements deterministic HMAC-SHA256 validation of the x-hub-signature-256
 * header sent by GitHub on every webhook delivery. Uses Node's built-in
 * `crypto.timingSafeEqual` to prevent timing-attack-based secret disclosure.
 *
 * Security properties:
 *   ✓  Uses HMAC-SHA256 (matching GitHub's signing algorithm)
 *   ✓  Timing-safe comparison (crypto.timingSafeEqual)
 *   ✓  Rejects missing signatures with 401
 *   ✓  Rejects invalid signatures with 401
 *   ✓  Never logs the webhook secret
 *   ✓  Never logs signature values
 *   ✓  Requires raw body buffer (registered before JSON parser)
 *
 * IMPORTANT: This middleware must be applied to webhook routes BEFORE the
 * Express JSON body parser so that the raw request body is accessible via
 * req.rawBody (attached by the rawBodyCapture middleware in index.ts).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env.js';

// Extend Express Request to include the raw body buffer.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const SIGNATURE_HEADER = 'x-hub-signature-256';
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Express middleware that validates the GitHub x-hub-signature-256 header.
 * Must run after rawBodyCapture middleware and before route handlers.
 */
export function verifyGitHubSignature(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const signatureHeader = req.headers[SIGNATURE_HEADER];

  // ── 1. Reject missing signature ──────────────────────────────────────────
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    console.warn(
      `[WEBHOOK_AUTH] Rejected: missing ${SIGNATURE_HEADER} header. ` +
        `ip=${req.ip ?? 'unknown'}`
    );
    res.status(401).json({
      error: 'Unauthorized',
      message: `Missing ${SIGNATURE_HEADER} header`,
    });
    return;
  }

  // ── 2. Reject malformed prefix ───────────────────────────────────────────
  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    console.warn(
      `[WEBHOOK_AUTH] Rejected: malformed signature prefix. ` +
        `ip=${req.ip ?? 'unknown'}`
    );
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Malformed signature format',
    });
    return;
  }

  // ── 3. Require raw body ──────────────────────────────────────────────────
  if (!req.rawBody) {
    console.error(
      '[WEBHOOK_AUTH] Raw body unavailable — rawBodyCapture middleware may not be registered.'
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Raw body unavailable for signature verification',
    });
    return;
  }

  // ── 4. Compute expected HMAC-SHA256 ──────────────────────────────────────
  const expectedHex = createHmac('sha256', env.GITHUB_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const expectedSignature = `${SIGNATURE_PREFIX}${expectedHex}`;
  const receivedSignature = signatureHeader;

  // ── 5. Timing-safe comparison ─────────────────────────────────────────────
  let isValid = false;
  try {
    // Both buffers must be the same length for timingSafeEqual.
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(receivedSignature, 'utf8');

    if (expectedBuf.length === receivedBuf.length) {
      isValid = timingSafeEqual(expectedBuf, receivedBuf);
    }
    // If lengths differ, isValid remains false (also timing-safe: no early return).
  } catch {
    isValid = false;
  }

  if (!isValid) {
    console.warn(
      `[WEBHOOK_AUTH] Rejected: invalid signature. ip=${req.ip ?? 'unknown'}`
    );
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
    return;
  }

  // ── 6. Signature valid ───────────────────────────────────────────────────
  console.log(
    `[WEBHOOK_AUTHENTICATED] Signature valid. ip=${req.ip ?? 'unknown'}`
  );
  next();
}
