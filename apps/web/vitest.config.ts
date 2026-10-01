import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.ts', 'app/**/__tests__/**/*.spec.ts', 'app/**/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    root: '.',
  },
  resolve: {
    alias: {
      '~': new URL('./app', import.meta.url).pathname,
      '@': new URL('./app', import.meta.url).pathname,
    },
  },
});
