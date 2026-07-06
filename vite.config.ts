import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Deployed at https://<user>.github.io/SWTweb/
export default defineConfig({
  base: '/SWTweb/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js-dist-min'],
          react: ['react', 'react-dom'],
          katex: ['katex'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
