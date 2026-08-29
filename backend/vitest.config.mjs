import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    include: ['test/**/*.test.js'],
    exclude: ['test/**/*.integration.test.js'],
    setupFiles: ['./test/setup-env.js'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
})
