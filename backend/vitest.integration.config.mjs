import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    include: ['test/**/*.integration.test.js'],
    setupFiles: ['./test/setup-env.js'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
