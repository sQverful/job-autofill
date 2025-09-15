import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@extension/shared': resolve(__dirname, '../packages/shared/lib'),
      '@extension/storage': resolve(__dirname, '../packages/storage/lib'),
    },
  },
});