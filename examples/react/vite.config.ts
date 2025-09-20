import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Allow environment variables in browser
    'process.env': process.env
  },
  server: {
    port: 3000,
    open: true
  }
});
