import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // In local dev, forward API calls to the backend (in Azure both run on one site)
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
