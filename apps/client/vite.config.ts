import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 3000,
    proxy: {
      '/ws': { target: 'http://localhost:8787', ws: true },
      '/matchmaking': { target: 'http://localhost:8787', ws: true },
      '/api': { target: 'http://localhost:8787' },
    },
  },
});
