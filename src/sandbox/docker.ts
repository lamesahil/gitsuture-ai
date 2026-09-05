/**
 * src/sandbox/docker.ts
 *
 * Low-level Dockerode singleton and daemon availability check.
 *
 * Responsibilities:
 *   - Provide a single shared Docker client instance.
 *   - Provide a safe daemon availability check that never throws.
 *
 * Agent 1 and Agent 3 import `getDockerClient()` to get the Docker handle.
 * Tests import `isDaemonAvailable()` to gate integration tests.
 */

import Docker from 'dockerode';

// ── Singleton ─────────────────────────────────────────────────────────────────
//
// On Linux: connects to /var/run/docker.sock
// On Windows with Docker Desktop: connects via named pipe or TCP
// The Dockerode constructor reads DOCKER_HOST / DOCKER_TLS_VERIFY if set.

let client: Docker | null = null;

/**
 * Return the shared Dockerode client instance, creating it on first call.
 * Instantiation does NOT attempt a connection — that happens on the first
 * API call (e.g., `docker.ping()`).
 */
export function getDockerClient(): Docker {
  if (!client) {
    client = new Docker();
  }
  return client;
}

// ── Availability check ────────────────────────────────────────────────────────

/**
 * Returns true if the Docker daemon is reachable.
 * Safe to call unconditionally — never throws.
 *
 * Usage in tests:
 *   const dockerAvailable = await isDaemonAvailable();
 *   it.skipIf(!dockerAvailable)('integration: ...', ...)
 */
export async function isDaemonAvailable(): Promise<boolean> {
  try {
    await getDockerClient().ping();
    return true;
  } catch {
    return false;
  }
}
