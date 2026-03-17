import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mirrors/core': resolve(__dirname, '../core/src/index.ts'),
      '@mirrors/transporter': resolve(__dirname, '../transporter/src/index.ts'),
    },
  },
  server: {
    port: 5200,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        embed: resolve(__dirname, 'embed.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
});
