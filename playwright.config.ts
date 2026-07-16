import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Absorb the first-request cold-start flake (Colima DB connect latency after a
  // fresh dev-server boot). Extra retries in CI where every run is a cold start.
  retries: process.env.CI ? 2 : 1,
  // Serial execution: the in-memory email capture store is shared across all tests
  // (same Next.js dev-server process). Running with >1 worker causes race conditions
  // where concurrent tests pollute each other's captured-email assertions.
  workers: 1,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { EMAIL_TRANSPORT: 'capture' },
  },
})
