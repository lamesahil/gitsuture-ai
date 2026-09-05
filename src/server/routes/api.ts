/**
 * src/server/routes/api.ts
 *
 * General REST API routes.
 *
 * Endpoints:
 *   GET /api/health  — Service liveness check
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../db/client.js';

export const apiRouter = Router();

// ── GET /api/health ───────────────────────────────────────────────────────────

/**
 * Health / liveness endpoint.
 * Returns 200 with service metadata. Used by deployment health checks
 * and the frontend status indicator (future phase).
 */
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'gitsuture',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ── GET /api/jobs ─────────────────────────────────────────────────────────────

/**
 * Returns all currently queued/running/completed jobs from Prisma.
 */
apiRouter.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await prisma.healJob.findMany({
      include: {
        pullRequest: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
    res.status(200).json(jobs);
  } catch (err) {
    console.error(`[API] GET /jobs error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── GET /api/jobs/:id ─────────────────────────────────────────────────────────

apiRouter.get('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const job = await prisma.healJob.findUnique({
      where: { id },
      include: {
        pullRequest: true,
      },
    });

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.status(200).json(job);
  } catch (err) {
    console.error(`[API] GET /jobs/:id error:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
