import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiRouter } from '../src/server/routes/api.js';
import { prisma } from '../src/db/client.js';

vi.mock('../src/db/client.js', () => ({
  prisma: {
    healJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const app = express();
app.use('/api', apiRouter);

describe('API Routes - Jobs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GET /api/jobs should return list of jobs from Prisma', async () => {
    const mockJobs = [
      { id: '1', status: 'RESOLVED', pullRequest: { repoFullName: 'foo/bar' } },
      { id: '2', status: 'QUEUED' }
    ];
    (prisma.healJob.findMany as any).mockResolvedValue(mockJobs);

    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockJobs);
    expect(prisma.healJob.findMany).toHaveBeenCalled();
  });

  it('GET /api/jobs/:id should return a specific job', async () => {
    const mockJob = { id: 'job-123', status: 'FAILED', initialError: 'Syntax error' };
    (prisma.healJob.findUnique as any).mockResolvedValue(mockJob);

    const res = await request(app).get('/api/jobs/job-123');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockJob);
    expect(prisma.healJob.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'job-123' },
    }));
  });

  it('GET /api/jobs/:id should return 404 if not found', async () => {
    (prisma.healJob.findUnique as any).mockResolvedValue(null);

    const res = await request(app).get('/api/jobs/unknown-id');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Job not found' });
  });
});
