import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTestsInSandbox, buildContainerConfig, SANDBOX_DEFAULTS } from '../src/agents/agent1_tester.js';
import { isDaemonAvailable } from '../src/sandbox/docker.js';
import path from 'path';
import fs from 'fs';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn((p) => p === '/dummy/path' || actual.existsSync(p)),
  };
});

// --- Unit Tests (Mocked Docker) ---

describe('Agent 1 Tester - Unit Tests (Mocked)', () => {
  let mockContainer: any;
  let mockDockerClient: any;
  let mockWait: any;
  let mockKill: any;
  let mockRemove: any;

  beforeEach(() => {
    mockKill = vi.fn().mockResolvedValue(undefined);
    mockRemove = vi.fn().mockResolvedValue(undefined);
    mockWait = vi.fn().mockResolvedValue({ StatusCode: 0 });

    mockContainer = {
      id: 'mock-container-123',
      start: vi.fn().mockResolvedValue(undefined),
      logs: vi.fn((opts, cb) => {
        // Simulate an empty log stream immediately
        const EventEmitter = require('events');
        const stream = new EventEmitter();
        cb(null, stream);
        setTimeout(() => stream.emit('end'), 10);
      }),
      wait: mockWait,
      kill: mockKill,
      remove: mockRemove,
    };

    mockDockerClient = {
      createContainer: vi.fn().mockResolvedValue(mockContainer),
      modem: {
        demuxStream: vi.fn(),
      },
    };
  });

  it('should build container config with critical security limits', () => {
    const config = buildContainerConfig('/dummy/path');
    
    expect(config.HostConfig?.Memory).toBe(SANDBOX_DEFAULTS.memoryBytes);
    expect(config.HostConfig?.NanoCpus).toBe(SANDBOX_DEFAULTS.nanoCpus);
    expect(config.NetworkDisabled).toBe(true);
    expect(config.HostConfig?.NetworkMode).toBe('none');
    expect(config.HostConfig?.Binds).toContain('/dummy/path:/workspace:ro');
    expect(config.HostConfig?.AutoRemove).toBe(false);
  });

  it('should return success when exit code is 0', async () => {
    const result = await runTestsInSandbox('/dummy/path', {}, mockDockerClient as any);
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    expect(mockContainer.kill).not.toHaveBeenCalled();
  });

  it('should return failure when exit code is non-zero', async () => {
    mockWait.mockResolvedValueOnce({ StatusCode: 1 });
    
    const result = await runTestsInSandbox('/dummy/path', {}, mockDockerClient as any);
    
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });

  it('should timeout, kill, and remove container after timeoutMs', async () => {
    // Make wait hang indefinitely
    mockWait.mockImplementation(() => new Promise(() => {}));
    
    const result = await runTestsInSandbox('/dummy/path', { timeoutMs: 50 }, mockDockerClient as any);
    
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(137); // SIGKILL code
    expect(mockContainer.kill).toHaveBeenCalledWith({ Signal: 'SIGKILL' });
    expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
  });
  
  it('should throw if repo path does not exist', async () => {
     await expect(runTestsInSandbox('/does/not/exist/anywhere', {}, mockDockerClient as any))
      .rejects
      .toThrow(/localRepoPath does not exist/);
  });
});

// --- Integration Tests (Real Docker) ---

describe('Agent 1 Tester - Integration Tests (Live)', async () => {
  const dockerAvailable = await isDaemonAvailable();
  
  it.skipIf(!dockerAvailable)('should run dummy-pass and capture logs', async () => {
    const repoPath = path.resolve(__dirname, 'fixtures/dummy-pass');
    
    // Use a longer timeout for the first run if image needs pulling, but we expect node:20-alpine to be fast.
    const result = await runTestsInSandbox(repoPath, { timeoutMs: 60000 });
    
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    
    // We can't strictly assert the exact stdout because npm install output is unpredictable,
    // but our script outputs this:
    expect(result.stdout).toContain('Dummy pass test output (stdout)');
    expect(result.stderr).toContain('Dummy pass test error output (stderr)');
  }, 65000);

  it.skipIf(!dockerAvailable)('should run dummy-fail and capture stack trace', async () => {
    const repoPath = path.resolve(__dirname, 'fixtures/dummy-fail');
    
    const result = await runTestsInSandbox(repoPath, { timeoutMs: 60000 });
    
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
    
    expect(result.stderr).toContain('This is a simulated test failure stack trace');
  }, 65000);
});
