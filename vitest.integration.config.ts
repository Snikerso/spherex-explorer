import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true } } },
  test: {
    include: ['apps/api/test/**/*.integration.test.ts'],
    testTimeout: 30000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
});
