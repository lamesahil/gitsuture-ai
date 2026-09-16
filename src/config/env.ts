/**
 * src/config/env.ts
 *
 * Centralized environment configuration.
 * Loads from .env (via dotenv) and exports typed, validated values.
 * Throws at startup if required variables are missing.
 */

import * as dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[CONFIG] Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  /** HTTP port the Express server will bind to. */
  PORT: parseInt(optionalEnv('PORT', '3001'), 10),

  /**
   * GitHub Webhook secret configured in the repository / GitHub App settings.
   * Used for HMAC-SHA256 signature verification on incoming webhook payloads.
   * Required in production; must be set before starting the server.
   */
  GITHUB_WEBHOOK_SECRET: requireEnv('GITHUB_WEBHOOK_SECRET'),

  /**
   * GitHub Personal Access Token (or App Token) for API operations (clone, push, comment).
   * Required for the Orchestrator to communicate with GitHub.
   */
  GITHUB_TOKEN: requireEnv('GITHUB_TOKEN'),

  // ── GitHub App (optional — PAT remains the fallback when these are absent) ───

  /**
   * GitHub App numeric ID shown on the App settings page.
   * Example: 123456
   */
  GITHUB_APP_ID: optionalEnv('GITHUB_APP_ID', ''),

  /**
   * Path to the GitHub App private key PEM file on disk.
   * Takes priority over GITHUB_APP_PRIVATE_KEY if both are set.
   * Example: /etc/gitsuture/private-key.pem
   */
  GITHUB_APP_PRIVATE_KEY_PATH: optionalEnv('GITHUB_APP_PRIVATE_KEY_PATH', ''),

  /**
   * GitHub App private key PEM content as a raw string (newlines escaped as \n).
   * Used as fallback when GITHUB_APP_PRIVATE_KEY_PATH is not set.
   * Never commit real key material — store only in .env or a secrets manager.
   */
  GITHUB_APP_PRIVATE_KEY: optionalEnv('GITHUB_APP_PRIVATE_KEY', ''),

  /**
   * Gemini API Key for Agent 2 (Diagnosis & Repair).
   * Required in production; must be set before starting the server.
   */
  GEMINI_API_KEY: requireEnv('GEMINI_API_KEY'),

  /** Derived convenience: current Node environment. */
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
} as const;

export type Env = typeof env;
