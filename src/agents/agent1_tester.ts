/**
 * src/agents/agent1_tester.ts
 *
 * Agent 1 — TEST EXECUTOR
 *
 * Implements the Docker sandbox execution engine described in the master spec:
 *
 *   1. Accepts a local directory path (the checked-out PR code).
 *   2. Creates an isolated Docker container with strict resource limits.
 *   3. Mounts the directory read-only into /workspace.
 *   4. Executes `npm test` inside the container.
 *   5. Captures stdout and stderr (multiplexed Docker log stream → demuxed).
 *   6. Enforces a 45-second SIGKILL timeout.
 *   7. Always removes the container (finally block — no leaks).
 *   8. Returns a structured SandboxResult.
 *
 * Security constraints (applied at container creation):
 *   Memory:          512 MB   (536870912 bytes)
 *   NanoCpus:        1 core   (1000000000 nanocpus)
 *   NetworkDisabled: true     (zero network access from container)
 *   NetworkMode:     'none'   (belt-and-suspenders, no default bridge)
 *   Volume mount:    :ro      (read-only — sandbox cannot modify host files)
 *   AutoRemove:      false    (we manage removal explicitly in finally)
 *
 * Extension points for future phases:
 *   - Agent 3 (VERIFY) reuses runTestsInSandbox after applying a patch.
 *   - The optional `dockerClient` third parameter allows test injection.
 */

import Docker from 'dockerode';
import { existsSync } from 'fs';
import { PassThrough } from 'stream';
import { getDockerClient } from '../sandbox/docker.js';
import type { SandboxOptions, SandboxResult } from '../core/types.js';

// ── Public constants ──────────────────────────────────────────────────────────

export const SANDBOX_DEFAULTS = {
  image: 'node:20-alpine',
  testCommand: 'npm test',
  /** 45-second hard kill timeout. */
  timeoutMs: 45_000,
  /** 512 MB memory limit. */
  memoryBytes: 536_870_912,
  /** 1 CPU core expressed in nanocpus. */
  nanoCpus: 1_000_000_000,
} as const;

// ── Container configuration ───────────────────────────────────────────────────

/**
 * Build the Dockerode container creation options for a given repo path.
 * Exported as a pure function so the security constraints can be unit-tested
 * independently of any live Docker daemon.
 */
export function buildContainerConfig(
  localRepoPath: string,
  options: SandboxOptions = {}
): Docker.ContainerCreateOptions {
  const image = options.image ?? SANDBOX_DEFAULTS.image;
  const testCommand = options.testCommand ?? SANDBOX_DEFAULTS.testCommand;

  return {
    Image: image,
    Cmd: ['sh', '-c', testCommand],
    WorkingDir: '/workspace',
    AttachStdout: true,
    AttachStderr: true,
    // Belt-and-suspenders: disable network at the container config level too.
    NetworkDisabled: true,
    HostConfig: {
      // ── CRITICAL SECURITY LIMITS ──────────────────────────────────────────
      Memory: SANDBOX_DEFAULTS.memoryBytes,     // 512 MB hard limit
      NanoCpus: SANDBOX_DEFAULTS.nanoCpus,      // 1 CPU core
      NetworkMode: 'none',                       // No networking at host level
      // ── Volume mount ──────────────────────────────────────────────────────
      // :ro — the container can read but CANNOT write to the host directory.
      Binds: [`${localRepoPath}:/workspace:ro`],
      // We manage container removal explicitly in the finally block.
      AutoRemove: false,
    },
  };
}

// ── Log collection ────────────────────────────────────────────────────────────

/**
 * Attach to a container's log stream and collect stdout/stderr separately.
 *
 * Docker multiplexes stdout and stderr into a single stream with an 8-byte
 * header per message (byte 0 = stream type: 1=stdout, 2=stderr; bytes 4-7 =
 * payload length). `docker.modem.demuxStream` handles the parsing.
 *
 * Returns a Promise that resolves when the log stream closes (i.e., when the
 * container exits or is killed).
 */
function collectContainerLogs(
  container: Docker.Container,
  docker: Docker
): Promise<{ stdout: string; stderr: string }> {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    container.logs(
      { follow: true, stdout: true, stderr: true },
      (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err) {
          reject(err);
          return;
        }
        if (!stream) {
          resolve({ stdout: '', stderr: '' });
          return;
        }

        const stdoutBuffers: Buffer[] = [];
        const stderrBuffers: Buffer[] = [];
        const stdoutPassThrough = new PassThrough();
        const stderrPassThrough = new PassThrough();

        stdoutPassThrough.on('data', (chunk: Buffer) => stdoutBuffers.push(chunk));
        stderrPassThrough.on('data', (chunk: Buffer) => stderrBuffers.push(chunk));

        // docker.modem.demuxStream routes the multiplexed Docker log stream
        // to the appropriate stdout/stderr PassThrough streams.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (docker as any).modem.demuxStream(stream, stdoutPassThrough, stderrPassThrough);

        stream.on('end', () => {
          stdoutPassThrough.end();
          stderrPassThrough.end();
          resolve({
            stdout: Buffer.concat(stdoutBuffers).toString('utf8'),
            stderr: Buffer.concat(stderrBuffers).toString('utf8'),
          });
        });

        stream.on('error', reject);
      }
    );
  });
}

