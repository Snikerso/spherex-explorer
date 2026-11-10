import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/api/test/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    testTimeout: 10000,
  },
});
