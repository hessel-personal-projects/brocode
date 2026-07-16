import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})
