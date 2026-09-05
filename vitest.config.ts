/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use Node environment (not browser jsdom).
    environment: 'node',

    // Run test files from the tests/ directory.
    include: ['tests/**/*.test.ts'],

    // Enable globals (describe, it, expect) without importing.
    globals: false,

    // TypeScript support via tsx.
    pool: 'forks',

    // Verbose output for Phase 1 validation.
    reporter: 'verbose',
  },
});
