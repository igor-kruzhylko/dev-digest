import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      // Single-sourced contracts live in the server's vendored shared (the
      // engine borrows them; see tsconfig paths).
      '@devdigest/shared': path.resolve(__dirname, '../server/src/vendor/shared'),
      // test/run.test.ts imports server/src/adapters/mocks.ts (the repo-wide
      // mock convention — see TESTING.md), which imports parseUnifiedDiff via
      // the package specifier '@devdigest/reviewer-core'. Vitest doesn't read
      // tsconfig `paths`, so without this self-alias that import can't resolve
      // when reviewer-core runs its OWN suite (server's vitest config aliases
      // it to '../reviewer-core/src' — this is the same alias, pointed at self).
      '@devdigest/reviewer-core': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