// ── Main execution function ───────────────────────────────────────────────────

/**
 * Run tests for a local repository inside an isolated Docker sandbox.
 *
 * @param localRepoPath - Absolute path to the repository directory on the host.
 * @param options       - Optional sandbox overrides (image, command, timeout).
 * @param dockerClient  - Optional Docker client injection (used by unit tests).
 *
 * @returns A structured SandboxResult with exit code, captured streams, and
 *          timing information.
 *
 * @throws If the directory does not exist or if Docker fails to create the
 *         container (e.g., image not found, daemon not running).
 */
export async function runTestsInSandbox(
  localRepoPath: string,
  options: SandboxOptions = {},
  dockerClient?: Docker
): Promise<SandboxResult> {
  // ── Pre-flight: verify the source directory exists ────────────────────────
  if (!existsSync(localRepoPath)) {
    throw new Error(
      `[AGENT1] SANDBOX_ERROR: localRepoPath does not exist: ${localRepoPath}`
    );
  }

  // ── Pre-flight: install dependencies on host so the read-only sandbox has them 
  try {
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');
    
    console.log(`[AGENT1] Installing dependencies on host for ${localRepoPath}...`);
    execSync('npm install --ignore-scripts --no-audit --no-fund', { 
      cwd: localRepoPath, 
      stdio: 'ignore' 
    });

    // Fix CRLF issues in .bin shell wrappers on Windows for Linux Docker
    const binDir = path.join(localRepoPath, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      for (const file of fs.readdirSync(binDir)) {
        const filePath = path.join(binDir, file);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('\r\n')) {
            fs.writeFileSync(filePath, content.replace(/\r\n/g, '\n'));
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[AGENT1] Failed to pre-install dependencies on host: ${err}`);
  }

  const docker = dockerClient ?? getDockerClient();
  const timeoutMs = options.timeoutMs ?? SANDBOX_DEFAULTS.timeoutMs;
  const startTime = Date.now();

  let container: Docker.Container | null = null;
  let timedOut = false;
  let exitCode = -1;

  console.log(
    `[AGENT1] Starting sandbox. path=${localRepoPath} ` +
      `image=${options.image ?? SANDBOX_DEFAULTS.image} ` +
      `timeout=${timeoutMs}ms`
  );

  try {
    // ── 1. Create the container (does NOT start it yet) ─────────────────────
    const config = buildContainerConfig(localRepoPath, options);
    container = await docker.createContainer(config);

    console.log(`[AGENT1] Container created. id=${container.id}`);

    // ── 2. Start the container ───────────────────────────────────────────────
    await container.start();
    console.log(`[AGENT1] Container started.`);

    // ── 3. Attach to log stream (start AFTER start — Docker replays from t=0) ─
    const logsPromise = collectContainerLogs(container, docker);

    // ── 4. Race container.wait() against the hard kill timeout ───────────────
    let timeoutHandle: NodeJS.Timeout;

    const waitPromise = container
      .wait()
      .then((result: { StatusCode: number }) => result.StatusCode);

    const timeoutPromise = new Promise<never>(
      (_, reject) =>
        (timeoutHandle = setTimeout(() => {
          timedOut = true;
          reject(new Error('SANDBOX_TIMEOUT'));
        }, timeoutMs))
    );

    try {
      exitCode = await Promise.race([waitPromise, timeoutPromise]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message === 'SANDBOX_TIMEOUT') {
        // ── 5. TIMEOUT: kill the container aggressively ───────────────────
        console.warn(
          `[AGENT1] TIMEOUT: container did not exit within ${timeoutMs}ms — ` +
            `sending SIGKILL. id=${container.id}`
        );
        try {
          await container.kill({ Signal: 'SIGKILL' });
        } catch {
          // Container may have already exited naturally — safe to ignore.
        }
        // Standard exit code for SIGKILL is 137 (128 + 9).
        exitCode = 137;
      } else {
        // Re-throw unexpected Docker API errors.
        throw err;
      }
    } finally {
      clearTimeout(timeoutHandle!);
    }

    // ── 6. Drain the log stream (with a 2s safety fallback) ──────────────────
    const logs = await Promise.race([
      logsPromise,
      new Promise<{ stdout: string; stderr: string }>((resolve) =>
        setTimeout(
          () => resolve({ stdout: '', stderr: '' }),
          2_000
        )
      ),
    ]);

    const durationMs = Date.now() - startTime;

    console.log(
      `[AGENT1] Execution complete. ` +
        `exitCode=${exitCode} timedOut=${timedOut} durationMs=${durationMs}`
    );

    return {
      success: exitCode === 0,
      exitCode,
      stdout: logs.stdout,
      stderr: logs.stderr,
      timedOut,
      durationMs,
    };
  } finally {
    // ── 7. ALWAYS remove the container — no leaks ────────────────────────────
    if (container) {
      try {
        await container.remove({ force: true });
        console.log(`[AGENT1] Container removed.`);
      } catch {
        // Container may have already been removed (e.g., AutoRemove race).
      }
    }
  }
}
