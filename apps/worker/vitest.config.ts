import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  // swc keeps decorator metadata that Nest DI needs (esbuild would drop it).
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
