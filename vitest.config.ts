import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    // Integration tests share one local Postgres and each beforeEach truncates
    // all tables, so test files must not run concurrently or they wipe each
    // other's data mid-test. Run files serially.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
})
