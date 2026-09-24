import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  // @inova/shared is built to CommonJS for the Node services; pre-bundling
  // turns it into ESM for the dev server, and the build converts it the same way.
  optimizeDeps: {
    include: ['@inova/shared'],
  },
  build: {
    commonjsOptions: {
      include: [/@inova\/shared/, /node_modules/],
    },
  },
});
