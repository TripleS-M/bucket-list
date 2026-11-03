import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_URL / PORT are only overridden for the demo (see scripts/demo.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: true,
    proxy: { '/api': process.env.API_URL || 'http://localhost:3000' },
  },
});
