import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Hermetic unit tests live next to the code they cover. They never touch
// Postgres, Redis or the network — anything that does belongs in test/.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
  // swc keeps decorator metadata that Nest DI needs (esbuild would drop it).
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
